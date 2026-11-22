import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  FSM_PRIORITIES,
  FsmApiService,
  FsmBoard,
  FsmBoardBlock,
  FsmBoardLane,
  FsmBoardUnassigned,
  FsmDispatchBlockers,
  FsmMaintenanceContract,
  I18nService,
  PermissionsService,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { DispatcherGanttComponent, GanttSlotEvent } from './dispatcher-gantt.component';
import { DispatcherMapComponent } from './dispatcher-map.component';
import {
  assignmentWarnings,
  AssignmentWarnings,
  EMPTY_QUEUE_FILTERS,
  extractDispatchBlockers,
  filterQueue,
  hasWarnings,
  isVanReady,
  QueueFilters,
  queueContractIds,
  queueSkills,
  VanReadinessFilter,
  WorkKindFilter,
} from './dispatcher.utils';

const HOUR_MS = 60 * 60 * 1000;
const DEFAULT_VISIT_HOURS = 2;

/** Monday 00:00 (local time) of the week containing the date. */
export function startOfWeek(date: Date): Date {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const offset = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - offset);
  return start;
}

/** `YYYY-MM-DDTHH:mm` in local time, the value format of `datetime-local` inputs. */
export function toLocalInput(value: Date): string {
  const pad = (n: number): string => n.toString().padStart(2, '0');
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}`;
}

interface DispatchTarget {
  workOrderId: string;
  number: string;
  title: string;
  /** The queue entry being assigned; `null` when an already scheduled block is rescheduled. */
  item: FsmBoardUnassigned | null;
}

const KNOWN_BLOCKERS: ReadonlySet<string> = new Set(['schedule', 'skills', 'van_stock', 'technician', 'hse', 'work_order', 'scheduled_end']);

const PRIORITY_COLORS: Record<string, string> = { urgent: 'red', critical: 'red', high: 'orange', normal: 'blue', medium: 'blue', low: 'default' };

/**
 * Dispatcher board: filterable unassigned queue, multi-technician Gantt of the board window with skill and van
 * warnings, assignment and rescheduling through the dispatch endpoint, a site map and the route-optimisation panel.
 */
@Component({
  selector: 'app-dispatcher-board',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzEmptyModule,
    NzFormModule,
    NzInputModule,
    NzModalModule,
    NzSelectModule,
    NzSpinModule,
    NzTagModule,
    PageHeaderComponent,
    TranslatePipe,
    DispatcherGanttComponent,
    DispatcherMapComponent,
  ],
  templateUrl: './dispatcher-board.component.html',
  styleUrl: './dispatcher-board.component.scss',
})
export class DispatcherBoardComponent implements OnInit {
  private readonly api = inject(FsmApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  private readonly permissions = inject(PermissionsService);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly canWrite = computed(() => this.permissions.canWrite('service'));
  protected readonly priorities = FSM_PRIORITIES;

  protected readonly loading = signal(false);
  protected readonly loadError = signal(false);
  protected readonly board = signal<FsmBoard | null>(null);
  protected readonly contracts = signal<FsmMaintenanceContract[]>([]);
  protected readonly weekStart = signal<Date>(startOfWeek(new Date()));
  protected readonly filters = signal<QueueFilters>({ ...EMPTY_QUEUE_FILTERS });
  protected readonly selectedId = signal<string | null>(null);

  protected readonly window = computed(() => {
    const from = this.weekStart();
    const to = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 7);
    return { from: from.toISOString(), to: to.toISOString() };
  });

  protected readonly lanes = computed<FsmBoardLane[]>(() => this.board()?.lanes ?? []);
  protected readonly queue = computed<FsmBoardUnassigned[]>(() => this.board()?.unassigned ?? []);
  protected readonly filteredQueue = computed(() => filterQueue(this.queue(), this.filters(), this.lanes()));
  protected readonly selected = computed(() => this.queue().find((wo) => wo.work_order_id === this.selectedId()) ?? null);
  protected readonly skillOptions = computed(() => queueSkills(this.queue()));
  protected readonly contractOptions = computed(() =>
    queueContractIds(this.queue()).map((id) => ({ value: id, label: this.contractLabel(id) })),
  );

  // --- Dispatch dialog ---
  protected readonly dialogTarget = signal<DispatchTarget | null>(null);
  protected readonly saving = signal(false);
  protected readonly blockers = signal<FsmDispatchBlockers | null>(null);
  protected readonly form = this.fb.group({
    technician_id: this.fb.control('', Validators.required),
    start: this.fb.control('', Validators.required),
    end: this.fb.control('', Validators.required),
  });
  private readonly formValue = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });

  protected readonly rangeInvalid = computed(() => {
    const { start, end } = this.formValue();
    return !!start && !!end && new Date(end).getTime() <= new Date(start).getTime();
  });

  /** Warnings of the chosen technician for the queue entry being assigned (what the endpoint would also refuse). */
  protected readonly liveWarnings = computed<AssignmentWarnings | null>(() => {
    const target = this.dialogTarget();
    const lane = this.lanes().find((l) => l.technician_id === this.formValue().technician_id);
    return target?.item && lane ? assignmentWarnings(target.item, lane) : null;
  });
  protected readonly liveHasWarnings = computed(() => {
    const warnings = this.liveWarnings();
    return warnings !== null && hasWarnings(warnings);
  });

  protected readonly blockerGroups = computed(() =>
    Object.entries(this.blockers() ?? {}).map(([key, messages]) => ({ key, messages })),
  );

  ngOnInit(): void {
    this.load();
    this.api.listContracts().subscribe({
      next: (res) => this.contracts.set(res.data),
      error: () => this.contracts.set([]),
    });
  }

  protected load(): void {
    this.loading.set(true);
    this.loadError.set(false);
    this.api.getBoard(this.window()).subscribe({
      next: (res) => {
        this.board.set(res.data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.loadError.set(true);
      },
    });
  }

  protected shiftWeek(weeks: number): void {
    const current = this.weekStart();
    this.weekStart.set(new Date(current.getFullYear(), current.getMonth(), current.getDate() + weeks * 7));
    this.load();
  }

  protected thisWeek(): void {
    this.weekStart.set(startOfWeek(new Date()));
    this.load();
  }

  // --- Queue ---
  protected setFilter<K extends keyof QueueFilters>(key: K, value: QueueFilters[K] | null): void {
    this.filters.update((f) => ({ ...f, [key]: value ?? EMPTY_QUEUE_FILTERS[key] }));
  }

  protected setVanFilter(value: VanReadinessFilter | null): void {
    this.setFilter('vanReadiness', value);
  }

  protected setKindFilter(value: WorkKindFilter | null): void {
    this.setFilter('kind', value);
  }

  protected resetFilters(): void {
    this.filters.set({ ...EMPTY_QUEUE_FILTERS });
  }

  protected toggleSelected(item: FsmBoardUnassigned): void {
    this.selectedId.update((id) => (id === item.work_order_id ? null : item.work_order_id));
  }

  protected vanReady(item: FsmBoardUnassigned): boolean {
    return isVanReady(item, this.lanes());
  }

  protected priorityColor(priority: string): string {
    return PRIORITY_COLORS[priority] ?? 'default';
  }

  protected contractLabel(id: string): string {
    const contract = this.contracts().find((c) => c.id === id);
    return contract ? `${contract.contract_number} - ${contract.title}` : id.slice(0, 8);
  }

  /** Heading of a blocker group; unknown keys fall back to the raw key. */
  protected blockerTitle(key: string): string {
    return KNOWN_BLOCKERS.has(key) ? this.i18n.translate(`FSM.DISPATCH.BLOCKER_${key.toUpperCase()}`) : key;
  }

  protected kindOf(item: FsmBoardUnassigned): string {
    return item.work_order_type ?? item.work_type;
  }

  // --- Assign / reschedule ---
  /** Opens the dialog to assign the queue entry (optionally pre-filled with a lane and an instant picked on the Gantt). */
  protected openAssign(item: FsmBoardUnassigned, lane?: FsmBoardLane, at?: string): void {
    const start = at ? new Date(at) : this.defaultStart();
    this.openDialog(
      { workOrderId: item.work_order_id, number: item.work_order_number, title: item.title, item },
      lane?.technician_id ?? '',
      start,
      new Date(start.getTime() + DEFAULT_VISIT_HOURS * HOUR_MS),
    );
  }

  protected openReschedule(block: FsmBoardBlock, lane: FsmBoardLane): void {
    const start = block.scheduled_start ? new Date(block.scheduled_start) : this.defaultStart();
    const end = block.scheduled_end ? new Date(block.scheduled_end) : new Date(start.getTime() + DEFAULT_VISIT_HOURS * HOUR_MS);
    this.openDialog(
      { workOrderId: block.work_order_id, number: block.work_order_number, title: block.title, item: null },
      lane.technician_id,
      start,
      end,
    );
  }

  protected onSlot(event: GanttSlotEvent): void {
    const item = this.selected();
    if (item && this.canWrite()) {
      this.openAssign(item, event.lane, event.at);
    }
  }

  protected onLaneAction(lane: FsmBoardLane): void {
    const item = this.selected();
    if (item && this.canWrite()) {
      this.openAssign(item, lane);
    }
  }

  protected onBlock(event: { block: FsmBoardBlock; lane: FsmBoardLane }): void {
    if (this.canWrite()) {
      this.openReschedule(event.block, event.lane);
    }
  }

  protected closeDialog(): void {
    this.dialogTarget.set(null);
    this.blockers.set(null);
  }

  protected submit(): void {
    const target = this.dialogTarget();
    if (!target || this.form.invalid || this.rangeInvalid() || this.saving()) {
      return;
    }
    const value = this.form.getRawValue();
    this.saving.set(true);
    this.blockers.set(null);
    this.api
      .dispatch(target.workOrderId, {
        technician_id: value.technician_id,
        scheduled_start: new Date(value.start).toISOString(),
        scheduled_end: new Date(value.end).toISOString(),
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.closeDialog();
          this.selectedId.set(null);
          this.message.success(this.i18n.translate('FSM.DISPATCH.ASSIGNED'));
          this.load();
        },
        error: (error: unknown) => {
          this.saving.set(false);
          const blockers = extractDispatchBlockers(error);
          if (blockers) {
            this.blockers.set(blockers);
          } else {
            this.message.error(this.i18n.translate('FSM.DISPATCH.ASSIGN_FAILED'));
          }
        },
      });
  }

  private openDialog(target: DispatchTarget, technicianId: string, start: Date, end: Date): void {
    this.blockers.set(null);
    this.form.reset({ technician_id: technicianId, start: toLocalInput(start), end: toLocalInput(end) });
    this.dialogTarget.set(target);
  }

  private defaultStart(): Date {
    const weekStart = this.weekStart();
    const start = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate(), 8, 0, 0, 0);
    const now = new Date();
    if (now.getTime() >= start.getTime() && now.getTime() < start.getTime() + 7 * 24 * HOUR_MS) {
      now.setMinutes(Math.ceil(now.getMinutes() / 30) * 30, 0, 0);
      return now;
    }
    return start;
  }
}
