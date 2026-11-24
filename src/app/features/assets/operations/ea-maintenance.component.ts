import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Component, computed, inject, OnInit, signal, TemplateRef, viewChild } from '@angular/core';
import { AbstractControl, FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  applyServerErrors,
  AssetApiService,
  AssetClass,
  AssetCondition,
  EamOpsApiService,
  FetchGridModel,
  FixedAssetResource,
  I18nService,
  MaintenancePlan,
  MaintenancePlanPayload,
  MaintenanceTrigger,
  MaintenanceType,
  PermissionsService,
  WorkOrder,
  WorkOrderDetail,
} from '@core';
import { BaseTableComponent, MoneyPipe, TranslatePipe, ModalActionsDirective, IconActionDirective, TableColumnDef, GridSortPipe, GridFilterListPipe, GridFilterFnPipe } from '@shared';

@Component({
  selector: 'app-ea-maintenance',
  styleUrl: './ea-maintenance.component.scss',
  imports: [
    BaseTableComponent,
    ModalActionsDirective,
    IconActionDirective,
    FormsModule,
    ReactiveFormsModule,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzFormModule,
    NzInputModule,
    NzInputNumberModule,
    NzModalModule,
    NzSelectModule,
    NzSwitchModule,
    NzTableModule,
    NzTabsModule,
    NzTagModule,
    MoneyPipe,
    TranslatePipe,
    GridSortPipe, GridFilterListPipe, GridFilterFnPipe,
  ],
  templateUrl: './ea-maintenance.component.html',
})
export class EaMaintenanceComponent implements OnInit {
  private readonly api = inject(EamOpsApiService);
  private readonly assetApi = inject(AssetApiService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  protected readonly canWrite = inject(PermissionsService).canWrite('assets');

  protected readonly types: MaintenanceType[] = ['preventive', 'condition_based', 'predictive', 'calibration'];
  protected readonly triggers: MaintenanceTrigger[] = ['time', 'meter', 'time_or_meter'];
  protected readonly conditions: AssetCondition[] = ['new', 'excellent', 'good', 'fair', 'poor', 'damaged'];

  /** Maintenance plans: paging, sorting, filters and grouping run on the API. */
  protected readonly plansGrid = new FetchGridModel<MaintenancePlan>((query) => this.api.getMaintenancePlans(query));

  private readonly planTriggerTpl = viewChild<TemplateRef<{ $implicit: MaintenancePlan; value: unknown }>>('planTriggerTpl');
  private readonly planDueTpl = viewChild<TemplateRef<{ $implicit: MaintenancePlan; value: unknown }>>('planDueTpl');
  private readonly planCostTpl = viewChild<TemplateRef<{ $implicit: MaintenancePlan; value: unknown }>>('planCostTpl');
  private readonly planActiveTpl = viewChild<TemplateRef<{ $implicit: MaintenancePlan; value: unknown }>>('planActiveTpl');

  protected readonly planColumns = computed<TableColumnDef<MaintenancePlan>[]>(() => {
    this.i18n.currentLanguage();
    return [
      { key: 'plan_code', header: 'EA.CODE' },
      { key: 'name', header: 'EA.NAME' },
      {
        key: 'trigger_type',
        header: 'EA.TRIGGER',
        valueLabel: (value) => this.i18n.translate('EA.TRIGGER_' + value.toUpperCase()),
        valueGetter: (plan) => (plan.trigger_type ? this.i18n.translate('EA.TRIGGER_' + plan.trigger_type.toUpperCase()) : ''),
        customCellTemplate: this.planTriggerTpl(),
      },
      { key: 'next_due_date', header: 'EA.NEXT_DUE', customCellTemplate: this.planDueTpl() },
      { key: 'estimated_cost', header: 'EA.ESTIMATED_COST', align: 'right', customCellTemplate: this.planCostTpl() },
      {
        key: 'is_active',
        serverKey: 'activity',
        header: 'EA.STATUS',
        valueLabel: (value) => this.i18n.translate(value === 'active' ? 'EA.ACTIVE' : 'EA.INACTIVE'),
        valueGetter: (plan) => this.i18n.translate(plan.is_active ? 'EA.ACTIVE' : 'EA.INACTIVE'),
        customCellTemplate: this.planActiveTpl(),
      },
    ];
  });
  protected readonly assets = signal<FixedAssetResource[]>([]);
  protected readonly assetClasses = signal<AssetClass[]>([]);
  protected readonly duePlans = signal<MaintenancePlan[]>([]);
  protected readonly saving = signal(false);
  protected readonly planModalOpen = signal(false);
  protected readonly formErrors = signal<string[]>([]);
  protected readonly workOrder = signal<WorkOrderDetail | null>(null);
  protected readonly workOrderModal = signal<'detail' | 'complete' | 'cancel' | null>(null);
  protected cancelReason = '';
  protected stopsAsset = false;
  private editingPlanId: string | null = null;

  protected readonly planForm = this.fb.group({
    name: this.fb.control('', [Validators.required, Validators.maxLength(200)]),
    plan_code: this.fb.control('', [Validators.maxLength(60)]),
    asset_id: this.fb.control('', [(control: AbstractControl) => (control.parent?.get('asset_class_id')?.value || control.value ? null : { required: true })]),
    asset_class_id: this.fb.control(''),
    maintenance_type: this.fb.control<MaintenanceType>('preventive'),
    trigger_type: this.fb.control<MaintenanceTrigger>('time'),
    frequency_days: this.fb.control<number | null>(null, [Validators.min(1), Validators.max(3650)]),
    meter_code: this.fb.control('', [Validators.maxLength(40), Validators.pattern(/^[a-z0-9_]+$/)]),
    meter_interval_units: this.fb.control<number | null>(null, [Validators.min(0)]),
    lead_time_days: this.fb.control<number | null>(null, [Validators.min(0), Validators.max(365)]),
    estimated_cost: this.fb.control<number | null>(null, [Validators.min(0)]),
    next_due_date: this.fb.control(''),
    is_active: this.fb.control(true),
  });

  protected readonly completeForm = this.fb.group({
    downtime_hours: this.fb.control<number | null>(null, [Validators.min(0)]),
    labor_cost: this.fb.control<number | null>(null, [Validators.min(0)]),
    parts_cost: this.fb.control<number | null>(null, [Validators.min(0)]),
    external_service_cost: this.fb.control<number | null>(null, [Validators.min(0)]),
    capitalize_as_upgrade: this.fb.control(false),
    condition_after_maintenance: this.fb.control<AssetCondition | null>(null),
    meter_reading: this.fb.control<number | null>(null, [Validators.min(0)]),
    resolution_notes: this.fb.control('', [Validators.maxLength(5000)]),
  });

  protected readonly partForm = this.fb.group({
    product_id: this.fb.control('', Validators.required),
    quantity: this.fb.control<number | null>(null, [Validators.required, Validators.min(0.0001)]),
  });

  /** `asset_id` is `required_without:asset_class_id`: a plan targets one asset or a whole class. */
  private readonly assetRuleSync = this.planForm.controls.asset_class_id.valueChanges
    .pipe(takeUntilDestroyed())
    .subscribe(() => this.planForm.controls.asset_id.updateValueAndValidity());

  private readonly meterValidatorSync = this.planForm.controls.trigger_type.valueChanges
    .pipe(takeUntilDestroyed())
    .subscribe(() => this.syncMeterValidators());

  protected meterRequired(): boolean {
    const trigger = this.planForm.controls.trigger_type.value;
    return trigger === 'meter' || trigger === 'time_or_meter';
  }

  private syncMeterValidators(): void {
    const required = this.meterRequired();
    for (const control of [this.planForm.controls.meter_code, this.planForm.controls.meter_interval_units]) {
      if (required) {
        control.addValidators(Validators.required);
      } else {
        control.removeValidators(Validators.required);
      }
      control.updateValueAndValidity({ emitEvent: false });
    }
  }

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.plansGrid.reload();
    this.api.getDueMaintenancePlans().subscribe({ next: (res) => this.duePlans.set(res.data ?? []) });
  }

