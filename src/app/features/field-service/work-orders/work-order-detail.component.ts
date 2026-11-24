import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { applyServerErrors, FsmApiService, FsmWorkOrderDetail, FsmWorkOrderPart, I18nService, PermissionsService } from '@core';
import { downloadBlob, MoneyPipe, PageHeaderComponent, TranslatePipe } from '@shared';
import { SignReportModalComponent } from './sign-report-modal.component';
import { ProductSelectComponent } from '../components/product-select/product-select.component';
import { WORK_ORDER_STATUS_TAG_COLORS } from './field-work-orders.component';

const PART_STATUSES: ReadonlySet<string> = new Set(['dispatched', 'en_route', 'on_site']);
const RESULT_COLORS: Record<string, string> = { pass: 'green', fail: 'red', na: 'default' };

/** Quantity times unit price of a consumed part (a covered line is stored with a 0.00 unit price). */
export function partLineTotal(part: Pick<FsmWorkOrderPart, 'quantity' | 'unit_price'>): number {
  return Number(part.quantity) * Number(part.unit_price);
}

/**
 * Work order detail: journey status, part consumption with covered and chargeable lines kept apart, the signed
 * service report (viewer, PDF download) and the conversion of the report to an invoice.
 */
@Component({
  selector: 'app-work-order-detail',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzDescriptionsModule,
    NzFormModule,
    NzInputModule,
    NzInputNumberModule,
    NzModalModule,
    NzSpinModule,
    NzTableModule,
    NzTagModule,
    MoneyPipe,
    PageHeaderComponent,
    TranslatePipe,
    ProductSelectComponent,
    SignReportModalComponent,
  ],
  templateUrl: './work-order-detail.component.html',
  styleUrl: './work-order-detail.component.scss',
})
export class WorkOrderDetailComponent implements OnInit {
  private readonly api = inject(FsmApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly permissions = inject(PermissionsService);

  protected readonly canWrite = computed(() => this.permissions.canWrite('service'));
  protected readonly tagColors = WORK_ORDER_STATUS_TAG_COLORS;
  protected readonly resultColors = RESULT_COLORS;
  protected readonly lineTotal = partLineTotal;

  protected readonly order = signal<FsmWorkOrderDetail | null>(null);
  protected readonly loading = signal(false);
  protected readonly loadError = signal(false);
  protected readonly acting = signal(false);

  protected readonly report = computed(() => this.order()?.service_report ?? null);
  protected readonly currency = computed(() => this.report()?.billing.currency ?? 'EUR');
  protected readonly chargeableParts = computed(() => (this.order()?.parts ?? []).filter((p) => !p.covered));
  protected readonly coveredParts = computed(() => (this.order()?.parts ?? []).filter((p) => p.covered));
  protected readonly chargeableTotal = computed(() => this.chargeableParts().reduce((sum, p) => sum + partLineTotal(p), 0));
  protected readonly canRecordParts = computed(() => this.canWrite() && PART_STATUSES.has(this.order()?.status ?? ''));
  protected readonly nextStep = computed<'en_route' | 'on_site' | null>(() => {
    switch (this.order()?.status) {
      case 'dispatched':
        return 'en_route';
      case 'en_route':
        return 'on_site';
      default:
        return null;
    }
  });
  protected readonly billableTotal = computed(() => Number(this.report()?.billing.billable_total ?? 0));
  protected readonly canSign = computed(() => this.canWrite() && this.order()?.status === 'on_site' && !this.report());
  protected readonly canInvoice = computed(() => {
    const report = this.report();
    return this.canWrite() && !!report && !report.invoice_id && this.order()?.status === 'completed' && this.billableTotal() > 0;
  });
  /** One-call close (complete, resolve the ticket, settle) of an intervention still on site. */
  protected readonly canCompleteAndBill = computed(() => this.canWrite() && this.order()?.status === 'on_site');
  /** Signature drawing as an image data URI: an `<img>` never runs scripts, so the markup needs no sanitizer bypass. */
  protected readonly signatureSrc = computed(() => {
    const svg = this.report()?.signature_svg;
    return svg ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}` : null;
  });

  protected readonly partForm = this.fb.group({
    product_id: this.fb.control('', Validators.required),
    quantity: this.fb.control<number>(1, [Validators.required, Validators.min(0.01)]),
    unit_price: this.fb.control<number | null>(null, Validators.min(0)),
  });
  protected readonly partError = signal<string | null>(null);
  protected readonly partSaving = signal(false);

  protected readonly signOpen = signal(false);
  protected readonly invoiceOpen = signal(false);
  protected readonly invoiceSaving = signal(false);
  protected readonly invoiceError = signal<string | null>(null);
  protected readonly invoiceForm = this.fb.group({
    tax_rate: this.fb.control<number>(22, [Validators.required, Validators.min(0), Validators.max(100)]),
  });

  protected readonly settleOpen = signal(false);
  protected readonly settleSaving = signal(false);
  protected readonly settleError = signal<string | null>(null);
  protected readonly settleForm = this.fb.group({
    tax_rate: this.fb.control<number>(22, [Validators.required, Validators.min(0), Validators.max(100)]),
    completion_notes: this.fb.control('', Validators.maxLength(5000)),
    resolution_summary: this.fb.control('', Validators.maxLength(5000)),
    signed_by_customer_name: this.fb.control('', Validators.maxLength(150)),
    due_date: this.fb.control(''),
  });

  private id = '';

  ngOnInit(): void {
    this.id = this.route.snapshot.paramMap.get('id') ?? '';
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.loadError.set(false);
    this.api.getWorkOrder(this.id).subscribe({
      next: (res) => {
        this.order.set(res.data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.loadError.set(true);
      },
    });
  }

  protected advance(): void {
    const status = this.nextStep();
    if (!status || this.acting()) {
      return;
    }
    this.acting.set(true);
    this.api.advanceStatus(this.id, { status }).subscribe({
      next: () => {
        this.acting.set(false);
        this.message.success(this.i18n.translate('FSM.WO.STATUS_UPDATED'));
        this.load();
      },
      error: () => {
        this.acting.set(false);
        this.message.error(this.i18n.translate('FSM.WO.STATUS_FAILED'));
      },
    });
  }

  protected recordPart(): void {
    if (this.partForm.invalid || this.partSaving()) {
      this.partForm.markAllAsTouched();
      return;
    }
    const v = this.partForm.getRawValue();
    this.partSaving.set(true);
    this.partError.set(null);
    this.api
      .recordPart(this.id, {
        client_uuid: globalThis.crypto.randomUUID(),
        product_id: v.product_id,
        quantity: v.quantity,
        unit_price: v.unit_price,
      })
      .subscribe({
        next: (res) => {
          this.partSaving.set(false);
          this.partForm.reset({ product_id: '', quantity: 1, unit_price: null });
          this.message.success(
            this.i18n.translate(res.data.covered ? 'FSM.WO.PART_RECORDED_COVERED' : 'FSM.WO.PART_RECORDED_CHARGEABLE'),
          );
          this.load();
        },
        error: (error: unknown) => {
          this.partSaving.set(false);
          const messages = applyServerErrors(this.partForm, error);
          this.partError.set(messages[0] ?? this.i18n.translate('FSM.WO.PART_FAILED'));
        },
      });
  }

  protected downloadPdf(): void {
    const report = this.report();
    if (!report?.has_pdf) {
      return;
    }
    this.api.downloadReportPdf(report.id).subscribe({
      next: (blob) => downloadBlob(blob, `${report.report_number}.pdf`),
      error: () => this.message.error(this.i18n.translate('FSM.REPORT.PDF_FAILED')),
    });
  }

  protected openSign(): void {
    this.signOpen.set(true);
  }

  protected onSigned(): void {
    this.load();
  }

  protected openInvoice(): void {
    this.invoiceError.set(null);
    this.invoiceOpen.set(true);
  }

  protected openSettle(): void {
    this.settleError.set(null);
    this.settleOpen.set(true);
  }

  /** Completes the intervention and settles it (contract hours or invoice draft); the server makes a replay safe. */
  protected completeAndBill(): void {
    if (this.settleForm.invalid || this.settleSaving()) {
      this.settleForm.markAllAsTouched();
      return;
    }
    const v = this.settleForm.getRawValue();
    this.settleSaving.set(true);
    this.settleError.set(null);
    this.api
      .completeAndBill(this.id, {
        tax_rate: v.tax_rate,
        completion_notes: v.completion_notes || null,
        resolution_summary: v.resolution_summary || null,
        signed_by_customer_name: v.signed_by_customer_name || null,
        due_date: v.due_date || null,
      })
      .subscribe({
        next: (res) => {
          this.settleSaving.set(false);
          this.settleOpen.set(false);
          this.message.success(this.i18n.translate(`FSM.WO.SETTLED_${res.data.settlement.toUpperCase()}`));
          this.load();
        },
        error: (error: unknown) => {
          this.settleSaving.set(false);
          const messages = applyServerErrors(this.settleForm, error);
          this.settleError.set(messages[0] ?? this.i18n.translate('FSM.WO.SETTLE_FAILED'));
        },
      });
  }

  protected convertToInvoice(): void {
    const report = this.report();
    if (!report || this.invoiceForm.invalid || this.invoiceSaving()) {
      return;
    }
    this.invoiceSaving.set(true);
    this.invoiceError.set(null);
    this.api.invoiceReport(report.id, { tax_rate: this.invoiceForm.getRawValue().tax_rate }).subscribe({
      next: () => {
        this.invoiceSaving.set(false);
        this.invoiceOpen.set(false);
        this.message.success(this.i18n.translate('FSM.REPORT.INVOICED'));
        this.load();
      },
      error: (error: unknown) => {
        this.invoiceSaving.set(false);
        const messages = applyServerErrors(this.invoiceForm, error);
        this.invoiceError.set(messages[0] ?? this.i18n.translate('FSM.REPORT.INVOICE_FAILED'));
      },
    });
  }
}
