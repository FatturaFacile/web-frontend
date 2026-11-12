import { DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import {
  AbstractControl,
  FormArray,
  FormsModule,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzDividerModule } from 'ng-zorro-antd/divider';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule, NzModalService } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzTableModule, NzTableQueryParams } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  AuthStore,
  CreatePurchaseOrderPayload,
  ExecuteThreeWayMatchPayload,
  GoodsReceipt,
  InspectGoodsReceiptPayload,
  ProcessGoodsReceiptPayload,
  ProcurementApiService,
  ProcurementSupplier,
  PurchaseOrder,
  PurchaseOrderStatus,
  SupplierInvoice,
  ThreeWayMatchLog,
  TranslateService,
} from '@core';
import { MoneyPipe, PageHeaderComponent, TranslatePipe } from '@shared';
import { apiErrorText } from '../sales/cycle/shared/sales-api-helpers';
import { notInPast } from '@shared/utils/date-validators';
import { validationTipKey } from '@shared/utils/validation-tip';

/** Approval states of a supplier invoice in which it cannot be paid (the API refuses the payment too). */
const PAYMENT_BLOCKING_APPROVALS: readonly string[] = ['pending', 'in_approval', 'rejected', 'match_blocked'];
/** Match results that leave a variance to approve. */
const OPEN_MATCH_VARIANCES: readonly string[] = [
  'price_variance',
  'quantity_variance',
  'discrepancy',
  'escalated_to_workflow',
];

/** A decision that needs a free-text reason before it is sent (reject an order, approve a match variance). */
interface ReasonRequest {
  kind: 'rejectOrder' | 'approveVariance';
  id: string;
  title: string;
}

/** Local calendar day as YYYY-MM-DD. */
function toIsoDay(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function receiptLineGroup(fb: NonNullableFormBuilder, lineId: string) {
  return fb.group({
    purchase_order_line_id: fb.control(lineId),
    quantity_received: fb.control<number | null>(null, [Validators.min(0)]),
    lot_number: fb.control('', [Validators.maxLength(100)]),
  });
}

function inspectLineGroup(fb: NonNullableFormBuilder, lineId: string, quantity: number) {
  return fb.group({
    purchase_receipt_line_id: fb.control(lineId),
    quantity_released: fb.control(quantity, [Validators.required, Validators.min(0)]),
    notes: fb.control(''),
  });
}

@Component({
  selector: 'app-purchases',
  styleUrl: './purchases.component.scss',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    DatePipe,
    MoneyPipe,
    NzCardModule,
    NzTableModule,
    NzTagModule,
    NzButtonModule,
    NzGridModule,
    NzStatisticModule,
    NzInputModule,
    NzInputNumberModule,
    NzSelectModule,
    NzDatePickerModule,
    NzFormModule,
    NzModalModule,
    NzIconModule,
    NzEmptyModule,
    NzTabsModule,
    NzDividerModule,
    PageHeaderComponent,
    TranslatePipe,
  ],
  templateUrl: './purchases.component.html',
})
export class PurchasesComponent implements OnInit {
  protected readonly authStore = inject(AuthStore);
  private readonly procurementApi = inject(ProcurementApiService);
  private readonly message = inject(NzMessageService);
  private readonly modal = inject(NzModalService);
  private readonly translate = inject(TranslateService);
  private readonly fb = inject(NonNullableFormBuilder);

  /** The error text of a control of the order, receipt or match forms. */
  tip(control: AbstractControl): string {
    const key = validationTipKey(control);
    return key ? this.translate.instant(key) : '';
  }

  readonly activeTabIndex = signal<number>(0);

  /** Statuses offered by the order filter, in lifecycle order. */
  protected readonly orderStatuses: readonly PurchaseOrderStatus[] = [
    'draft',
    'pending_approval',
    'approved',
    'sent',
    'partially_received',
    'received',
    'closed',
    'rejected',
    'cancelled',
  ];

  // --- Purchase Orders State ---
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly orders = signal<PurchaseOrder[]>([]);
  readonly total = signal(0);
  readonly pageIndex = signal(1);
  readonly pageSize = signal(10);
  readonly selectedStatus = signal<PurchaseOrderStatus | undefined>(undefined);
  readonly selectedSupplier = signal<string | undefined>(undefined);
  readonly createModalVisible = signal(false);
  readonly suppliers = signal<ProcurementSupplier[]>([]);
  readonly supplierNames = computed(
    () => new Map(this.suppliers().map((supplier) => [supplier.id, supplier.company_name])),
  );

