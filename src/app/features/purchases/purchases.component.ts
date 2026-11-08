import { DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import {
  FormsModule,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
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
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzDividerModule } from 'ng-zorro-antd/divider';
import {
  AuthStore,
  CreatePurchaseOrderPayload,
  ExecuteThreeWayMatchPayload,
  GoodsReceipt,
  GoodsReceiptInspectionStatus,
  ProcessGoodsReceiptPayload,
  ProcurementApiService,
  PurchaseOrder,
  PurchaseOrderStatus,
  SupplierInvoice,
  ThreeWayMatchLog,
  ThreeWayMatchStatus,
  TranslateService,
} from '@core';
import { MoneyPipe, PageHeaderComponent, TranslatePipe } from '@shared';

@Component({
  selector: 'app-purchases',
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
  styleUrl: './purchases.component.scss',
})
export class PurchasesComponent implements OnInit {
  protected readonly authStore = inject(AuthStore);
  private readonly procurementApi = inject(ProcurementApiService);
  private readonly message = inject(NzMessageService);
  private readonly modal = inject(NzModalService);
  private readonly translate = inject(TranslateService);
  private readonly fb = inject(NonNullableFormBuilder);

  // Active Tab
  readonly activeTabIndex = signal<number>(0);

  // --- Purchase Orders State ---
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly orders = signal<PurchaseOrder[]>([]);
  readonly total = signal(0);
  readonly pageIndex = signal(1);
  readonly pageSize = signal(10);
  readonly searchTerm = signal('');
  readonly selectedStatus = signal<PurchaseOrderStatus | undefined>(undefined);
  readonly createModalVisible = signal(false);

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

  // KPIs
  readonly totalChfDisplay = computed(() => {
    const sum = this.orders()
      .filter((o) => o.currency === 'CHF')
      .reduce((acc, o) => acc + (o.total || 0), 0);
    return `CHF ${sum.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  });

  readonly totalEurDisplay = computed(() => {
    const sum = this.orders()
      .filter((o) => o.currency === 'EUR')
      .reduce((acc, o) => acc + (o.total || 0), 0);
    return `€ ${sum.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  });

  // Forms
  readonly orderForm = this.fb.group({
    supplier_name: this.fb.control('', [Validators.required]),
    channel: this.fb.control<'SDI' | 'QR-Bill' | 'Standard'>('QR-Bill', [Validators.required]),
    currency: this.fb.control<'CHF' | 'EUR'>('CHF', [Validators.required]),
    item_description: this.fb.control('', [Validators.required]),
    quantity: this.fb.control(1, [Validators.required, Validators.min(1)]),
    unit_price: this.fb.control(0, [Validators.required, Validators.min(0)]),
    tax_rate: this.fb.control(22, [Validators.required]),
  });

  readonly receiptForm = this.fb.group({
    supplier_delivery_note_ref: this.fb.control('', [Validators.required]),
    received_date: this.fb.control(new Date().toISOString().slice(0, 10), [Validators.required]),
    inspection_required: this.fb.control(false),
    inspection_status: this.fb.control<GoodsReceiptInspectionStatus>('passed'),
    quantity_received: this.fb.control(1, [Validators.required, Validators.min(1)]),
    lot_number: this.fb.control(''),
    notes: this.fb.control(''),
  });

  readonly inspectForm = this.fb.group({
    inspection_status: this.fb.control<GoodsReceiptInspectionStatus>('passed', [Validators.required]),
    notes: this.fb.control(''),
  });

  readonly matchForm = this.fb.group({
    purchase_order_id: this.fb.control('', [Validators.required]),
    purchase_receipt_id: this.fb.control('', [Validators.required]),
    passive_invoice_id: this.fb.control('', [Validators.required]),
    invoice_total_amount: this.fb.control(0, [Validators.required, Validators.min(0.01)]),
  });

  readonly sdiImportForm = this.fb.group({
    xml_content: this.fb.control('', [Validators.required]),
  });

  ngOnInit(): void {
    this.loadOrders();
    this.loadGoodsReceipts();
    this.loadThreeWayMatches();
    this.loadSupplierInvoices();
  }

  // --- Purchase Orders Methods ---

  loadOrders(): void {
    this.loading.set(true);
    this.procurementApi
      .getPurchaseOrders({
        page: this.pageIndex(),
        per_page: this.pageSize(),
        search: this.searchTerm() || undefined,
        status: this.selectedStatus(),
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

  onSearch(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchTerm.set(value);
    this.pageIndex.set(1);
    this.loadOrders();
  }

  onStatusChange(status: PurchaseOrderStatus | undefined): void {
    this.selectedStatus.set(status);
    this.pageIndex.set(1);
    this.loadOrders();
  }

  submitApproval(order: PurchaseOrder): void {
    this.procurementApi.submitApproval(order.id).subscribe({
      next: () => {
        this.message.success(this.translate.instant('purchases.messages.submitted', { number: order.order_number }));
        this.loadOrders();
      },
    });
  }

  approve(order: PurchaseOrder): void {
    this.procurementApi.approvePurchaseOrder(order.id).subscribe({
      next: () => {
        this.message.success(this.translate.instant('purchases.messages.approved', { number: order.order_number }));
        this.loadOrders();
      },
    });
  }

  reject(order: PurchaseOrder): void {
    this.procurementApi.rejectPurchaseOrder(order.id, this.translate.instant('purchases.rejectReason')).subscribe({
      next: () => {
        this.message.success(this.translate.instant('purchases.messages.rejected', { number: order.order_number }));
        this.loadOrders();
      },
    });
  }

  sendToSupplier(order: PurchaseOrder): void {
    this.procurementApi.sendPurchaseOrder(order.id).subscribe({
      next: () => {
        this.message.success(`Ordine ${order.order_number} inviato al fornitore`);
        this.loadOrders();
      },
    });
  }

  cancelOrder(order: PurchaseOrder): void {
    this.modal.confirm({
      nzTitle: `Annullare l'ordine ${order.order_number}?`,
      nzOkText: 'Annulla Ordine',
      nzOkDanger: true,
      nzCancelText: 'Chiudi',
      nzOnOk: () => {
        this.procurementApi.cancelPurchaseOrder(order.id).subscribe({
          next: () => {
            this.message.success(`Ordine ${order.order_number} annullato`);
            this.loadOrders();
          },
        });
      },
    });
  }

  openCreateModal(): void {
    this.orderForm.reset({
      supplier_name: '',
      channel: this.authStore.activeJurisdiction() === 'CH' ? 'QR-Bill' : 'SDI',
      currency: this.authStore.activeCurrency(),
      item_description: '',
      quantity: 1,
      unit_price: 0,
      tax_rate: 22,
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
      supplier_id: 'sup-' + Date.now(),
      supplier_name: formVal.supplier_name,
      channel: formVal.channel,
      currency: formVal.currency,
      issue_date: new Date().toISOString().slice(0, 10),
      items: [
        {
          description: formVal.item_description,
          quantity: formVal.quantity,
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
      error: () => {
        this.saving.set(false);
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

  openGoodsReceiptModal(order: PurchaseOrder): void {
    this.selectedOrderForReceipt.set(order);
    this.receiptForm.reset({
      supplier_delivery_note_ref: '',
      received_date: new Date().toISOString().slice(0, 10),
      inspection_required: false,
      inspection_status: 'passed',
      quantity_received: order.items?.[0]?.quantity || 1,
      lot_number: '',
      notes: '',
    });
    this.goodsReceiptModalVisible.set(true);
  }

  submitGoodsReceipt(): void {
    if (this.receiptForm.invalid) {
      this.receiptForm.markAllAsTouched();
      return;
    }

    const order = this.selectedOrderForReceipt();
    if (!order) return;

    const formVal = this.receiptForm.getRawValue();
    const lineId = order.items?.[0]?.id || 'line-1';

    const payload: ProcessGoodsReceiptPayload = {
      supplier_delivery_note_ref: formVal.supplier_delivery_note_ref,
      received_date: formVal.received_date,
      inspection_required: formVal.inspection_required,
      inspection_status: formVal.inspection_status,
      notes: formVal.notes || undefined,
      lines: [
        {
          purchase_order_line_id: lineId,
          quantity_received: formVal.quantity_received,
          quantity_accepted: formVal.quantity_received,
          lot_number: formVal.lot_number || undefined,
        },
      ],
    };

    this.procurementApi.processGoodsReceipt(order.id, payload).subscribe({
      next: (res) => {
        this.goodsReceiptModalVisible.set(false);
        this.message.success(`Bolla di ricezione ${res.data.receipt_number || 'creata'} registrata con successo`);
        this.loadOrders();
        this.loadGoodsReceipts();
      },
      error: () => {
        this.message.error('Errore durante la registrazione della ricezione merce');
      },
    });
  }

  openInspectModal(receipt: GoodsReceipt): void {
    this.selectedReceipt.set(receipt);
    this.inspectForm.reset({
      inspection_status: receipt.inspection_status || 'passed',
      notes: receipt.notes || '',
    });
    this.inspectModalVisible.set(true);
  }

  submitInspection(): void {
    const receipt = this.selectedReceipt();
    if (!receipt) return;

    const val = this.inspectForm.getRawValue();
    this.procurementApi.inspectGoodsReceipt(receipt.id, val.inspection_status, val.notes).subscribe({
      next: () => {
        this.inspectModalVisible.set(false);
        this.message.success('Ispezione aggiornata con successo');
        this.loadGoodsReceipts();
      },
      error: () => {
        this.message.error('Errore durante l\'aggiornamento dell\'ispezione');
      },
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
        this.message.success(`3-Way Match completato: stato ${res.data.status}`);
        this.loadThreeWayMatches();
      },
      error: () => {
        this.message.error('Errore durante l\'esecuzione del 3-Way Match');
      },
    });
  }

  approveVariance(match: ThreeWayMatchLog): void {
    this.modal.confirm({
      nzTitle: `Approvare la discrepanza per il match ${match.id}?`,
      nzContent: `Scostamento prezzo: ${match.price_variance}, scostamento quantità: ${match.quantity_variance}`,
      nzOkText: 'Approva Discrepanza',
      nzCancelText: 'Annulla',
      nzOnOk: () => {
        this.procurementApi.approveThreeWayMatchVariance(match.id, 'Approvato manualmente da responsabile AP').subscribe({
          next: () => {
            this.message.success('Discrepanza approvata con successo');
            this.loadThreeWayMatches();
          },
        });
      },
    });
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

  markInvoicePaid(invoice: SupplierInvoice): void {
    this.modal.confirm({
      nzTitle: `Segnare la fattura fornitore ${invoice.invoice_number} come pagata?`,
      nzOkText: 'Conferma Pagamento',
      nzCancelText: 'Annulla',
      nzOnOk: () => {
        this.procurementApi.markSupplierInvoicePaid(invoice.id).subscribe({
          next: () => {
            this.message.success(`Fattura ${invoice.invoice_number} contrassegnata come pagata`);
            this.loadSupplierInvoices();
          },
        });
      },
    });
  }

  openImportSdiModal(): void {
    this.sdiImportForm.reset({ xml_content: '' });
    this.importSdiModalVisible.set(true);
  }

  submitImportSdi(): void {
    if (this.sdiImportForm.invalid) {
      this.sdiImportForm.markAllAsTouched();
      return;
    }

    const xml = this.sdiImportForm.getRawValue().xml_content;
    this.procurementApi.importPassiveInvoiceSdi(xml).subscribe({
      next: (res) => {
        this.importSdiModalVisible.set(false);
        this.message.success(res.data.message || 'FatturaPA SDI importata con successo');
        this.loadSupplierInvoices();
      },
      error: () => {
        this.message.error('Errore durante l\'importazione del file XML SDI');
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
      case 'ordered':
      case 'sent':
        return 'blue';
      case 'rejected':
      case 'cancelled':
        return 'error';
      default:
        return 'default';
    }
  }

  statusLabel(status: PurchaseOrderStatus): string {
    return this.translate.instant('purchases.statuses.' + status) || status;
  }

  inspectionColor(status: GoodsReceiptInspectionStatus): string {
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

  matchStatusColor(status: ThreeWayMatchStatus): string {
    switch (status) {
      case 'matched':
        return 'success';
      case 'discrepancy':
      case 'escalated_to_workflow':
        return 'warning';
      case 'rejected':
        return 'error';
      default:
        return 'default';
    }
  }
}