  protected openPlanModal(plan: MaintenancePlan | null): void {
    this.editingPlanId = plan?.id ?? null;
    this.formErrors.set([]);
    this.loadPlanTargets();
    this.planForm.reset({
      name: plan?.name ?? '',
      plan_code: plan?.plan_code ?? '',
      asset_id: plan?.asset_id ?? '',
      asset_class_id: plan?.asset_class_id ?? '',
      maintenance_type: plan?.maintenance_type ?? 'preventive',
      trigger_type: plan?.trigger_type ?? 'time',
      frequency_days: plan?.frequency_days ?? null,
      meter_code: plan?.meter_code ?? '',
      meter_interval_units: plan?.meter_interval_units ? Number(plan.meter_interval_units) : null,
      lead_time_days: plan?.lead_time_days ?? null,
      estimated_cost: plan?.estimated_cost ? Number(plan.estimated_cost) : null,
      next_due_date: plan?.next_due_date ?? '',
      is_active: plan?.is_active ?? true,
    });
    this.planModalOpen.set(true);
  }

  private loadPlanTargets(): void {
    this.assetApi.getAssets({ per_page: 100 }).subscribe({ next: (res) => this.assets.set(res.data ?? []), error: () => this.assets.set([]) });
    this.api.getAssetClasses().subscribe({ next: (res) => this.assetClasses.set(res.data ?? []), error: () => this.assetClasses.set([]) });
  }