  // --- Goods Receipts State ---
  readonly goodsReceipts = signal<GoodsReceipt[]>([]);
  readonly loadingReceipts = signal(false);
  readonly goodsReceiptModalVisible = signal(false);
  readonly selectedOrderForReceipt = signal<PurchaseOrder | null>(null);
  readonly inspectModalVisible = signal(false);
  readonly selectedReceipt = signal<GoodsReceipt | null>(null);

  // --- Three-Way Match State ---
  readonly threeWayMatches = signal<ThreeWayMatchLog[]>([]);
  readonly loadingMatches = signal(false);
  readonly executeMatchModalVisible = signal(false);

  // --- Supplier Invoices State ---
  readonly supplierInvoices = signal<SupplierInvoice[]>([]);
  readonly loadingInvoices = signal(false);
  readonly importSdiModalVisible = signal(false);
  readonly selectedXmlFile = signal<File | null>(null);

  // --- Reason dialog (reject an order, approve a match variance) ---
  readonly reasonRequest = signal<ReasonRequest | null>(null);
  readonly reasonText = signal('');

  // KPIs: counts only, the amounts are decimal strings and are shown per row
  readonly pendingApprovalCount = computed(() => this.orders().filter((o) => o.status === 'pending_approval').length);
  readonly openMatchVarianceCount = computed(
    () => this.threeWayMatches().filter((m) => OPEN_MATCH_VARIANCES.includes(m.match_status)).length,
  );
  readonly blockedInvoiceCount = computed(
    () => this.supplierInvoices().filter((i) => i.approval_status === 'match_blocked').length,
  );

  // Forms
  readonly orderForm = this.fb.group({
    supplier_id: this.fb.control('', [Validators.required]),
    currency: this.fb.control<'CHF' | 'EUR'>('EUR'),
    // The order date is today and the API requires expected_delivery_date >= order_date.
    expected_delivery_date: this.fb.control<Date | null>(null, [Validators.required, notInPast]),
    item_description: this.fb.control('', [Validators.required, Validators.maxLength(255)]),
    quantity: this.fb.control(1, [Validators.required, Validators.min(0.0001)]),
    unit_price: this.fb.control(0, [Validators.required, Validators.min(0)]),
    tax_rate: this.fb.control(22, [Validators.required, Validators.min(0), Validators.max(100)]),
  });

  readonly receiptForm = this.fb.group({
    supplier_delivery_note_ref: this.fb.control('', [Validators.required, Validators.maxLength(100)]),
    received_date: this.fb.control(toIsoDay(new Date()), [Validators.required]),
    inspection_required: this.fb.control(false),
    notes: this.fb.control('', [Validators.maxLength(2000)]),
    lines: this.fb.array<ReturnType<typeof receiptLineGroup>>([]),
  });

  readonly inspectForm = this.fb.group({
    lines: this.fb.array<ReturnType<typeof inspectLineGroup>>([]),
  });

  readonly matchForm = this.fb.group({
    purchase_order_id: this.fb.control('', [Validators.required]),
    purchase_receipt_id: this.fb.control('', [Validators.required]),
    passive_invoice_id: this.fb.control('', [Validators.required]),
    invoice_total_amount: this.fb.control(0, [Validators.required, Validators.min(0.01)]),
  });

  get receiptLines(): FormArray {
    return this.receiptForm.controls.lines;
  }

  get inspectLines(): FormArray {
    return this.inspectForm.controls.lines;
  }

  ngOnInit(): void {
    this.loadSuppliers();
    this.loadOrders();
    this.loadGoodsReceipts();
    this.loadThreeWayMatches();
    this.loadSupplierInvoices();
  }

  // --- Purchase Orders Methods ---

  loadSuppliers(): void {
    this.procurementApi.getSuppliers({ per_page: 100 }).subscribe({
      next: (res) => this.suppliers.set(res.data || []),
      error: () => this.suppliers.set([]),
    });
  }

  loadOrders(): void {
    this.loading.set(true);
    this.procurementApi
      .getPurchaseOrders({
        page: this.pageIndex(),
        per_page: this.pageSize(),
        status: this.selectedStatus(),
        supplier_id: this.selectedSupplier(),
      })
      .subscribe({
        next: (res) => {
          this.orders.set(res.data || []);
          this.total.set(res.meta?.total || (res.data || []).length);
          this.loading.set(false);
        },
        error: () => {
          this.orders.set([]);
          this.total.set(0);
          this.loading.set(false);
        },
      });
  }

