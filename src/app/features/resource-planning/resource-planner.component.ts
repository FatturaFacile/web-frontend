import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzBadgeModule } from 'ng-zorro-antd/badge';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDropdownModule } from 'ng-zorro-antd/dropdown';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import {
  CapacityBand,
  CapacityCell,
  CapacityRow,
  HEATMAP_GRANULARITIES,
  HeatmapGranularity,
  PlanningIssue,
  ResourceAllocation,
  TranslateService,
} from '@core';
import { PageHeaderComponent, TranslatePipe, RadioControlDirective } from '@shared';
import {
  AllocationDialogComponent,
  DialogRequest,
  DialogResult,
  EmployeeOption,
} from './allocation-dialog.component';
import { CandidateDrawerComponent } from './candidate-drawer.component';
import { PlannerOutcome, ResourcePlannerStore } from './resource-planning.store';
import {
  AllocationBar,
  DragMode,
  effectiveBand,
  errorKey,
  formatHours,
  formatPercent,
  issueParams,
  loadBarPercent,
  needsProjectToConvert,
  periodEndOf,
  planDrop,
  warningKey,
} from './resource-planning.util';

interface DragState {
  allocation: ResourceAllocation;
  mode: DragMode;
}

/**
 * The capacity planner (Mod 079): a saturation heatmap by resource and week or day (green below 80 %, yellow up to
 * 100 %, red above) with the bookings drawn as bars under each row. A bar is dragged to another week or colleague
 * (shift), by its edges (resize) or with Shift held (split); the menu of the bar offers the same actions to the keyboard
 * and the soft to hard conversion. Every change goes through the rebalance endpoint, which answers the overload verdict.
 */
@Component({
  selector: 'app-resource-planner',
  templateUrl: './resource-planner.component.html',
  styleUrl: './resource-planner.component.scss',
  providers: [ResourcePlannerStore],
  imports: [
    RadioControlDirective,
    AllocationDialogComponent,
    CandidateDrawerComponent,
    FormsModule,
    PageHeaderComponent,
    TranslatePipe,
    NzAlertModule,
    NzBadgeModule,
    NzButtonModule,
    NzDropdownModule,
    NzEmptyModule,
    NzMenuModule,
    NzPopconfirmModule,
    NzRadioModule,
    NzSelectModule,
    NzSpinModule,
    NzTagModule,
    NzTooltipModule,
  ],
})
export class ResourcePlannerComponent implements OnInit {
  readonly store = inject(ResourcePlannerStore);
  private readonly translate = inject(TranslateService);
  private readonly message = inject(NzMessageService);

  readonly granularities = HEATMAP_GRANULARITIES;
  readonly bands: readonly CapacityBand[] = ['green', 'yellow', 'red', 'none'];
  readonly dragging = signal<DragState | null>(null);
  readonly candidatesOpen = signal(false);
  readonly dialog = signal<DialogRequest | null>(null);
  readonly language = computed(() => this.translate.currentLanguage());
  readonly employeeOptions = computed<EmployeeOption[]>(() =>
    this.store.rows().map((row) => ({ id: row.employee_id, name: row.employee_name })),
  );
  /** Days a one-period keyboard move shifts a booking by. */
  private readonly stepDays = computed(() => (this.store.granularity() === 'week' ? 7 : 1));

  ngOnInit(): void {
    void this.store.init();
  }

  setGranularity(granularity: HeatmapGranularity): void {
    void this.store.setGranularity(granularity);
  }

  band(cell: CapacityCell): CapacityBand {
    return effectiveBand(cell, this.store.thresholds());
  }

  barsOf(row: CapacityRow): AllocationBar[] {
    return this.store.barsByEmployee()[row.employee_id] ?? [];
  }

  tracksOf(row: CapacityRow): number {
    return Math.max(1, ...this.barsOf(row).map((bar) => bar.track + 1));
  }

  rowOverloaded(row: CapacityRow): boolean {
    return this.store.overloaded().some((entry) => entry.row.employee_id === row.employee_id);
  }

  loadBar(cell: CapacityCell): number {
    return loadBarPercent(cell);
  }

  hours(value: number): string {
    return formatHours(value);
  }

  percent(value: number): string {
    return formatPercent(value);
  }

  periodLabel(period: string): string {
    const week = this.store.granularity() === 'week';
    return new Intl.DateTimeFormat(this.language(), {
      day: '2-digit',
      month: '2-digit',
      ...(week ? {} : { weekday: 'short' as const }),
      timeZone: 'UTC',
    }).format(new Date(`${period}T00:00:00Z`));
  }

  rangeLabel(): string {
    const { from, to } = this.store.window();
    return `${from} – ${to}`;
  }

  barLabel(allocation: ResourceAllocation): string {
    return allocation.project_name ?? allocation.crm_opportunity_name ?? allocation.employee_name;
  }

