import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  applyServerErrors,
  FSM_PRIORITIES,
  FSM_WORK_ORDER_STATUSES,
  FSM_WORK_ORDER_TYPES,
  FsmApiService,
  FsmEquipment,
  FsmMaintenanceContract,
  FsmPriority,
  FsmWorkOrder,
  FsmWorkOrderPayload,
  FsmWorkOrderStatus,
  FsmWorkOrderType,
  I18nService,
  PermissionsService,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { CustomerSelectComponent } from '../../warranty-rma/components/shared/customer-select.component';
import { ProductSelectComponent } from '../components/product-select/product-select.component';

export const WORK_ORDER_STATUS_TAG_COLORS: Record<string, string> = {
  unscheduled: 'default',
  dispatched: 'blue',
  en_route: 'orange',
  on_site: 'purple',
  completed: 'green',
  invoiced: 'cyan',
  cancelled: 'red',
};

function partGroup(fb: NonNullableFormBuilder) {
  return fb.group({
    product_id: fb.control('', Validators.required),
    quantity: fb.control<number>(1, [Validators.required, Validators.min(0.01)]),
  });
}

type PartGroup = ReturnType<typeof partGroup>;

/** Field work orders of the field service management (`/fsm/work-orders`): list, filters and creation. */
@Component({
  selector: 'app-field-work-orders',
  styleUrl: './field-work-orders.component.scss',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    RouterLink,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzFormModule,
    NzInputModule,
    NzInputNumberModule,
    NzModalModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
    CustomerSelectComponent,
    ProductSelectComponent,
    PageHeaderComponent,
    TranslatePipe,
  ],
  templateUrl: './field-work-orders.component.html',
})
export class FieldWorkOrdersComponent implements OnInit {
  private readonly api = inject(FsmApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly permissions = inject(PermissionsService);

  protected readonly canWrite = computed(() => this.permissions.canWrite('service'));
  protected readonly statuses = FSM_WORK_ORDER_STATUSES;
  protected readonly types = FSM_WORK_ORDER_TYPES;
  protected readonly priorities = FSM_PRIORITIES;
  protected readonly tagColors = WORK_ORDER_STATUS_TAG_COLORS;

  protected readonly orders = signal<FsmWorkOrder[]>([]);
  protected readonly loading = signal(false);
  protected readonly loadError = signal(false);
  protected readonly statusFilter = signal<FsmWorkOrderStatus | ''>('');
  protected readonly typeFilter = signal<FsmWorkOrderType | ''>('');

  protected readonly equipment = signal<FsmEquipment[]>([]);
  protected readonly contracts = signal<FsmMaintenanceContract[]>([]);
  protected readonly equipmentOptions = computed(() =>
    this.equipment().map((e) => ({ value: e.id, label: e.serial_number })),
  );
  protected readonly contractOptions = computed(() =>
    this.contracts().map((c) => ({ value: c.id, label: `${c.contract_number} - ${c.title}` })),
  );

  protected readonly formOpen = signal(false);
  protected readonly saving = signal(false);
  protected readonly formError = signal<string | null>(null);

  protected readonly form = this.fb.group({
    work_order_type: this.fb.control<FsmWorkOrderType>('corrective', Validators.required),
    customer_id: this.fb.control('', Validators.required),
    title: this.fb.control('', [Validators.required, Validators.maxLength(200)]),
    problem_description: this.fb.control('', Validators.maxLength(5000)),
    priority: this.fb.control<FsmPriority>('normal'),
    equipment_passport_id: this.fb.control<string | null>(null),
    service_contract_id: this.fb.control<string | null>(null),
    site_address: this.fb.control('', Validators.maxLength(255)),
    site_latitude: this.fb.control<number | null>(null, [Validators.min(-90), Validators.max(90)]),
    site_longitude: this.fb.control<number | null>(null, [Validators.min(-180), Validators.max(180)]),
    required_skills: this.fb.control<string[]>([]),
    internal_notes: this.fb.control('', Validators.maxLength(5000)),
    required_parts: this.fb.array<PartGroup>([]),
  });

  ngOnInit(): void {
    this.load();
    this.api.listEquipment().subscribe({ next: (res) => this.equipment.set(res.data), error: () => this.equipment.set([]) });
    this.api.listContracts().subscribe({ next: (res) => this.contracts.set(res.data), error: () => this.contracts.set([]) });
  }

  protected get parts() {
    return this.form.controls.required_parts;
  }

  protected newPart(): PartGroup {
    return partGroup(this.fb);
  }

  protected load(): void {
    this.loading.set(true);
    this.loadError.set(false);
    this.api.listWorkOrders({ status: this.statusFilter(), work_order_type: this.typeFilter() }).subscribe({
      next: (res) => {
        this.orders.set(res.data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.loadError.set(true);
      },
    });
  }

  protected setStatus(value: FsmWorkOrderStatus | null): void {
    this.statusFilter.set(value ?? '');
    this.load();
  }

  protected setType(value: FsmWorkOrderType | null): void {
    this.typeFilter.set(value ?? '');
    this.load();
  }

  protected addPart(): void {
    this.parts.push(this.newPart());
  }

  protected removePart(index: number): void {
    this.parts.removeAt(index);
  }

  protected openCreate(): void {
    this.form.reset({ work_order_type: 'corrective', priority: 'normal', required_skills: [] });
    this.parts.clear();
    this.formError.set(null);
    this.formOpen.set(true);
  }

  protected save(): void {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const payload: FsmWorkOrderPayload = {
      client_uuid: globalThis.crypto.randomUUID(),
      work_order_type: v.work_order_type,
      customer_id: v.customer_id,
      title: v.title,
      problem_description: v.problem_description || null,
      priority: v.priority,
      equipment_passport_id: v.equipment_passport_id,
      service_contract_id: v.service_contract_id,
      site_address: v.site_address || null,
      site_latitude: v.site_latitude,
      site_longitude: v.site_longitude,
      required_skills: v.required_skills,
      required_parts: v.required_parts.map((p) => ({ product_id: p.product_id, quantity: p.quantity })),
      internal_notes: v.internal_notes || null,
    };
    this.saving.set(true);
    this.formError.set(null);
    this.api.createWorkOrder(payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.formOpen.set(false);
        this.message.success(this.i18n.translate('FSM.WO.CREATED'));
        this.load();
      },
      error: (error: unknown) => {
        this.saving.set(false);
        const messages = applyServerErrors(this.form, error);
        this.formError.set(messages[0] ?? this.i18n.translate('FSM.WO.SAVE_FAILED'));
      },
    });
  }
}
