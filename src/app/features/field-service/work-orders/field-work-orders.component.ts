import { Component, computed, DestroyRef, inject, OnInit, signal, TemplateRef, viewChild } from '@angular/core';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule, NzModalService } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { map, Observable, tap } from 'rxjs';
import {
  applyServerErrors,
  ClientApiService,
  contactDisplayName,
  FetchGridModel,
  FieldServiceApiService,
  FieldWorkOrder,
  FieldWorkOrderListParams,
  FieldWorkOrderLineType,
  FieldWorkOrderPayload,
  I18nService,
  PaginatedResponse,
  PermissionsService,
  serverErrorMessage,
  SettingsApiService,
  UserResource,
} from '@core';
import { BaseTableComponent, IconActionDirective, ModalActionsDirective, MoneyPipe, PageHeaderComponent, TableColumnDef, TranslatePipe } from '@shared';
import { SignatureDialogComponent, SignatureResult } from '../components/signature-dialog/signature-dialog.component';
import { endsNotBefore, revalidateOnStartChange } from '@shared/utils/date-validators';
import { hasSharedRuleError, validationTipKey } from '@shared/utils/validation-tip';

const LINE_TYPES: readonly FieldWorkOrderLineType[] = ['labor', 'material', 'travel'];

interface ClientOption {
  value: string;
  label: string;
}

