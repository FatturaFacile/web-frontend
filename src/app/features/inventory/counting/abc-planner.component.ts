import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  AbcOverride,
  AbcRun,
  COUNT_ABC_CLASSES,
  COUNT_APPROVAL_MODES,
  CountAbcClass,
  CountPolicy,
  CountPolicyPayload,
  CycleCountPlan,
  I18nService,
  InventoryCountApiService,
  InventoryItemOption,
  InventoryValuationApiService,
  InventoryWarehouseOption,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { bindServerErrors, httpStatus, inventoryErrorKey, validationMessages } from '../shared/inventory-valuation.utils';
import { ABC_CLASS_COLORS, CADENCE_LABELS, nullableNumber } from './inventory-counting.utils';

type OverrideClass = CountAbcClass | 'none';

@Component({
  selector: 'app-abc-planner',
  imports: [
    DatePipe,
    DecimalPipe,
    FormsModule,
    ReactiveFormsModule,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzCheckboxModule,
    NzFormModule,
    NzIconModule,
    NzInputModule,
    NzInputNumberModule,
    NzModalModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
    PageHeaderComponent,
    TranslatePipe,
  ],
  templateUrl: './abc-planner.component.html',
  styleUrl: '../shared/inventory-valuation.scss',
})
export class AbcPlannerComponent implements OnInit {
  private readonly api = inject(InventoryCountApiService);
  private readonly lookups = inject(InventoryValuationApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly nfb = inject(FormBuilder);

  protected readonly classes = COUNT_ABC_CLASSES;
  protected readonly approvalModes = COUNT_APPROVAL_MODES;
  protected readonly classColors = ABC_CLASS_COLORS;
  protected readonly cadenceLabels = CADENCE_LABELS;

  readonly warehouses = signal<InventoryWarehouseOption[]>([]);
  readonly items = signal<InventoryItemOption[]>([]);
  readonly errorKey = signal<string | null>(null);
  readonly formErrors = signal<string[]>([]);

  // --- ABC run ---
  readonly running = signal(false);
  readonly currentRun = signal<AbcRun | null>(null);
  readonly runs = signal<AbcRun[]>([]);
  readonly overrides = signal<AbcOverride[]>([]);
  readonly runForm = this.fb.group({
    period_days: this.fb.control(365, [Validators.required, Validators.min(1), Validators.max(3650)]),
    a_share: this.fb.control(80, [Validators.required, Validators.min(1), Validators.max(100)]),
    b_share: this.fb.control(95, [Validators.required, Validators.min(1), Validators.max(100)]),
    warehouse_id: this.fb.control(''),
    apply: this.fb.control(false),
  });

  // --- Override modal ---
  readonly overrideOpen = signal(false);
  readonly overrideSaving = signal(false);
  readonly overrideForm = this.fb.group({
    stock_item_id: this.fb.control('', Validators.required),
    abc_class: this.fb.control<OverrideClass>('A', Validators.required),
    reason: this.fb.control('', [Validators.required, Validators.maxLength(500)]),
  });

  // --- Policy ---
  readonly policy = signal<CountPolicy | null>(null);
  readonly policySaving = signal(false);
  readonly policyForm = this.nfb.group({
    abc_a_share: [80 as number | null, [Validators.required, Validators.min(1), Validators.max(100)]],
    abc_b_share: [95 as number | null, [Validators.required, Validators.min(1), Validators.max(100)]],
    abc_period_days: [365 as number | null, [Validators.required, Validators.min(1)]],
    interval_days_a: [90 as number | null, [Validators.required, Validators.min(1)]],
    interval_days_b: [180 as number | null, [Validators.required, Validators.min(1)]],
    interval_days_c: [365 as number | null, [Validators.required, Validators.min(1)]],
    new_item_class: ['A' as CountAbcClass, Validators.required],
    blind_by_default: [true],
    reveal_first_count_on_recount: [false],
    recount_threshold_percent: [null as number | null, Validators.min(0)],
    recount_threshold_value: [null as number | null, Validators.min(0)],
    max_recount_rounds: [2 as number | null, [Validators.required, Validators.min(0)]],
    approval_mode: ['workflow' as CountPolicy['approval_mode'], Validators.required],
    auto_approve_within_tolerance: [false],
    level1_threshold_percent: [null as number | null, Validators.min(0)],
    level1_threshold_value: [null as number | null, Validators.min(0)],
    level2_threshold_percent: [null as number | null, Validators.min(0)],
    level2_threshold_value: [null as number | null, Validators.min(0)],
    enforce_segregation_of_duties: [true],
    inventory_account_code: ['' as string | null, Validators.maxLength(20)],
    gain_account_code: ['' as string | null, Validators.maxLength(20)],
    loss_account_code: ['' as string | null, Validators.maxLength(20)],
  });

  // --- Plans ---
  readonly plans = signal<CycleCountPlan[]>([]);
  readonly planWarehouse = signal<string | null>(null);
  readonly planBusy = signal(false);
  readonly planModalOpen = signal(false);
  readonly editingPlan = signal<CycleCountPlan | null>(null);
  readonly planForm = this.fb.group({
    name: this.fb.control('', [Validators.required, Validators.maxLength(120)]),
    warehouse_id: this.fb.control('', Validators.required),
    abc_class: this.fb.control<OverrideClass>('none'),
    interval_days: this.fb.control(90, [Validators.required, Validators.min(1)]),
    freezes_stock: this.fb.control(false),
    is_active: this.fb.control(true),
  });

  ngOnInit(): void {
    this.lookups.listWarehouses().subscribe({ next: (w) => this.warehouses.set(w), error: () => this.warehouses.set([]) });
    this.loadPolicy();
    this.loadRuns();
    this.loadOverrides();
    this.loadPlans();
  }

  // ---------------------------------------------------------------- loading

  loadPolicy(): void {
    this.api.getPolicy().subscribe({
      next: (policy) => {
        this.policy.set(policy);
        this.policyForm.patchValue({ ...policy });
        this.runForm.patchValue({
          period_days: policy.abc_period_days,
          a_share: policy.abc_a_share,
          b_share: policy.abc_b_share,
        });
      },
      error: (err: unknown) => this.errorKey.set(inventoryErrorKey(err)),
    });
  }

  loadRuns(): void {
    this.api.listAbcRuns().subscribe({ next: (r) => this.runs.set(r), error: (err: unknown) => this.errorKey.set(inventoryErrorKey(err)) });
  }

  loadOverrides(): void {
    this.api.listAbcOverrides().subscribe({ next: (o) => this.overrides.set(o), error: () => this.overrides.set([]) });
  }

  loadPlans(): void {
    this.api.listPlans(this.planWarehouse() ?? undefined).subscribe({
      next: (p) => this.plans.set(p),
      error: (err: unknown) => this.errorKey.set(inventoryErrorKey(err)),
    });
  }

  searchItems(term: string): void {
    this.lookups.searchItems(term || undefined).subscribe({ next: (i) => this.items.set(i), error: () => this.items.set([]) });
  }

  setPlanWarehouse(id: string | null): void {
    this.planWarehouse.set(id);
    this.loadPlans();
  }

  // -------------------------------------------------------------- ABC runs

  runAbc(): void {
    if (this.runForm.invalid || this.running()) {
      this.runForm.markAllAsTouched();
      return;
    }
    const v = this.runForm.getRawValue();
    this.running.set(true);
    this.formErrors.set([]);
    this.api
      .runAbc({
        period_days: v.period_days,
        a_share: v.a_share,
        b_share: v.b_share,
        warehouse_id: v.warehouse_id || undefined,
        apply: v.apply,
      })
      .subscribe({
        next: (run) => {
          this.running.set(false);
          this.currentRun.set(run);
          this.message.success(this.i18n.translate('INVENTORY_COUNT.ABC.RUN_DONE'));
          this.loadRuns();
        },
        error: (err: unknown) => {
          this.running.set(false);
          this.failure(err, this.runForm);
        },
      });
  }

  openRun(run: AbcRun): void {
    this.api.getAbcRun(run.id).subscribe({
      next: (full) => this.currentRun.set(full),
      error: (err: unknown) => this.failure(err),
    });
  }

  // ------------------------------------------------------------- overrides

  openOverride(item?: { stock_item_id: string; sku: string; name: string }): void {
    this.overrideForm.reset({ stock_item_id: item?.stock_item_id ?? '', abc_class: 'A', reason: '' });
    this.formErrors.set([]);
    if (item) {
      this.items.set([{ id: item.stock_item_id, sku: item.sku, name: item.name }]);
    } else {
      this.searchItems('');
    }
    this.overrideOpen.set(true);
  }

  closeOverride(): void {
    this.overrideOpen.set(false);
  }

  saveOverride(): void {
    const v = this.overrideForm.getRawValue();
    const reason = v.reason.trim();
    if (this.overrideForm.invalid || !reason || this.overrideSaving()) {
      this.overrideForm.markAllAsTouched();
      this.overrideForm.controls.reason.markAsDirty();
      return;
    }
    this.overrideSaving.set(true);
    this.api
      .createAbcOverride({ stock_item_id: v.stock_item_id, abc_class: v.abc_class === 'none' ? null : v.abc_class, reason })
      .subscribe({
        next: () => {
          this.overrideSaving.set(false);
          this.overrideOpen.set(false);
          this.loadOverrides();
          const run = this.currentRun();
          if (run) {
            this.openRun(run);
          }
        },
        error: (err: unknown) => {
          this.overrideSaving.set(false);
          this.failure(err, this.overrideForm);
        },
      });
  }

  // ---------------------------------------------------------------- policy

  savePolicy(): void {
    if (this.policyForm.invalid || this.policySaving()) {
      this.policyForm.markAllAsTouched();
      return;
    }
    const v = this.policyForm.getRawValue();
    const payload: CountPolicyPayload = {
      abc_a_share: Number(v.abc_a_share),
      abc_b_share: Number(v.abc_b_share),
      abc_period_days: Number(v.abc_period_days),
      interval_days_a: Number(v.interval_days_a),
      interval_days_b: Number(v.interval_days_b),
      interval_days_c: Number(v.interval_days_c),
      new_item_class: v.new_item_class ?? undefined,
      blind_by_default: v.blind_by_default ?? undefined,
      reveal_first_count_on_recount: v.reveal_first_count_on_recount ?? undefined,
      recount_threshold_percent: nullableNumber(v.recount_threshold_percent),
      recount_threshold_value: nullableNumber(v.recount_threshold_value),
      max_recount_rounds: Number(v.max_recount_rounds),
      approval_mode: v.approval_mode ?? undefined,
      auto_approve_within_tolerance: v.auto_approve_within_tolerance ?? undefined,
      level1_threshold_percent: nullableNumber(v.level1_threshold_percent),
      level1_threshold_value: nullableNumber(v.level1_threshold_value),
      level2_threshold_percent: nullableNumber(v.level2_threshold_percent),
      level2_threshold_value: nullableNumber(v.level2_threshold_value),
      enforce_segregation_of_duties: v.enforce_segregation_of_duties ?? undefined,
      inventory_account_code: v.inventory_account_code?.trim() || null,
      gain_account_code: v.gain_account_code?.trim() || null,
      loss_account_code: v.loss_account_code?.trim() || null,
    };
    this.policySaving.set(true);
    this.formErrors.set([]);
    this.api.updatePolicy(payload).subscribe({
      next: (policy) => {
        this.policySaving.set(false);
        this.policy.set(policy);
        this.message.success(this.i18n.translate('INVENTORY_COUNT.POLICY.SAVED'));
      },
      error: (err: unknown) => {
        this.policySaving.set(false);
        this.failure(err, this.policyForm);
      },
    });
  }

  // ----------------------------------------------------------------- plans

  generatePlans(): void {
    const warehouseId = this.planWarehouse();
    if (!warehouseId || this.planBusy()) {
      return;
    }
    this.planBusy.set(true);
    this.api.generatePlans({ warehouse_id: warehouseId }).subscribe({
      next: () => {
        this.planBusy.set(false);
        this.message.success(this.i18n.translate('INVENTORY_COUNT.PLAN.GENERATED'));
        this.loadPlans();
      },
      error: (err: unknown) => {
        this.planBusy.set(false);
        this.failure(err);
      },
    });
  }

  runPlan(plan: CycleCountPlan): void {
    this.planBusy.set(true);
    this.api.runPlan(plan.id).subscribe({
      next: () => {
        this.planBusy.set(false);
        this.message.success(this.i18n.translate('INVENTORY_COUNT.SESSION.ACTION_DONE'));
        this.loadPlans();
      },
      error: (err: unknown) => {
        this.planBusy.set(false);
        this.failure(err);
      },
    });
  }

  runDue(): void {
    this.planBusy.set(true);
    this.api.runDuePlans().subscribe({
      next: (res) => {
        this.planBusy.set(false);
        this.message.success(this.i18n.translate('INVENTORY_COUNT.PLAN.RUN_DUE_DONE', { count: res.opened }));
        this.loadPlans();
      },
      error: (err: unknown) => {
        this.planBusy.set(false);
        this.failure(err);
      },
    });
  }

  openPlanModal(plan?: CycleCountPlan): void {
    this.editingPlan.set(plan ?? null);
    this.formErrors.set([]);
    this.planForm.reset({
      name: plan?.name ?? '',
      warehouse_id: plan?.warehouse_id ?? this.planWarehouse() ?? '',
      abc_class: plan?.abc_class ?? 'none',
      interval_days: plan?.interval_days ?? 90,
      freezes_stock: plan?.freezes_stock ?? false,
      is_active: plan?.is_active ?? true,
    });
    this.planModalOpen.set(true);
  }

  closePlanModal(): void {
    this.planModalOpen.set(false);
  }

  savePlan(): void {
    if (this.planForm.invalid || this.planBusy()) {
      this.planForm.markAllAsTouched();
      return;
    }
    const v = this.planForm.getRawValue();
    const editing = this.editingPlan();
    const payload = {
      name: v.name.trim(),
      warehouse_id: v.warehouse_id,
      abc_class: v.abc_class === 'none' ? null : v.abc_class,
      interval_days: v.interval_days,
      freezes_stock: v.freezes_stock,
      ...(editing ? { is_active: v.is_active } : {}),
    };
    this.planBusy.set(true);
    const request = editing ? this.api.updatePlan(editing.id, payload) : this.api.createPlan(payload);
    request.subscribe({
      next: () => {
        this.planBusy.set(false);
        this.planModalOpen.set(false);
        this.loadPlans();
      },
      error: (err: unknown) => {
        this.planBusy.set(false);
        this.failure(err, this.planForm);
      },
    });
  }

  deletePlan(plan: CycleCountPlan): void {
    this.planBusy.set(true);
    this.api.deletePlan(plan.id).subscribe({
      next: () => {
        this.planBusy.set(false);
        this.loadPlans();
      },
      error: (err: unknown) => {
        this.planBusy.set(false);
        this.failure(err);
      },
    });
  }

  warehouseName(id: string | null): string {
    return this.warehouses().find((w) => w.id === id)?.name ?? id ?? '-';
  }

  /** 422 are shown inline (the interceptor toasts the other 4xx/5xx). */
  private failure(err: unknown, form?: Parameters<typeof bindServerErrors>[0]): void {
    if (httpStatus(err) !== 422) {
      return;
    }
    const messages = form ? bindServerErrors(form, err) : validationMessages(err);
    this.formErrors.set(messages.length ? messages : [this.i18n.translate('INVENTORY_COUNT.ABC.SAVE_ERROR')]);
  }
}
