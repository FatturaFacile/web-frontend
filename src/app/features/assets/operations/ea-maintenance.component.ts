import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
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
  AssetCondition,
  EamOpsApiService,
  I18nService,
  MaintenancePlan,
  MaintenancePlanPayload,
  MaintenanceTrigger,
  MaintenanceType,
  PermissionsService,
  WorkOrder,
  WorkOrderDetail,
} from '@core';
import { MoneyPipe, TranslatePipe } from '@shared';

@Component({
  selector: 'app-ea-maintenance',
  imports: [
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
  ],
  templateUrl: './ea-maintenance.component.html',
})
export class EaMaintenanceComponent implements OnInit {
  private readonly api = inject(EamOpsApiService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  protected readonly canWrite = inject(PermissionsService).canWrite('assets');

  protected readonly types: MaintenanceType[] = ['preventive', 'condition_based', 'predictive', 'calibration'];
  protected readonly triggers: MaintenanceTrigger[] = ['time', 'meter', 'time_or_meter'];
  protected readonly conditions: AssetCondition[] = ['new', 'excellent', 'good', 'fair', 'poor', 'damaged'];

  protected readonly plans = signal<MaintenancePlan[]>([]);
  protected readonly duePlans = signal<MaintenancePlan[]>([]);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly planModalOpen = signal(false);
  protected readonly formErrors = signal<string[]>([]);
  protected readonly workOrder = signal<WorkOrderDetail | null>(null);
  protected readonly workOrderModal = signal<'detail' | 'complete' | 'cancel' | null>(null);
  protected cancelReason = '';
  protected stopsAsset = false;
  private editingPlanId: string | null = null;

  protected readonly planForm = this.fb.group({
    name: this.fb.control('', [Validators.required, Validators.maxLength(255)]),
    plan_code: this.fb.control(''),
    asset_id: this.fb.control(''),
    maintenance_type: this.fb.control<MaintenanceType>('preventive'),
    trigger_type: this.fb.control<MaintenanceTrigger>('time'),
    frequency_days: this.fb.control<number | null>(null),
    meter_code: this.fb.control(''),
    meter_interval_units: this.fb.control<number | null>(null),
    lead_time_days: this.fb.control<number | null>(null),
    estimated_cost: this.fb.control<number | null>(null),
    next_due_date: this.fb.control(''),
    is_active: this.fb.control(true),
  });

  protected readonly completeForm = this.fb.group({
    downtime_hours: this.fb.control<number | null>(null),
    labor_cost: this.fb.control<number | null>(null),
    parts_cost: this.fb.control<number | null>(null),
    external_service_cost: this.fb.control<number | null>(null),
    capitalize_as_upgrade: this.fb.control(false),
    condition_after_maintenance: this.fb.control<AssetCondition | null>(null),
    meter_reading: this.fb.control<number | null>(null),
    resolution_notes: this.fb.control(''),
  });

  protected readonly partForm = this.fb.group({
    product_id: this.fb.control('', Validators.required),
    quantity: this.fb.control<number | null>(null, [Validators.required, Validators.min(0.0001)]),
  });

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.api.getMaintenancePlans({ per_page: 50 }).subscribe({
      next: (res) => {
        this.plans.set(res.data ?? []);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
    this.api.getDueMaintenancePlans().subscribe({ next: (res) => this.duePlans.set(res.data ?? []) });
  }

  protected openPlanModal(plan: MaintenancePlan | null): void {
    this.editingPlanId = plan?.id ?? null;
    this.formErrors.set([]);
    this.planForm.reset({
      name: plan?.name ?? '',
      plan_code: plan?.plan_code ?? '',
      asset_id: plan?.asset_id ?? '',
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

  protected savePlan(): void {
    if (this.planForm.invalid) {
      this.planForm.markAllAsTouched();
      return;
    }
    const value = this.planForm.getRawValue();
    const payload: MaintenancePlanPayload = {
      ...value,
      plan_code: value.plan_code || null,
      asset_id: value.asset_id || null,
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