@Component({
  selector: 'app-field-work-orders',
  styleUrl: './field-work-orders.component.scss',
  imports: [
    ModalActionsDirective,
    IconActionDirective,
    FormsModule,
    ReactiveFormsModule,
    NzButtonModule,
    NzCardModule,
    NzFormModule,
    NzInputModule,
    NzInputNumberModule,
    NzModalModule,
    NzSelectModule,
    BaseTableComponent,
    NzTagModule,
    MoneyPipe,
    PageHeaderComponent,
    TranslatePipe,
    SignatureDialogComponent,
  ],
  templateUrl: './field-work-orders.component.html',
})
export class FieldWorkOrdersComponent implements OnInit {
  private readonly api = inject(FieldServiceApiService);
  private readonly clientApi = inject(ClientApiService);
  private readonly settingsApi = inject(SettingsApiService);
  private readonly message = inject(NzMessageService);
  private readonly modal = inject(NzModalService);
  private readonly i18n = inject(I18nService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly permissions = inject(PermissionsService);

  protected readonly canWrite = computed(() => this.permissions.canWrite('service'));
  /** Server-side grid. The list answers with the paginator nested in `data`: it is flattened to the standard envelope. */
  protected readonly grid = new FetchGridModel<FieldWorkOrder, FieldWorkOrderListParams>((query) =>
    this.api.getWorkOrders(query).pipe(
      tap({ error: () => this.message.error(this.i18n.translate('FS_WORK_ORDERS.LOAD_FAILED')) }),
      map(
        (res) =>
          ({
            ...res,
            data: res.data?.data ?? [],
            meta: {
              current_page: res.data?.current_page ?? 1,
              last_page: res.data?.last_page ?? 1,
              per_page: res.data?.per_page ?? 20,
              total: res.data?.total ?? 0,
            },
          }) as unknown as PaginatedResponse<FieldWorkOrder>,
      ),
    ),
  );
  protected readonly saving = signal(false);
  protected readonly clients = signal<ClientOption[]>([]);
  protected readonly technicians = signal<UserResource[]>([]);
  protected readonly lineTypes = LINE_TYPES;

  protected readonly formOpen = signal(false);
  protected readonly editingId = signal<string | null>(null);
  protected readonly signTarget = signal<FieldWorkOrder | null>(null);
  protected readonly signOpen = signal(false);

  protected readonly form = this.fb.group({
    client_id: this.fb.control('', Validators.required),
    ticket_id: this.fb.control(''),
    technician_user_id: this.fb.control(''),
    date: this.fb.control('', Validators.required),
    started_at: this.fb.control(''),
    ended_at: this.fb.control('', endsNotBefore('started_at')),
    intervention_address: this.fb.control('', Validators.maxLength(255)),
    notes: this.fb.control('', Validators.maxLength(5000)),
    lines: this.fb.array([this.newLine()]),
  });

  private readonly numberTpl = viewChild<TemplateRef<{ $implicit: FieldWorkOrder; value: unknown }>>('numberTpl');
  private readonly dateTpl = viewChild<TemplateRef<{ $implicit: FieldWorkOrder; value: unknown }>>('dateTpl');
  private readonly totalTpl = viewChild<TemplateRef<{ $implicit: FieldWorkOrder; value: unknown }>>('totalTpl');
  private readonly statusTpl = viewChild<TemplateRef<{ $implicit: FieldWorkOrder; value: unknown }>>('statusTpl');

  protected readonly columns = computed<TableColumnDef<FieldWorkOrder>[]>(() => [
    { key: 'work_order_number', header: 'FS_WORK_ORDERS.NUMBER', customCellTemplate: this.numberTpl() },
    { key: 'date', header: 'FS_WORK_ORDERS.DATE', customCellTemplate: this.dateTpl() },
    { key: 'intervention_address', header: 'FS_WORK_ORDERS.ADDRESS' },
    { key: 'labor_hours', header: 'FS_WORK_ORDERS.HOURS' },
    { key: 'total_amount', header: 'FS_WORK_ORDERS.TOTAL', customCellTemplate: this.totalTpl() },
    { key: 'status', header: 'COMMON.STATUS', customCellTemplate: this.statusTpl() },
  ]);

  constructor() {
    this.grid.setPageSize(20);
    // The API requires ended_at on or after started_at.
    revalidateOnStartChange(this.form, 'started_at', 'ended_at', inject(DestroyRef));
  }

  ngOnInit(): void {
    this.clientApi.list({ per_page: 200 }).subscribe({
      next: (res) =>
        this.clients.set(res.data.map((contact) => ({ value: contact.id, label: contactDisplayName(contact) }))),
      error: () => this.clients.set([]),
    });
    this.settingsApi.getTenantUsers().subscribe({
      next: (res) => this.technicians.set(res.data ?? []),
      error: () => this.technicians.set([]),
    });
  }

  protected get lines() {
    return this.form.controls.lines;
  }

  protected newLine() {
    return this.fb.group({
      type: this.fb.control<FieldWorkOrderLineType | ''>('labor'),
      description: this.fb.control('', [Validators.required, Validators.maxLength(1000)]),
      quantity: this.fb.control<number>(1, [Validators.required, Validators.min(0.01)]),
      unit_price: this.fb.control<number>(0, [Validators.required, Validators.min(0)]),
      tax_rate: this.fb.control<number>(22, [Validators.required, Validators.min(0), Validators.max(100)]),
    });
  }

  protected addLine(): void {
    this.lines.push(this.newLine());
  }

  protected removeLine(index: number): void {
    if (this.lines.length > 1) {
      this.lines.removeAt(index);
    }
  }

  protected openCreate(): void {
    this.editingId.set(null);
    this.form.reset({ date: '', client_id: '' });
    this.lines.clear();
    this.lines.push(this.newLine());
    this.formOpen.set(true);
  }

  protected openEdit(order: FieldWorkOrder): void {
    this.api.getWorkOrder(order.id).subscribe({
      next: (res) => {
        const data = res.data as FieldWorkOrder & { lines?: Record<string, unknown>[] };
        this.editingId.set(order.id);
        this.form.patchValue({
          client_id: data.client_id,
          ticket_id: data.ticket_id ?? '',
          technician_user_id: data.technician_user_id ?? '',
          date: data.date?.slice(0, 16) ?? '',
          started_at: data.started_at?.slice(0, 16) ?? '',
          ended_at: data.ended_at?.slice(0, 16) ?? '',
          intervention_address: data.intervention_address ?? '',
          notes: data.notes ?? '',
        });
        this.lines.clear();
        for (const line of data.lines ?? [{}]) {
          const group = this.newLine();
          group.patchValue({
            type: (line['type'] as FieldWorkOrderLineType | undefined) ?? 'labor',
            description: String(line['description'] ?? ''),
            quantity: Number(line['quantity'] ?? 1),
            unit_price: Number(line['unit_price'] ?? 0),
            tax_rate: Number(line['tax_rate'] ?? 22),
          });
          this.lines.push(group);
        }
        this.formOpen.set(true);
      },
      error: () => this.message.error(this.i18n.translate('FS_WORK_ORDERS.LOAD_FAILED')),
    });
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    const payload: FieldWorkOrderPayload = {
      client_id: value.client_id,
      ticket_id: value.ticket_id || null,
      technician_user_id: value.technician_user_id || null,
      date: value.date,
      started_at: value.started_at || null,
      ended_at: value.ended_at || null,
      intervention_address: value.intervention_address || null,
      notes: value.notes || null,
      lines: value.lines.map((line) => ({ ...line, type: line.type || null })),
    };
    const id = this.editingId();
    this.saving.set(true);
    (id ? this.api.updateWorkOrder(id, payload) : this.api.createWorkOrder(payload)).subscribe({
      next: () => {
        this.saving.set(false);
        this.formOpen.set(false);
        this.message.success(this.i18n.translate('FS_WORK_ORDERS.SAVED'));
        this.grid.reload();
      },
      error: (err: unknown) => {
        this.saving.set(false);
        applyServerErrors(this.form, err);
        this.message.error(this.i18n.translate('FS_WORK_ORDERS.ACTION_FAILED'));
      },
    });
  }

  protected fieldError(path: string): string | undefined {
    const control = this.form.get(path);
    if (control?.hasError('required')) {
      return this.i18n.translate('COMMON.VALIDATION.REQUIRED');
    }
    if (hasSharedRuleError(control ?? null)) {
      return this.i18n.translate(validationTipKey(control ?? null));
    }
    if (control?.hasError('maxlength')) {
      return this.i18n.translate('COMMON.VALIDATION.INVALID_VALUE');
    }
    return serverErrorMessage(this.form, path) ?? undefined;
  }

  protected complete(order: FieldWorkOrder): void {
    this.confirm('FS_WORK_ORDERS.COMPLETE_CONFIRM', order, () => this.api.completeWorkOrder(order.id));
  }

  protected invoice(order: FieldWorkOrder): void {
    this.confirm('FS_WORK_ORDERS.INVOICE_CONFIRM', order, () => this.api.invoiceWorkOrder(order.id));
  }

  protected openSign(order: FieldWorkOrder): void {
    this.signTarget.set(order);
    this.signOpen.set(true);
  }

  protected sign(result: SignatureResult): void {
    const order = this.signTarget();
    if (!order) {
      return;
    }
    this.saving.set(true);
    this.api.signWorkOrder(order.id, { signed_by: result.signerName, signature_base64: result.signature }).subscribe({
      next: () => {
        this.saving.set(false);
        this.signOpen.set(false);
        this.message.success(this.i18n.translate('FS_WORK_ORDERS.SIGNED'));
        this.grid.reload();
      },
      error: () => {
        this.saving.set(false);
        this.message.error(this.i18n.translate('FS_WORK_ORDERS.ACTION_FAILED'));
      },
    });
  }

  private confirm(titleKey: string, order: FieldWorkOrder, run: () => Observable<unknown>): void {
    this.modal.confirm({
      nzTitle: this.i18n.translate(titleKey, { number: order.work_order_number }),
      nzOkText: this.i18n.translate('RES.ACTION.CONFIRM'),
      nzCancelText: this.i18n.translate('COMMON.CANCEL'),
      nzOnOk: () =>
        run().subscribe({
          next: () => {
            this.message.success(this.i18n.translate('FS_WORK_ORDERS.DONE'));
            this.grid.reload();
          },
          error: () => this.message.error(this.i18n.translate('FS_WORK_ORDERS.ACTION_FAILED')),
        }),
    });
  }
}
