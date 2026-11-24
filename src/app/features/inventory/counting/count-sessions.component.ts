import { DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzProgressModule } from 'ng-zorro-antd/progress';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { Observable } from 'rxjs';
import {
  COUNT_SESSION_STATUSES,
  COUNT_TYPES,
  CountSession,
  CountSessionStatus,
  CountType,
  I18nService,
  InventoryCountApiService,
  InventoryValuationApiService,
  InventoryWarehouseOption,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { bindServerErrors, httpStatus, inventoryErrorKey, toIsoDate, validationMessages } from '../shared/inventory-valuation.utils';
import { CountSessionFacade } from './inventory-counting.facades';
import { COUNT_STATUS_LABELS, COUNT_TYPE_LABELS } from './inventory-counting.utils';

@Component({
  selector: 'app-count-sessions',
  imports: [
    DatePipe,
    FormsModule,
    ReactiveFormsModule,
    RouterLink,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzCheckboxModule,
    NzDatePickerModule,
    NzDescriptionsModule,
    NzDrawerModule,
    NzFormModule,
    NzIconModule,
    NzInputModule,
    NzModalModule,
    NzPopconfirmModule,
    NzProgressModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
    PageHeaderComponent,
    TranslatePipe,
  ],
  providers: [CountSessionFacade],
  templateUrl: './count-sessions.component.html',
  styleUrl: '../shared/inventory-valuation.scss',
})
export class CountSessionsComponent implements OnInit {
  protected readonly facade = inject(CountSessionFacade);
  private readonly api = inject(InventoryCountApiService);
  private readonly lookups = inject(InventoryValuationApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly statuses = COUNT_SESSION_STATUSES;
  protected readonly types = COUNT_TYPES;
  protected readonly statusLabels = COUNT_STATUS_LABELS;
  protected readonly typeLabels = COUNT_TYPE_LABELS;

  readonly warehouses = signal<InventoryWarehouseOption[]>([]);
  readonly errors = signal<string[]>([]);
  readonly busy = signal(false);

  // --- Create modal ---
  readonly createOpen = signal(false);
  readonly createForm = this.fb.group({
    warehouse_id: this.fb.control('', Validators.required),
    count_type: this.fb.control<CountType>('full_physical', Validators.required),
    scheduled_date: this.fb.control<Date | null>(new Date(), Validators.required),
    warehouse_zone_id: this.fb.control(''),
    freezes_stock: this.fb.control(false),
    is_blind: this.fb.control(true),
    assigned_to: this.fb.control(''),
    bin_ids: this.fb.control<string[]>([]),
  });

  // --- Detail drawer ---
  readonly selected = signal<CountSession | null>(null);
  readonly drawerOpen = signal(false);
  readonly countedLines = signal(0);
  readonly totalLines = signal(0);
  readonly progressPercent = computed(() =>
    this.totalLines() > 0 ? Math.round((this.countedLines() / this.totalLines()) * 100) : 0,
  );
  readonly canAct = computed(() => this.selected()?.status === 'in_progress');
  readonly canOpenWorkbench = computed(() => {
    const status = this.selected()?.status;
    return status === 'in_progress' || status === 'pending_approval' || status === 'reconciled';
  });

  readonly unfreezeOpen = signal(false);
  readonly unfreezeReason = signal('');
  readonly assignedTo = signal('');

  ngOnInit(): void {
    this.lookups.listWarehouses().subscribe({ next: (w) => this.warehouses.set(w), error: () => this.warehouses.set([]) });
  }

  setWarehouse(id: string | null): void {
    this.facade.setFilter({ warehouse_id: id ?? undefined });
  }

  setStatus(status: CountSessionStatus | null): void {
    this.facade.setFilter({ status: status ?? undefined });
  }

  warehouseName(id: string | null): string {
    return this.warehouses().find((w) => w.id === id)?.name ?? id ?? '-';
  }

  /** Counted share of a listed session, when the API reports line counters. */
  listProgress(session: CountSession): number | null {
    const total = session.lines_count ?? 0;
    return total > 0 ? Math.round(((session.counted_lines_count ?? 0) / total) * 100) : null;
  }

  // ---------------------------------------------------------------- create

  openCreate(): void {
    this.errors.set([]);
    this.createForm.reset({
      warehouse_id: '',
      count_type: 'full_physical',
      scheduled_date: new Date(),
      warehouse_zone_id: '',
      freezes_stock: false,
      is_blind: true,
      assigned_to: '',
      bin_ids: [],
    });
    this.createOpen.set(true);
  }

  closeCreate(): void {
    this.createOpen.set(false);
  }

  create(): void {
    if (this.createForm.invalid || this.busy()) {
      this.createForm.markAllAsTouched();
      return;
    }
    const v = this.createForm.getRawValue();
    const scheduled = toIsoDate(v.scheduled_date);
    if (!scheduled) {
      this.createForm.controls.scheduled_date.setErrors({ required: true });
      return;
    }
    this.busy.set(true);
    this.errors.set([]);
    this.api
      .createSession({
        warehouse_id: v.warehouse_id,
        count_type: v.count_type,
        scheduled_date: scheduled,
        freezes_stock: v.freezes_stock,
        is_blind: v.is_blind,
        assigned_to: v.assigned_to.trim() || undefined,
        warehouse_zone_id: v.warehouse_zone_id.trim() || undefined,
        bin_ids: v.bin_ids.length ? v.bin_ids : undefined,
      })
      .subscribe({
        next: (session) => {
          this.busy.set(false);
          this.createOpen.set(false);
          this.message.success(this.i18n.translate('INVENTORY_COUNT.SESSION.CREATED'));
          this.facade.reload();
          this.openDetail(session);
        },
        error: (err: unknown) => {
          this.busy.set(false);
          this.fail(err, true);
        },
      });
  }

  // ---------------------------------------------------------------- detail

  openDetail(session: CountSession): void {
    this.selected.set(session);
    this.assignedTo.set(session.assigned_to ?? '');
    this.errors.set([]);
    this.drawerOpen.set(true);
    this.loadProgress(session.id);
    this.api.getSession(session.id).subscribe({
      next: (full) => this.selected.set(full),
      error: () => undefined,
    });
  }

  closeDrawer(): void {
    this.drawerOpen.set(false);
  }

  private loadProgress(id: string): void {
    this.countedLines.set(0);
    this.totalLines.set(0);
    this.api.getSheet(id).subscribe({
      next: (sheet) => {
        this.totalLines.set(sheet.data.length);
        this.countedLines.set(sheet.data.filter((l) => l.is_counted).length);
      },
      error: () => undefined,
    });
  }

  freeze(): void {
    this.act((id) => this.api.freeze(id));
  }

  openUnfreeze(): void {
    this.unfreezeReason.set('');
    this.unfreezeOpen.set(true);
  }

  closeUnfreeze(): void {
    this.unfreezeOpen.set(false);
  }

  unfreeze(): void {
    const reason = this.unfreezeReason().trim();
    if (!reason) {
      return;
    }
    this.act((id) => this.api.unfreeze(id, reason), () => this.unfreezeOpen.set(false));
  }

  assign(): void {
    const value = this.assignedTo().trim();
    this.act((id) => this.api.assign(id, { assigned_to: value || null }));
  }

  cancel(): void {
    this.act((id) => this.api.cancel(id));
  }

  /** Submits the differences (opens the stock adjustment) and moves to the approval workbench. */
  submitDifferences(): void {
    const session = this.selected();
    if (!session || this.busy()) {
      return;
    }
    this.busy.set(true);
    this.errors.set([]);
    this.api.reconcile(session.id).subscribe({
      next: () => {
        this.busy.set(false);
        this.drawerOpen.set(false);
        this.facade.reload();
        void this.router.navigate(['/inventory/counts', session.id, 'reconcile']);
      },
      error: (err: unknown) => {
        this.busy.set(false);
        this.fail(err, false);
      },
    });
  }

  private act(request: (id: string) => Observable<CountSession>, done?: () => void): void {
    const session = this.selected();
    if (!session || this.busy()) {
      return;
    }
    this.busy.set(true);
    this.errors.set([]);
    request(session.id).subscribe({
      next: (updated) => {
        this.busy.set(false);
        this.selected.set({ ...session, ...updated });
        this.message.success(this.i18n.translate('INVENTORY_COUNT.SESSION.ACTION_DONE'));
        this.facade.reload();
        done?.();
      },
      error: (err: unknown) => {
        this.busy.set(false);
        this.fail(err, false);
      },
    });
  }

  /** 422 is shown inline; the interceptor already toasts the other failures. */
  private fail(err: unknown, bindToCreateForm: boolean): void {
    if (httpStatus(err) === 422) {
      const messages = bindToCreateForm ? bindServerErrors(this.createForm, err) : validationMessages(err);
      this.errors.set(messages.length ? messages : [this.i18n.translate(inventoryErrorKey(err))]);
    }
  }
}
