import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, inject, signal, viewChild, TemplateRef } from '@angular/core';
import { finalize, Observable, switchMap } from 'rxjs';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzDropdownModule } from 'ng-zorro-antd/dropdown';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { NzModalModule, NzModalService } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzDividerModule } from 'ng-zorro-antd/divider';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzQRCodeComponent } from 'ng-zorro-antd/qr-code';
import {
  CreateCreditNotePayload,
  I18nService,
  InvoiceApiService,
  InvoiceDetailResource,
  InvoiceInstallment,
  InvoiceResource,
  InvoiceStatus,
  Jurisdiction,
  PaymentStatus,
  SdiLogsData,
  SwissQrBillData,
  TranslateService,
} from '@core';
import {
  BaseTableComponent,
  MoneyPipe,
  PageHeaderComponent,
  TableColumnDef,
  TableQueryParams,
  TranslatePipe,
} from '@shared';
import { InvoiceFacade } from '../../services/invoice.facade';
import { InvoiceDetailModalComponent } from './invoice-detail-modal.component';
import { InvoiceFormDrawerComponent } from './invoice-form-drawer.component';

const STATUS: Record<InvoiceStatus, { key: string; color: string }> = {
  draft: { key: 'SALES.INVOICES.STATUS.DRAFT', color: 'default' },
  approved: { key: 'SC.STATUS.approved', color: 'cyan' },
  posted: { key: 'SC.STATUS.posted', color: 'blue' },
  issued: { key: 'SALES.INVOICES.STATUS.ISSUED', color: 'processing' },
  paid: { key: 'SALES.INVOICES.STATUS.PAID', color: 'success' },
  cancelled: { key: 'SALES.INVOICES.STATUS.CANCELLED', color: 'error' },
};

const PAYMENT_KEYS: { key: string; value: PaymentStatus }[] = [
  { key: 'SALES.INVOICES.PAYMENT.UNPAID', value: 'unpaid' },
  { key: 'SALES.INVOICES.PAYMENT.PARTIALLY_PAID', value: 'partially_paid' },
  { key: 'SALES.INVOICES.PAYMENT.PAID', value: 'paid' },
  { key: 'SALES.INVOICES.PAYMENT.OVERDUE', value: 'overdue' },
];

const JURISDICTION_KEYS: { key: string; value: Jurisdiction }[] = [
  { key: 'SALES.INVOICES.JURISDICTIONS.IT', value: 'IT' },
  { key: 'SALES.INVOICES.JURISDICTIONS.CH', value: 'CH' },
];

@Component({
  selector: 'app-invoices',
  imports: [
    ReactiveFormsModule,
    FormsModule,
    CurrencyPipe,
    DatePipe,
    MoneyPipe,
    NzTagModule,
    NzCardModule,
    NzButtonModule,
    NzInputModule,
    NzInputNumberModule,
    NzSelectModule,
    NzTableModule,
    NzIconModule,
    NzDropdownModule,
    NzMenuModule,
    NzModalModule,
    NzDividerModule,
    NzFormModule,
    NzQRCodeComponent,
    BaseTableComponent,
    PageHeaderComponent,
    TranslatePipe,
    InvoiceFormDrawerComponent,
    InvoiceDetailModalComponent,
  ],
  templateUrl: './invoices.component.html',
  styleUrl: './invoices.component.scss',
})
export class InvoicesComponent {
  private readonly translate = inject(TranslateService);
  protected readonly facade = inject(InvoiceFacade);
  private readonly api = inject(InvoiceApiService);
  private readonly message = inject(NzMessageService);
  private readonly modal = inject(NzModalService);
  private readonly i18n = inject(I18nService);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly drawerOpen = signal(false);
  protected readonly template = signal<InvoiceDetailResource | null>(null);
  protected readonly busyId = signal<string | null>(null);
  protected readonly detailOpen = signal(false);
  protected readonly detailInvoice = signal<InvoiceDetailResource | null>(null);

  // Swiss QR-Bill Modal
  readonly qrModalVisible = signal(false);
  readonly currentQrBill = signal<SwissQrBillData | null>(null);

  // SDI Logs Modal
  readonly sdiLogsModalVisible = signal(false);
  readonly currentSdiLogs = signal<SdiLogsData | null>(null);