  onQueryParamsChange(params: NzTableQueryParams): void {
    this.pageIndex.set(params.pageIndex);
    this.pageSize.set(params.pageSize);
    this.loadOrders();
  }

  onSupplierChange(supplierId: string | undefined): void {
    this.selectedSupplier.set(supplierId);
    this.pageIndex.set(1);
    this.loadOrders();
  }

  onStatusChange(status: PurchaseOrderStatus | undefined): void {
    this.selectedStatus.set(status);
    this.pageIndex.set(1);
    this.loadOrders();
  }

  supplierName(order: PurchaseOrder): string {
    return order.supplier?.company_name || this.supplierNames().get(order.supplier_id) || order.supplier_id;
  }

  /** Runs an order action and refreshes the list; 403/409/422 show the reason given by the API. */
  private runOrderAction(request$: ReturnType<ProcurementApiService['sendPurchaseOrder']>, successKey: string, order: PurchaseOrder): void {
    request$.subscribe({
      next: () => {
        this.message.success(this.translate.instant(successKey, { number: order.po_number }));
        this.loadOrders();
      },
      error: (err) => this.message.error(apiErrorText(err) || this.translate.instant('common.errors.generic')),
    });
  }

  submitApproval(order: PurchaseOrder): void {
    this.runOrderAction(this.procurementApi.submitApproval(order.id), 'purchases.messages.submitted', order);
  }

  approve(order: PurchaseOrder): void {
    this.runOrderAction(this.procurementApi.approvePurchaseOrder(order.id), 'purchases.messages.approved', order);
  }

  reject(order: PurchaseOrder): void {
    this.askReason({ kind: 'rejectOrder', id: order.id, title: order.po_number });
  }

  sendToSupplier(order: PurchaseOrder): void {
    this.runOrderAction(this.procurementApi.sendPurchaseOrder(order.id), 'purchases.messages.sent', order);
  }

  closeOrder(order: PurchaseOrder): void {
    this.runOrderAction(this.procurementApi.closePurchaseOrder(order.id), 'purchases.messages.closed', order);
  }

  reopenOrder(order: PurchaseOrder): void {
    this.runOrderAction(this.procurementApi.reopenPurchaseOrder(order.id), 'purchases.messages.reopened', order);
  }

  cancelOrder(order: PurchaseOrder): void {
    this.modal.confirm({
      nzTitle: this.translate.instant('PURCHASES.DLG_ANNULLARE_L_ORDINE', { po_number: order.po_number }),
      nzOkText: this.translate.instant('PURCHASES.DLG_ANNULLA_ORDINE'),
      nzOkDanger: true,
      nzCancelText: this.translate.instant('PURCHASES.DLG_CHIUDI'),
      nzOnOk: () => {
        this.runOrderAction(this.procurementApi.cancelPurchaseOrder(order.id), 'purchases.messages.cancelled', order);
      },
    });
  }

  /** Whether goods can still be received against the order. */
  canReceive(order: PurchaseOrder): boolean {
    return order.status === 'sent' || order.status === 'partially_received';
  }

  canCancel(order: PurchaseOrder): boolean {
    return ['draft', 'pending_approval', 'approved', 'sent'].includes(order.status);
  }

  openCreateModal(): void {
    this.orderForm.reset({
      supplier_id: '',
      currency: this.authStore.activeCurrency() === 'CHF' ? 'CHF' : 'EUR',
      expected_delivery_date: null,
      item_description: '',
      quantity: 1,
      unit_price: 0,
      tax_rate: this.authStore.activeJurisdiction() === 'CH' ? 8.1 : 22,
    });
    this.createModalVisible.set(true);
  }