  barTitle(allocation: ResourceAllocation): string {
    return this.translate.instant('resourcePlanning.bar.title', {
      name: this.barLabel(allocation),
      type: this.translate.instant(`resourcePlanning.bookingType.${allocation.booking_type}`),
      hours: allocation.allocated_hours_per_day,
      total: allocation.total_allocated_hours,
      from: allocation.start_date,
      to: allocation.end_date,
    });
  }

  // --- Drag and drop ---

  startDrag(event: DragEvent, allocation: ResourceAllocation, mode: DragMode): void {
    if (mode !== 'move') {
      // The handle sits inside the draggable bar: only the handle drag must start.
      event.stopPropagation();
    }
    event.dataTransfer?.setData('text/plain', allocation.id);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
    }
    this.dragging.set({ allocation, mode });
  }

  endDrag(): void {
    this.dragging.set(null);
  }

  allowDrop(event: DragEvent): void {
    if (this.dragging() !== null) {
      event.preventDefault();
    }
  }

  onCellDrop(event: DragEvent, employeeId: string, periodStart: string): void {
    event.preventDefault();
    void this.dropOn(employeeId, periodStart, event.shiftKey);
  }

  /** A drop on the lane of the bars: the period under the pointer is read from its position. */
  onLaneDrop(event: DragEvent, employeeId: string): void {
    event.preventDefault();
    const periods = this.store.periods();
    const lane = event.currentTarget as HTMLElement;
    const rect = lane.getBoundingClientRect();
    if (periods.length === 0 || rect.width === 0) {
      return;
    }
    const index = Math.min(
      periods.length - 1,
      Math.max(0, Math.floor(((event.clientX - rect.left) / rect.width) * periods.length)),
    );
    void this.dropOn(employeeId, periods[index], event.shiftKey);
  }

  /** The booking on the drag lands on a colleague row at a period: shift, split or resize as the drag was. */
  async dropOn(employeeId: string, periodStart: string, split: boolean): Promise<void> {
    const drag = this.dragging();
    this.dragging.set(null);
    if (drag === null || !this.canEdit()) {
      return;
    }
    const granularity = this.store.granularity();
    const payload = planDrop(
      drag.allocation,
      drag.mode,
      { employeeId, periodStart, periodEnd: periodEndOf(periodStart, granularity) },
      granularity,
      { windowStart: this.store.window().from, split },
    );
    if (payload !== null) {
      this.report(await this.store.rebalance(drag.allocation, payload), 'resourcePlanning.saved');
    }
  }

  canEdit(): boolean {
    return !this.store.saving();
  }

  // --- Menu actions (the keyboard alternative of the drag) ---

  async step(allocation: ResourceAllocation, direction: -1 | 1): Promise<void> {
    this.report(
      await this.store.rebalance(allocation, {
        strategy: 'shift',
        shift_days: this.stepDays() * direction,
      }),
      'resourcePlanning.saved',
    );
  }

  async reassign(allocation: ResourceAllocation, employeeId: string): Promise<void> {
    if (employeeId === allocation.employee_id) {
      return;
    }
    this.report(
      await this.store.rebalance(allocation, { strategy: 'reassign', employee_id: employeeId }),
      'resourcePlanning.saved',
    );
  }

  openDialog(mode: DialogRequest['mode'], allocation: ResourceAllocation): void {
    this.dialog.set({ mode, allocation });
  }

  /** A soft booking that already has a project converts at once; otherwise the dialog asks for it. */
  async convert(allocation: ResourceAllocation): Promise<void> {
    if (needsProjectToConvert(allocation)) {
      this.openDialog('convert', allocation);
      return;
    }
    this.report(await this.store.convertToHard(allocation), 'resourcePlanning.converted');
  }

  async submitDialog(result: DialogResult): Promise<void> {
    const outcome = result.rebalance
      ? await this.store.rebalance(result.allocation, result.rebalance)
      : await this.store.convertToHard(result.allocation, result.convert);
    if (outcome.ok) {
      this.dialog.set(null);
    }
    this.report(
      outcome,
      result.mode === 'convert' ? 'resourcePlanning.converted' : 'resourcePlanning.saved',
    );
  }

  async remove(allocation: ResourceAllocation): Promise<void> {
    this.report(await this.store.remove(allocation), 'resourcePlanning.deleted');
  }

  // --- Feedback ---

  describeError(issue: PlanningIssue): string {
    return this.translate.instant(errorKey(issue.code), issueParams(issue));
  }

  describeWarning(issue: PlanningIssue): string {
    return this.translate.instant(warningKey(issue.code), issueParams(issue));
  }

  private report(outcome: PlannerOutcome, successKey: string): void {
    if (outcome.ok) {
      this.message.success(this.translate.instant(successKey));
      return;
    }
    const first = outcome.issues[0];
    this.message.error(
      first
        ? this.describeError(first)
        : this.translate.instant(outcome.message ?? 'resourcePlanning.saveError'),
    );
  }
}