  protected savePlan(): void {
    this.syncMeterValidators();
    if (this.planForm.invalid) {
      this.planForm.markAllAsTouched();
      return;
    }
    const value = this.planForm.getRawValue();
    const payload: MaintenancePlanPayload = {
      ...value,
      plan_code: value.plan_code || null,
      asset_id: value.asset_id || null,
      asset_class_id: value.asset_class_id || null,
      meter_code: value.meter_code || null,
      next_due_date: value.next_due_date || null,
    };
    const id = this.editingPlanId;
    this.saving.set(true);
    (id ? this.api.updateMaintenancePlan(id, payload) : this.api.createMaintenancePlan(payload)).subscribe({
      next: () => {
        this.saving.set(false);
        this.planModalOpen.set(false);
        this.load();
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.formErrors.set(applyServerErrors(this.planForm, err));
      },
    });
  }

  protected openWorkOrderFromPlan(plan: MaintenancePlan): void {
    this.api.openPlanWorkOrder(plan.id).subscribe({
      next: (res) => {
        this.message.success(this.i18n.translate('EA.WORK_ORDER_OPENED'));
        this.showWorkOrder(res.data.id);
        this.load();
      },
    });
  }

  protected showWorkOrder(id: string): void {
    this.api.getWorkOrder(id).subscribe({
      next: (res) => {
        this.workOrder.set(res);
        this.workOrderModal.set('detail');
      },
    });
  }

  protected startWorkOrder(order: WorkOrder): void {
    this.api.startWorkOrder(order.id, this.stopsAsset).subscribe({ next: () => this.showWorkOrder(order.id) });
  }

  protected addPart(order: WorkOrder): void {
    if (this.partForm.invalid) {
      this.partForm.markAllAsTouched();
      return;
    }
    const value = this.partForm.getRawValue();
    this.api.issueWorkOrderPart(order.id, { product_id: value.product_id, quantity: value.quantity ?? 0 }).subscribe({
      next: () => {
        this.partForm.reset();
        this.showWorkOrder(order.id);
      },
    });
  }

  protected openComplete(): void {
    this.completeForm.reset({ capitalize_as_upgrade: false });
    this.workOrderModal.set('complete');
  }

  protected completeWorkOrder(order: WorkOrder): void {
    if (this.completeForm.invalid) {
      this.completeForm.markAllAsTouched();
      return;
    }
    const value = this.completeForm.getRawValue();
    this.api.completeWorkOrder(order.id, { ...value, resolution_notes: value.resolution_notes || null }).subscribe({
      next: () => {
        this.message.success(this.i18n.translate('EA.WORK_ORDER_COMPLETED'));
        this.showWorkOrder(order.id);
        this.load();
      },
    });
  }

  protected cancelWorkOrder(order: WorkOrder): void {
    this.api.cancelWorkOrder(order.id, this.cancelReason || null).subscribe({
      next: () => {
        this.workOrderModal.set(null);
        this.workOrder.set(null);
        this.load();
      },
    });
  }
}