  // Installments Modal
  readonly installmentsModalVisible = signal(false);
  readonly currentInstallments = signal<InvoiceInstallment[]>([]);

  // Credit Note Modal
  readonly creditNoteModalVisible = signal(false);
  readonly savingCreditNote = signal(false);
  readonly creditNoteForm = this.fb.group({
    original_invoice_id: this.fb.control('', [Validators.required]),
    date: this.fb.control(new Date().toISOString().substring(0, 10), [Validators.required]),
    notes: this.fb.control(''),
    description: this.fb.control('Storno parziale / Nota di credito', [Validators.required]),
    quantity: this.fb.control(1, [Validators.required, Validators.min(0.001)]),
    unit_price: this.fb.control(0, [Validators.required, Validators.min(0)]),
    tax_rate: this.fb.control(22, [Validators.required]),
  });

  // Template views
  private readonly numberTpl =
    viewChild<TemplateRef<{ $implicit: InvoiceResource; value: unknown }>>('numberTpl');
  private readonly dateTpl =
    viewChild<TemplateRef<{ $implicit: InvoiceResource; value: unknown }>>('dateTpl');
  private readonly currencyTpl =
    viewChild<TemplateRef<{ $implicit: InvoiceResource; value: unknown }>>('currencyTpl');
  private readonly totalTpl =
    viewChild<TemplateRef<{ $implicit: InvoiceResource; value: unknown }>>('totalTpl');
  private readonly statusTpl =
    viewChild<TemplateRef<{ $implicit: InvoiceResource; value: unknown }>>('statusTpl');
  private readonly jurisdictionTpl =
    viewChild<TemplateRef<{ $implicit: InvoiceResource; value: unknown }>>('jurisdictionTpl');

  readonly columns = computed<TableColumnDef<InvoiceResource>[]>(() => [
    {
      key: 'invoice_number',
      header: this.i18n.translate('SALES.INVOICES.COLUMNS.NUMBER'),
      width: '180px',
      sortable: true,
      customCellTemplate: this.numberTpl(),
    },
    {
      key: 'issue_date',
      header: this.i18n.translate('SALES.INVOICES.COLUMNS.DATE'),
      width: '120px',
      sortable: true,
      customCellTemplate: this.dateTpl(),
    },
    {
      key: 'due_date',
      header: this.i18n.translate('SALES.INVOICES.COLUMNS.DUE_DATE'),
      width: '120px',
      sortable: true,
      customCellTemplate: this.dateTpl(),
    },
    {
      key: 'subtotal',
      header: this.i18n.translate('SALES.INVOICES.COLUMNS.NET'),
      width: '120px',
      align: 'right',
      customCellTemplate: this.currencyTpl(),
    },
    {
      key: 'tax_amount',
      header: this.i18n.translate('SALES.INVOICES.COLUMNS.VAT'),
      width: '110px',
      align: 'right',
      customCellTemplate: this.currencyTpl(),
    },
    {
      key: 'total',
      header: this.i18n.translate('SALES.INVOICES.COLUMNS.TOTAL'),
      width: '130px',
      align: 'right',
      sortable: true,
      customCellTemplate: this.totalTpl(),
    },
    {
      key: 'status',
      header: this.i18n.translate('SALES.INVOICES.COLUMNS.PAYMENT_STATUS'),
      width: '140px',
      customCellTemplate: this.statusTpl(),
    },
    {
      key: 'jurisdiction',
      header: this.i18n.translate('SALES.INVOICES.COLUMNS.JURISDICTION'),
      width: '120px',
      customCellTemplate: this.jurisdictionTpl(),
    },
  ]);

  protected readonly paymentOptions = computed(() => {
    this.i18n.currentLanguage();
    return PAYMENT_KEYS.map((o) => ({ label: this.i18n.translate(o.key), value: o.value }));
  });
  protected readonly jurisdictionOptions = computed(() => {
    this.i18n.currentLanguage();
    return JURISDICTION_KEYS.map((o) => ({ label: this.i18n.translate(o.key), value: o.value }));
  });

  protected jurisdictionOf(inv: InvoiceResource): Jurisdiction {
    return inv.jurisdiction ?? (inv.currency === 'CHF' ? 'CH' : 'IT');
  }