  submitCreateOrder(): void {
    if (this.orderForm.invalid) {
      this.orderForm.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    const formVal = this.orderForm.getRawValue();
    const payload: CreatePurchaseOrderPayload = {
      supplier_id: formVal.supplier_id,
      currency: formVal.currency,
      order_date: toIsoDay(new Date()),
      expected_delivery_date: toIsoDay(formVal.expected_delivery_date ?? new Date()),
      lines: [
        {
          description: formVal.item_description,
          quantity_ordered: formVal.quantity,
          unit_price: formVal.unit_price,
          tax_rate: formVal.tax_rate,
        },
      ],
    };

    this.procurementApi.createPurchaseOrder(payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.createModalVisible.set(false);
        this.message.success(this.translate.instant('purchases.messages.created'));
        this.loadOrders();
      },
      error: (err) => {
        this.saving.set(false);
        this.message.error(apiErrorText(err) || this.translate.instant('common.errors.generic'));
      },
    });
  }

  // --- Goods Receipts Methods ---

  loadGoodsReceipts(): void {
    this.loadingReceipts.set(true);
    this.procurementApi.getGoodsReceipts().subscribe({
      next: (res) => {
        this.goodsReceipts.set(res.data || []);
        this.loadingReceipts.set(false);
      },
      error: () => {
        this.goodsReceipts.set([]);
        this.loadingReceipts.set(false);
      },
    });
  }

  /** Loads the order with its lines, then opens the receipt form with one row per line. */
  openGoodsReceiptModal(order: PurchaseOrder): void {
    this.procurementApi.getPurchaseOrder(order.id).subscribe({
      next: (res) => {
        const detail = res.data;
        this.selectedOrderForReceipt.set(detail);
        this.receiptForm.reset({
          supplier_delivery_note_ref: '',
          received_date: toIsoDay(new Date()),
          inspection_required: false,
          notes: '',
        });
        this.receiptLines.clear();
        for (const line of (detail.lines ?? []).filter((l) => !l.is_closed)) {
          this.receiptLines.push(receiptLineGroup(this.fb, line.id));
        }
        this.goodsReceiptModalVisible.set(true);
      },
      error: (err) => this.message.error(apiErrorText(err) || this.translate.instant('common.errors.generic')),
    });
  }

  /** Lines of the order being received, in the same order as the form rows. */
  readonly receiptOrderLines = computed(() => (this.selectedOrderForReceipt()?.lines ?? []).filter((l) => !l.is_closed));

  submitGoodsReceipt(): void {
    const order = this.selectedOrderForReceipt();
    if (this.receiptForm.invalid || !order) {
      this.receiptForm.markAllAsTouched();
      return;
    }

    const formVal = this.receiptForm.getRawValue();
    const lines = formVal.lines
      .filter((line) => (line.quantity_received ?? 0) > 0)
      .map((line) => ({
        purchase_order_line_id: line.purchase_order_line_id,
        quantity_received: line.quantity_received as number,
        lot_number: line.lot_number || undefined,
      }));
    if (lines.length === 0) {
      this.message.warning(this.translate.instant('PURCHASES.RECEIPT_NO_QUANTITY'));
      return;
    }

    const payload: ProcessGoodsReceiptPayload = {
      supplier_delivery_note_ref: formVal.supplier_delivery_note_ref,
      received_date: formVal.received_date,
      inspection_required: formVal.inspection_required,
      notes: formVal.notes || undefined,
      lines,
    };

    this.saving.set(true);
    this.procurementApi.processGoodsReceipt(order.id, payload).subscribe({
      next: (res) => {
        this.saving.set(false);
        this.goodsReceiptModalVisible.set(false);
        this.message.success(this.translate.instant('PURCHASES.MSG_BOLLA_DI_RICEZIONE_REGISTRATA_CON_SUCCESSO', { value: res.data.receipt_number || this.translate.instant('PURCHASES.MSG_CREATA') }));
        this.loadOrders();
        this.loadGoodsReceipts();
      },
      error: (err) => {
        this.saving.set(false);
        this.message.error(apiErrorText(err) || this.translate.instant('PURCHASES.MSG_ERRORE_DURANTE_LA_REGISTRAZIONE_DELLA_RICEZIONE'));
      },
    });
  }

  /** Inspection is recorded per line: the quantity released to stock. */
  openInspectModal(receipt: GoodsReceipt): void {
    this.procurementApi.getGoodsReceipt(receipt.id).subscribe({
      next: (res) => {
        const detail = res.data;
        this.selectedReceipt.set(detail);
        this.inspectLines.clear();
        for (const line of detail.lines ?? []) {
          this.inspectLines.push(inspectLineGroup(this.fb, line.id, Number(line.quantity_accepted)));
        }
        this.inspectModalVisible.set(true);
      },
      error: (err) => this.message.error(apiErrorText(err) || this.translate.instant('common.errors.generic')),
    });
  }

  submitInspection(): void {
    const receipt = this.selectedReceipt();
    if (!receipt || this.inspectForm.invalid) {
      return;
    }

    const payload: InspectGoodsReceiptPayload = {
      results: this.inspectForm.getRawValue().lines.map((line) => ({
        purchase_receipt_line_id: line.purchase_receipt_line_id,
        quantity_released: line.quantity_released,
        notes: line.notes || undefined,
      })),
    };
    this.procurementApi.inspectGoodsReceipt(receipt.id, payload).subscribe({
      next: () => {
        this.inspectModalVisible.set(false);
        this.message.success(this.translate.instant('PURCHASES.MSG_ISPEZIONE_AGGIORNATA_CON_SUCCESSO'));
        this.loadGoodsReceipts();
      },
      error: (err) => this.message.error(apiErrorText(err) || this.translate.instant('PURCHASES.MSG_ERRORE_DURANTE_L_AGGIORNAMENTO_DELL_ISPEZIONE')),
    });
  }

  // --- Three-Way Match Methods ---

  loadThreeWayMatches(): void {
    this.loadingMatches.set(true);
    this.procurementApi.getThreeWayMatches().subscribe({
      next: (res) => {
        this.threeWayMatches.set(res.data || []);
        this.loadingMatches.set(false);
      },
      error: () => {
        this.threeWayMatches.set([]);
        this.loadingMatches.set(false);
      },
    });
  }

  openExecuteMatchModal(): void {
    this.matchForm.reset({
      purchase_order_id: '',
      purchase_receipt_id: '',
      passive_invoice_id: '',
      invoice_total_amount: 0,
    });
    this.executeMatchModalVisible.set(true);
  }

  submitExecuteMatch(): void {
    if (this.matchForm.invalid) {
      this.matchForm.markAllAsTouched();
      return;
    }

    const payload: ExecuteThreeWayMatchPayload = this.matchForm.getRawValue();
    this.procurementApi.executeThreeWayMatch(payload).subscribe({
      next: (res) => {
        this.executeMatchModalVisible.set(false);
        this.message.success(this.translate.instant('PURCHASES.MSG_3_WAY_MATCH_COMPLETATO_STATO', { match_status: res.data.match_status }));
        this.loadThreeWayMatches();
        this.loadSupplierInvoices();
      },
      error: (err) => this.message.error(apiErrorText(err) || this.translate.instant('PURCHASES.MSG_ERRORE_DURANTE_L_ESECUZIONE_DEL_3')),
    });
  }

  hasOpenVariance(match: ThreeWayMatchLog): boolean {
    return OPEN_MATCH_VARIANCES.includes(match.match_status);
  }

  approveVariance(match: ThreeWayMatchLog): void {
    this.askReason({ kind: 'approveVariance', id: match.id, title: match.id });
  }

  // --- Reason dialog ---

  private askReason(request: ReasonRequest): void {
    this.reasonText.set('');
    this.reasonRequest.set(request);
  }

  confirmReason(): void {
    const request = this.reasonRequest();
    const reason = this.reasonText().trim();
    if (!request || !reason) {
      return;
    }

    this.saving.set(true);
    const done = (successKey: string, reload: () => void) => ({
      next: () => {
        this.saving.set(false);
        this.reasonRequest.set(null);
        this.message.success(this.translate.instant(successKey, { number: request.title }));
        reload();
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.message.error(apiErrorText(err) || this.translate.instant('common.errors.generic'));
      },
    });

    if (request.kind === 'rejectOrder') {
      this.procurementApi
        .rejectPurchaseOrder(request.id, reason)
        .subscribe(done('purchases.messages.rejected', () => this.loadOrders()));
    } else {
      this.procurementApi.approveThreeWayMatchVariance(request.id, { reason }).subscribe(
        done('purchases.messages.varianceApproved', () => {
          this.loadThreeWayMatches();
          this.loadSupplierInvoices();
        }),
      );
    }
  }

  // --- Supplier Invoices (AP) Methods ---

  loadSupplierInvoices(): void {
    this.loadingInvoices.set(true);
    this.procurementApi.getSupplierInvoices().subscribe({
      next: (res) => {
        this.supplierInvoices.set(res.data || []);
        this.loadingInvoices.set(false);
      },
      error: () => {
        this.supplierInvoices.set([]);
        this.loadingInvoices.set(false);
      },
    });
  }

  invoiceSupplierName(invoice: SupplierInvoice): string {
    return (invoice.supplier_id && this.supplierNames().get(invoice.supplier_id)) || invoice.supplier_id || '-';
  }

  isPaymentBlocked(invoice: SupplierInvoice): boolean {
    return PAYMENT_BLOCKING_APPROVALS.includes(invoice.approval_status ?? '');
  }

  canSubmitInvoiceApproval(invoice: SupplierInvoice): boolean {
    return invoice.payment_status !== 'paid' && ['not_required', 'rejected', ''].includes(invoice.approval_status ?? '');
  }

  submitInvoiceApproval(invoice: SupplierInvoice): void {
    this.procurementApi.submitSupplierInvoiceApproval(invoice.id).subscribe({
      next: () => {
        this.message.success(this.translate.instant('PURCHASES.INVOICE_SUBMITTED', { number: invoice.invoice_number }));
        this.loadSupplierInvoices();
      },
      error: (err) => this.message.error(apiErrorText(err) || this.translate.instant('common.errors.generic')),
    });
  }

  markInvoicePaid(invoice: SupplierInvoice): void {
    this.modal.confirm({
      nzTitle: this.translate.instant('PURCHASES.DLG_SEGNARE_LA_FATTURA_FORNITORE_COME_PAGATA', { invoice_number: invoice.invoice_number }),
      nzOkText: this.translate.instant('PURCHASES.DLG_CONFERMA_PAGAMENTO'),
      nzCancelText: this.translate.instant('PURCHASES.DLG_ANNULLA'),
      nzOnOk: () => {
        this.procurementApi.markSupplierInvoicePaid(invoice.id).subscribe({
          next: () => {
            this.message.success(this.translate.instant('PURCHASES.MSG_FATTURA_CONTRASSEGNATA_COME_PAGATA', { invoice_number: invoice.invoice_number }));
            this.loadSupplierInvoices();
          },
          error: (err) => this.message.error(apiErrorText(err) || this.translate.instant('common.errors.generic')),
        });
      },
    });
  }

  openImportSdiModal(): void {
    this.selectedXmlFile.set(null);
    this.importSdiModalVisible.set(true);
  }

  onXmlFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.selectedXmlFile.set(input.files?.item(0) ?? null);
  }

  submitImportSdi(): void {
    const file = this.selectedXmlFile();
    if (!file) {
      return;
    }

    this.saving.set(true);
    this.procurementApi.receivePassiveInvoiceXml(file).subscribe({
      next: (res) => {
        this.saving.set(false);
        this.importSdiModalVisible.set(false);
        const duplicates = (res.data || []).filter((entry) => entry.duplicate).length;
        this.message.success(
          this.translate.instant('PURCHASES.IMPORT_DONE', { count: (res.data || []).length - duplicates, duplicates }),
        );
        this.loadSupplierInvoices();
      },
      error: (err) => {
        this.saving.set(false);
        this.message.error(apiErrorText(err) || this.translate.instant('PURCHASES.MSG_ERRORE_DURANTE_L_IMPORTAZIONE_DEL_FILE'));
      },
    });
  }

  // Tag & Status helpers
  statusColor(status: PurchaseOrderStatus): string {
    switch (status) {
      case 'approved':
      case 'received':
        return 'success';
      case 'pending_approval':
        return 'warning';
      case 'sent':
      case 'partially_received':
        return 'blue';
      case 'rejected':
      case 'cancelled':
        return 'error';
      default:
        return 'default';
    }
  }

  statusLabel(status: PurchaseOrderStatus): string {
    return this.translate.instant('purchases.statuses.' + status);
  }

  inspectionColor(status: string | null): string {
    switch (status) {
      case 'passed':
        return 'success';
      case 'failed':
        return 'error';
      case 'conditional':
        return 'warning';
      default:
        return 'default';
    }
  }

  matchStatusColor(status: string): string {
    if (status === 'matched') {
      return 'success';
    }
    if (status === 'rejected') {
      return 'error';
    }
    return OPEN_MATCH_VARIANCES.includes(status) ? 'warning' : 'default';
  }

  approvalColor(status: string | null | undefined): string {
    switch (status) {
      case 'approved':
        return 'success';
      case 'pending':
      case 'in_approval':
        return 'processing';
      case 'rejected':
      case 'match_blocked':
        return 'error';
      default:
        return 'default';
    }
  }

  approvalLabel(status: string | null | undefined): string {
    return this.translate.instant('PURCHASES.APPROVAL.' + (status || 'not_required'));
  }
}