  protected statusOf(inv: InvoiceResource): { key: string; color: string } {
    if (inv.invoice_type === 'proforma') {
      return { key: 'SALES.INVOICES.STATUS.PROFORMA', color: 'purple' };
    }
    if (inv.payment_status === 'overdue' && inv.status !== 'paid') {
      return { key: 'SALES.INVOICES.STATUS.OVERDUE', color: 'error' };
    }
    return STATUS[inv.status] ?? { key: 'SALES.INVOICES.STATUS.DRAFT', color: 'default' };
  }

  protected onParamsChange(params: TableQueryParams): void {
    if (params.pageIndex !== this.facade.pageIndex()) {
      this.facade.setPage(params.pageIndex);
    }
    if (params.pageSize !== this.facade.pageSize()) {
      this.facade.setPageSize(params.pageSize);
    }
  }

  protected create(): void {
    this.template.set(null);
    this.drawerOpen.set(true);
  }

  protected duplicate(inv: InvoiceResource): void {
    this.run(inv, this.api.get(inv.id), null, (res) => {
      this.template.set({ ...inv, ...res.data });
      this.drawerOpen.set(true);
    });
  }

  /** Read-only detail: payment term and, for a foreign-currency invoice, the rate the server applied. */
  protected showDetails(inv: InvoiceResource): void {
    this.run(inv, this.api.get(inv.id), null, (res) => {
      this.detailInvoice.set({ ...inv, ...res.data });
      this.detailOpen.set(true);
    });
  }

  protected openPdf(inv: InvoiceResource): void {
    this.run(inv, this.api.downloadPdf(inv.id), null, (blob) => this.openBlob(blob));
  }

  // Swiss QR-Bill
  viewQrBill(inv: InvoiceResource): void {
    this.run(inv, this.api.getQrBill(inv.id), null, (res) => {
      this.currentQrBill.set(res.data);
      this.qrModalVisible.set(true);
    });
  }

  protected generateQrBill(inv: InvoiceResource): void {
    this.run(
      inv,
      this.api.generateQrBill(inv.id).pipe(switchMap(() => this.api.downloadQrBill(inv.id))),
      'SALES.INVOICES.MESSAGES.QR_GENERATED',
      (blob) => {
        this.openBlob(blob);
        this.facade.reload();
      },
    );
  }

  protected confirmEmail(inv: InvoiceResource): void {
    this.confirm('SALES.INVOICES.ACTIONS.CONFIRM_EMAIL', () =>
      this.run(inv, this.api.sendByEmail(inv.id), 'SALES.INVOICES.MESSAGES.EMAIL_SENT'),
    );
  }

  // SDI Electronic Invoice (FatturaPA)
  protected confirmSdi(inv: InvoiceResource): void {
    this.confirm('SALES.INVOICES.ACTIONS.CONFIRM_SDI', () =>
      this.run(inv, this.api.sendToSdi(inv.id), 'SALES.INVOICES.MESSAGES.SDI_SENT', () =>
        this.facade.reload(),
      ),
    );
  }

  generateSdiXml(inv: InvoiceResource): void {
    this.run(inv, this.api.generateSdiXml(inv.id), null, (res) => {
      this.message.success(this.translate.instant('SALES.MSG_FATTURAPA_XML_GENERATO_CON_SUCCESSO', { status: res.data.status }));
      this.facade.reload();
    });
  }

  viewSdiLogs(inv: InvoiceResource): void {
    this.run(inv, this.api.getSdiLogs(inv.id), null, (res) => {
      this.currentSdiLogs.set(res.data);
      this.sdiLogsModalVisible.set(true);
    });
  }

  sendBulkSdi(): void {
    const items = this.facade.items();
    const itInvoiceIds = items
      .filter((i) => (i.jurisdiction ?? (i.currency === 'CHF' ? 'CH' : 'IT')) === 'IT' && i.status !== 'cancelled')
      .map((i) => i.id);

    if (itInvoiceIds.length === 0) {
      this.message.info(this.translate.instant('SALES.MSG_NESSUNA_FATTURA_ITALIANA_SELEZIONABILE_PER_L'));
      return;
    }

    this.confirm('Confermi l\'invio massivo delle fatture a SDI?', () => {
      this.api.sendSdiBulk(itInvoiceIds).subscribe({
        next: (res) => {
          this.message.success(this.translate.instant('SALES.MSG_INVIO_MASSIVO_SDI_COMPLETATO_INVIATE_FALLITE', { sent: res.data.sent, failed: res.data.failed }));
          this.facade.reload();
        },
        error: () => this.message.error(this.translate.instant('SALES.MSG_ERRORE_DURANTE_L_INVIO_MASSIVO_SDI')),
      });
    });
  }

  // Credit Notes
  openCreditNoteModal(inv: InvoiceResource): void {
    this.creditNoteForm.reset({
      original_invoice_id: inv.id,
      date: new Date().toISOString().substring(0, 10),
      notes: `Nota di credito per fattura ${inv.invoice_number}`,
      description: `Storno riferimento fattura ${inv.invoice_number}`,
      quantity: 1,
      unit_price: inv.total || 0,
      tax_rate: inv.currency === 'CHF' ? 8.1 : 22,
    });
    this.creditNoteModalVisible.set(true);
  }

  submitCreditNote(): void {
    if (this.creditNoteForm.invalid) {
      this.creditNoteForm.markAllAsTouched();
      return;
    }

    this.savingCreditNote.set(true);
    const formVal = this.creditNoteForm.getRawValue();
    const payload: CreateCreditNotePayload = {
      original_invoice_id: formVal.original_invoice_id,
      date: formVal.date,
      notes: formVal.notes || undefined,
      items: [
        {
          description: formVal.description,
          quantity: Number(formVal.quantity),
          unit_price: Number(formVal.unit_price),
          tax_rate: Number(formVal.tax_rate),
        },
      ],
    };

    this.api.createCreditNote(payload).subscribe({
      next: (res) => {
        this.savingCreditNote.set(false);
        this.creditNoteModalVisible.set(false);
        this.message.success(this.translate.instant('SALES.MSG_NOTA_DI_CREDITO_CREATA_CON_SUCCESSO', { credit_note_number: res.data.credit_note_number }));
        this.facade.reload();
      },
      error: () => {
        this.savingCreditNote.set(false);
        this.message.error(this.translate.instant('SALES.MSG_ERRORE_DURANTE_LA_CREAZIONE_DELLA_NOTA'));
      },
    });
  }

  // Installments / Scadenze
  viewInstallments(inv: InvoiceResource): void {
    this.run(inv, this.api.getInstallments(inv.id), null, (res) => {
      this.currentInstallments.set(res.data || []);
      this.installmentsModalVisible.set(true);
    });
  }

  protected confirmProforma(inv: InvoiceResource): void {
    this.confirm('SALES.INVOICES.ACTIONS.CONFIRM_PROFORMA', () =>
      this.run(
        inv,
        this.api.convertProforma(inv.id),
        'SALES.INVOICES.MESSAGES.PROFORMA_CONVERTED',
        () => this.facade.reload(),
      ),
    );
  }

  protected confirmApprove(inv: InvoiceResource): void {
    this.confirm('SC.INVOICE.APPROVE_CONFIRM', () =>
      this.run(inv, this.api.approveInvoice(inv.id), 'SC.INVOICE.APPROVED', () => this.facade.reload()),
    );
  }

  protected confirmPost(inv: InvoiceResource): void {
    this.confirm('SC.INVOICE.POST_CONFIRM', () =>
      this.run(inv, this.api.postInvoice(inv.id), 'SC.INVOICE.POSTED', () => this.facade.reload()),
    );
  }

  private confirm(titleKey: string, onOk: () => void): void {
    this.modal.confirm({
      nzTitle: this.i18n.translate(titleKey),
      nzOkText: this.i18n.translate('SALES.INVOICES.ACTIONS.OK'),
      nzCancelText: this.i18n.translate('COMMON.CANCEL'),
      nzOnOk: onOk,
    });
  }

  private run<T>(
    inv: InvoiceResource,
    request$: Observable<T>,
    successKey: string | null,
    onSuccess?: (result: T) => void,
  ): void {
    this.busyId.set(inv.id);
    request$.pipe(finalize(() => this.busyId.set(null))).subscribe({
      next: (result) => {
        if (successKey) {
          this.message.success(this.i18n.translate(successKey));
        }
        onSuccess?.(result);
      },
      error: () => undefined,
    });
  }

  private openBlob(blob: Blob): void {
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank', 'noopener');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
}
