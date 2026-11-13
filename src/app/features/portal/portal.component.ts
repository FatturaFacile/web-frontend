import { DatePipe, SlicePipe, UpperCasePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzBadgeModule } from 'ng-zorro-antd/badge';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzRateModule } from 'ng-zorro-antd/rate';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  AnswerPortalCsatRequest,
  ApprovePortalQuoteRequest,
  CreatePortalMovementRequest,
  CreatePortalTicketRequest,
  CustomsPortalDossier,
  CustomsPortalShipmentRequest,
  PortalAccessData,
  PortalApiService,
  PortalAppointment,
  PortalAttachment,
  PortalCsatSurvey,
  PortalHelpdeskMessage,
  PortalHelpdeskTicket,
  PortalInvoice,
  PortalKnowledgeArticle,
  PortalKnowledgeCategory,
  PortalMovementRequest,
  PortalQuote,
  PortalServiceReport,
  PortalStockLine,
  PortalStockMovement,
  PortalSubscription,
  RejectPortalQuoteRequest,
  ReplyPortalTicketRequest,
  TranslateService,
} from '@core';
import { MoneyPipe, PageHeaderComponent, TranslatePipe, IconActionDirective, ModalActionsDirective } from '@shared';
import { notInPast } from '@shared/utils/date-validators';

@Component({
  selector: 'app-portal',
  styleUrl: './portal.component.scss',
  imports: [
    IconActionDirective,
    ModalActionsDirective,
    SlicePipe,
    UpperCasePipe,
    DatePipe,
    FormsModule,
    ReactiveFormsModule,
    NzCardModule,
    NzTabsModule,
    NzTableModule,
    NzTagModule,
    NzButtonModule,
    NzInputModule,
    NzInputNumberModule,
    NzSelectModule,
    NzFormModule,
    NzModalModule,
    NzDescriptionsModule,
    NzAlertModule,
    NzStatisticModule,
    NzRateModule,
    NzBadgeModule,
    NzIconModule,
    PageHeaderComponent,
    TranslatePipe,
    MoneyPipe,
  ],
  templateUrl: './portal.component.html',
})
export class PortalComponent implements OnInit {
  private readonly portalApi = inject(PortalApiService);
  private readonly msg = inject(NzMessageService);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);
  readonly translate = inject(TranslateService);

  readonly token = signal<string>('demo-portal-token');
  readonly loading = signal<boolean>(false);
  readonly selectedTabIndex = signal<number>(0);

  readonly accessData = signal<PortalAccessData | null>(null);
  readonly quotes = signal<PortalQuote[]>([]);
  readonly invoices = signal<PortalInvoice[]>([]);
  readonly subscriptions = signal<PortalSubscription[]>([]);
  readonly serviceReports = signal<PortalServiceReport[]>([]);
  readonly appointments = signal<PortalAppointment[]>([]);
  readonly tickets = signal<PortalHelpdeskTicket[]>([]);
  readonly selectedTicket = signal<(PortalHelpdeskTicket & { messages: PortalHelpdeskMessage[] }) | null>(null);
  readonly survey = signal<PortalCsatSurvey | null>(null);
  readonly kbCategories = signal<PortalKnowledgeCategory[]>([]);
  readonly kbArticles = signal<PortalKnowledgeArticle[]>([]);
  readonly selectedArticle = signal<PortalKnowledgeArticle | null>(null);
  readonly stockLines = signal<PortalStockLine[]>([]);
  readonly movementRequests = signal<PortalMovementRequest[]>([]);
  readonly stockMovements = signal<PortalStockMovement[]>([]);
  readonly stockMovementsHasMore = signal<boolean>(false);
  private stockMovementsPage = 1;
  readonly customsDossiers = signal<CustomsPortalDossier[]>([]);

  // Modals & Drawers visibility
  readonly approveModalVisible = signal<boolean>(false);
  readonly rejectModalVisible = signal<boolean>(false);
  readonly createTicketModalVisible = signal<boolean>(false);
  readonly ticketDrawerVisible = signal<boolean>(false);
  readonly csatModalVisible = signal<boolean>(false);
  readonly articleModalVisible = signal<boolean>(false);
  readonly movementModalVisible = signal<boolean>(false);
  readonly shipmentModalVisible = signal<boolean>(false);

  readonly selectedQuote = signal<PortalQuote | null>(null);
  readonly kbSearchQuery = signal<string>('');

  // Forms
  readonly approveForm: FormGroup = this.fb.group({
    signer_name: ['', [Validators.required, Validators.maxLength(150)]],
    notes: ['', [Validators.maxLength(1000)]],
  });

  readonly rejectForm: FormGroup = this.fb.group({
    reason: ['', [Validators.required, Validators.maxLength(1000)]],
  });

  readonly ticketForm: FormGroup = this.fb.group({
    subject: ['', [Validators.required, Validators.maxLength(200)]],
    description: ['', [Validators.required, Validators.maxLength(10000)]],
  });

  readonly replyForm: FormGroup = this.fb.group({
    message: ['', [Validators.required, Validators.maxLength(10000)]],
    author_name: [''],
  });

  readonly csatForm: FormGroup = this.fb.group({
    score: [5, [Validators.required, Validators.min(1), Validators.max(5)]],
    feedback: ['', [Validators.maxLength(5000)]],
  });

  readonly movementForm: FormGroup = this.fb.group({
    line: ['', [Validators.required]],
    request_type: ['withdrawal', [Validators.required]],
    quantity: [1, [Validators.required, Validators.min(0.0001)]],
    requested_date: ['', [notInPast]],
    notes: ['', [Validators.maxLength(1000)]],
  });

  /** Warehouse and item pairs of the customer stock, to pick what the movement request is about. */
  protected readonly movementLines = computed(() => {
    const seen = new Set<string>();
    const lines: { key: string; label: string }[] = [];
    for (const line of this.stockLines()) {
      const key = this.stockLineKey(line);
      if (line.warehouse_id && !seen.has(key)) {
        seen.add(key);
        lines.push({ key, label: `${line.sku ?? ''} ${line.name ?? ''}`.trim() });
      }
    }
    return lines;
  });

  protected stockLineKey(line: PortalStockLine): string {
    return `${line.warehouse_id}|${line.stock_item_id}`;
  }

  readonly shipmentForm: FormGroup = this.fb.group({
    service_type: ['Standard Air Cargo', [Validators.required, Validators.maxLength(40)]],
    direction: ['export', [Validators.required]],
    origin_country: ['IT', [Validators.required, Validators.minLength(2), Validators.maxLength(2)]],
    destination_country: ['CH', [Validators.required, Validators.minLength(2), Validators.maxLength(2)]],
    gross_weight_kg: [10, [Validators.required, Validators.min(0.1)]],
    volume_m3: [0.5, [Validators.min(0)]],
    packages: [1, [Validators.required, Validators.min(1)]],
    pickup_on: [''],
    notes: ['', [Validators.maxLength(2000)]],
  });

  ngOnInit(): void {
    const routeToken = this.route.snapshot.paramMap.get('token') || this.route.snapshot.queryParamMap.get('token');
    if (routeToken) {
      this.token.set(routeToken);
    }
    this.loadAll();
  }

  loadAll(): void {
    this.loading.set(true);
    const tok = this.token();

    this.portalApi.getAccess(tok).subscribe({
      next: (res) => {
        this.accessData.set(res.data);
      },
      error: () => {
        // Fallback demo access data if backend token is uninitialized
        this.accessData.set({
          customer: {
            id: 'demo-cust',
            name: 'Demo Client B2B Ltd',
            email: 'client@example.com',
            vat_number: 'IT12345678901',
          },
          summary: {
            pending_quotes: 1,
            unpaid_invoices: 1,
            open_tickets: 1,
            upcoming_appointments: 1,
          },
        });
      },
    });

    this.loadQuotes();
    this.loadInvoices();
    this.loadSubscriptions();
    this.loadServiceReports();
    this.loadAppointments();
    this.loadTickets();
    this.loadCsat();
    this.loadKnowledgeBase();
    this.loadStockAndMovements();
    this.loadCustoms();
  }

  loadQuotes(): void {
    this.portalApi.getQuote(this.token()).subscribe({
      next: (res) => {
        if (res.data) {
          this.quotes.set([res.data]);
        }
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  loadInvoices(): void {
    this.portalApi.getInvoices(this.token()).subscribe({
      next: (res) => {
        this.invoices.set(res.data || []);
      },
      error: () => undefined,
    });
  }

  loadSubscriptions(): void {
    this.portalApi.getSubscriptions(this.token()).subscribe({
      next: (res) => {
        this.subscriptions.set(res.data || []);
      },
      error: () => undefined,
    });
  }

  loadServiceReports(): void {
    this.portalApi.getServiceReports(this.token()).subscribe({
      next: (res) => {
        this.serviceReports.set(res.data || []);
      },
      error: () => undefined,
    });
  }

  loadAppointments(): void {
    this.portalApi.getAppointments(this.token()).subscribe({
      next: (res) => {
        this.appointments.set(res.data || []);
      },
      error: () => undefined,
    });
  }

  loadTickets(): void {
    this.portalApi.getTickets(this.token()).subscribe({
      next: (res) => {
        this.tickets.set(res.data || []);
      },
      error: () => undefined,
    });
  }

  loadCsat(): void {
    this.portalApi.getCsat(this.token()).subscribe({
      next: (res) => {
        this.survey.set(res.data);
      },
      error: () => undefined,
    });
  }

  loadKnowledgeBase(): void {
    this.portalApi.getKnowledgeCategories(this.token()).subscribe({
      next: (res) => {
        this.kbCategories.set(res.data || []);
      },
      error: () => undefined,
    });

    this.portalApi.getKnowledgeArticles(this.token(), { query: this.kbSearchQuery() }).subscribe({
      next: (res) => {
        this.kbArticles.set(res.data || []);
      },
      error: () => undefined,
    });
  }

  loadStockAndMovements(): void {
    this.portalApi.getStock(this.token()).subscribe({
      next: (res) => {
        this.stockLines.set(res.data || []);
      },
      error: () => undefined,
    });

    this.portalApi.getMovementRequests(this.token()).subscribe({
      next: (res) => {
        this.movementRequests.set(res.data || []);
      },
      error: () => undefined,
    });

    this.loadStockMovements(1);
  }

  loadMoreStockMovements(): void {
    this.loadStockMovements(this.stockMovementsPage + 1);
  }

  private loadStockMovements(page: number): void {
    this.portalApi.getStockMovements(this.token(), page).subscribe({
      next: (res) => {
        this.stockMovementsPage = res.meta.current_page;
        this.stockMovements.update((rows) => (page === 1 ? res.data : [...rows, ...res.data]));
        this.stockMovementsHasMore.set(res.meta.current_page < res.meta.last_page);
      },
      error: () => undefined,
    });
  }

  downloadAttachment(attachment: PortalAttachment): void {
    this.portalApi.downloadAttachment(this.token(), attachment.id).subscribe({
      next: (blob) => this.saveBlob(blob, attachment.original_name || attachment.id),
      error: () => this.msg.error(this.t('PORTAL.ACTION_ERROR')),
    });
  }

  downloadTicketAttachment(ticket: PortalHelpdeskTicket, attachment: PortalAttachment): void {
    this.portalApi.downloadHelpdeskAttachment(this.token(), ticket.id, attachment.id).subscribe({
      next: (blob) => this.saveBlob(blob, attachment.original_name || attachment.id),
      error: () => this.msg.error(this.t('PORTAL.ACTION_ERROR')),
    });
  }

  private saveBlob(blob: Blob, fileName: string): void {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  loadCustoms(): void {
    this.portalApi.getCustomsDossiers(this.token()).subscribe({
      next: (res) => {
        this.customsDossiers.set(res.data || []);
      },
      error: () => undefined,
    });
  }

  // Quote actions
  openApproveModal(quote: PortalQuote): void {
    this.selectedQuote.set(quote);
    this.approveForm.reset({ signer_name: this.accessData()?.customer.name || '', notes: '' });
    this.approveModalVisible.set(true);
  }

  submitApproveQuote(): void {
    if (this.approveForm.invalid) {
      this.approveForm.markAllAsTouched();
      return;
    }
    const val = this.approveForm.value as ApprovePortalQuoteRequest;
    this.loading.set(true);
    this.portalApi.approveQuote(this.token(), val).subscribe({
      next: () => {
        this.msg.success(this.t('PORTAL.QUOTE_APPROVED_SUCCESS'));
        this.approveModalVisible.set(false);
        this.loadQuotes();
      },
      error: () => {
        this.loading.set(false);
        this.msg.error(this.t('PORTAL.ACTION_ERROR'));
      },
    });
  }

  openRejectModal(quote: PortalQuote): void {
    this.selectedQuote.set(quote);
    this.rejectForm.reset({ reason: '' });
    this.rejectModalVisible.set(true);
  }

  submitRejectQuote(): void {
    if (this.rejectForm.invalid) {
      this.rejectForm.markAllAsTouched();
      return;
    }
    const val = this.rejectForm.value as RejectPortalQuoteRequest;
    this.loading.set(true);
    this.portalApi.rejectQuote(this.token(), val).subscribe({
      next: () => {
        this.msg.info(this.t('PORTAL.QUOTE_REJECTED_SUCCESS'));
        this.rejectModalVisible.set(false);
        this.loadQuotes();
      },
      error: () => {
        this.loading.set(false);
        this.msg.error(this.t('PORTAL.ACTION_ERROR'));
      },
    });
  }

  downloadQuotePdf(): void {
    this.loading.set(true);
    this.portalApi.downloadQuotePdf(this.token()).subscribe({
      next: (blob) => {
        this.loading.set(false);
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Preventivo_${this.selectedQuote()?.quote_number || 'documento'}.pdf`;
        a.click();
        window.URL.revokeObjectURL(url);
        this.msg.success(this.t('PORTAL.DOWNLOAD_COMPLETED'));
      },
      error: () => {
        this.loading.set(false);
        this.msg.error(this.t('PORTAL.ACTION_ERROR'));
      },
    });
  }

  downloadInvoicePdf(invoice: PortalInvoice): void {
    this.loading.set(true);
    this.portalApi.downloadInvoicePdf(this.token(), invoice.id).subscribe({
      next: (blob) => {
        this.loading.set(false);
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Fattura_${invoice.invoice_number}.pdf`;
        a.click();
        window.URL.revokeObjectURL(url);
        this.msg.success(this.t('PORTAL.DOWNLOAD_COMPLETED'));
      },
      error: () => {
        this.loading.set(false);
        this.msg.error(this.t('PORTAL.ACTION_ERROR'));
      },
    });
  }

  downloadServiceReportPdf(report: PortalServiceReport): void {
    this.loading.set(true);
    this.portalApi.downloadServiceReportPdf(this.token(), report.id).subscribe({
      next: (blob) => {
        this.loading.set(false);
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Rapporto_${report.report_number}.pdf`;
        a.click();
        window.URL.revokeObjectURL(url);
        this.msg.success(this.t('PORTAL.DOWNLOAD_COMPLETED'));
      },
      error: () => {
        this.loading.set(false);
        this.msg.error(this.t('PORTAL.ACTION_ERROR'));
      },
    });
  }

  // Helpdesk Ticket actions
  openCreateTicketModal(): void {
    this.ticketForm.reset();
    this.createTicketModalVisible.set(true);
  }

  submitCreateTicket(): void {
    if (this.ticketForm.invalid) {
      this.ticketForm.markAllAsTouched();
      return;
    }
    const val = this.ticketForm.value as CreatePortalTicketRequest;
    this.loading.set(true);
    this.portalApi.createTicket(this.token(), val).subscribe({
      next: () => {
        this.loading.set(false);
        this.msg.success(this.t('PORTAL.TICKET_CREATED_SUCCESS'));
        this.createTicketModalVisible.set(false);
        this.loadTickets();
      },
      error: () => {
        this.loading.set(false);
        this.msg.error(this.t('PORTAL.ACTION_ERROR'));
      },
    });
  }

  openTicketDrawer(ticket: PortalHelpdeskTicket): void {
    this.loading.set(true);
    this.portalApi.getTicket(this.token(), ticket.id).subscribe({
      next: (res) => {
        this.loading.set(false);
        this.selectedTicket.set(res.data);
        this.replyForm.reset({ author_name: this.accessData()?.customer.name || '' });
        this.ticketDrawerVisible.set(true);
      },
      error: () => {
        this.loading.set(false);
        this.selectedTicket.set({ ...ticket, messages: [] });
        this.ticketDrawerVisible.set(true);
      },
    });
  }

  submitTicketReply(): void {
    const ticket = this.selectedTicket();
    if (!ticket || this.replyForm.invalid) {
      this.replyForm.markAllAsTouched();
      return;
    }
    const val = this.replyForm.value as ReplyPortalTicketRequest;
    this.loading.set(true);
    this.portalApi.replyTicket(this.token(), ticket.id, val).subscribe({
      next: () => {
        this.loading.set(false);
        this.msg.success(this.t('PORTAL.REPLY_SENT_SUCCESS'));
        this.replyForm.reset({ author_name: this.accessData()?.customer.name || '' });
        this.openTicketDrawer(ticket);
      },
      error: () => {
        this.loading.set(false);
        this.msg.error(this.t('PORTAL.ACTION_ERROR'));
      },
    });
  }

  // CSAT Survey
  openCsatModal(): void {
    this.csatForm.reset({ score: 5, feedback: '' });
    this.csatModalVisible.set(true);
  }

  submitCsat(): void {
    if (this.csatForm.invalid) {
      this.csatForm.markAllAsTouched();
      return;
    }
    const val = this.csatForm.value as AnswerPortalCsatRequest;
    this.loading.set(true);
    this.portalApi.answerCsat(this.token(), val).subscribe({
      next: (res) => {
        this.loading.set(false);
        this.survey.set(res.data);
        this.msg.success(this.t('PORTAL.SURVEY_SUBMITTED_SUCCESS'));
        this.csatModalVisible.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.msg.error(this.t('PORTAL.ACTION_ERROR'));
      },
    });
  }

  // Knowledge Base actions
  openArticleModal(article: PortalKnowledgeArticle): void {
    this.selectedArticle.set(article);
    this.articleModalVisible.set(true);
  }

  searchKnowledgeBase(): void {
    this.loadKnowledgeBase();
  }

  // Movement requests
  openMovementModal(): void {
    this.movementForm.reset({ line: '', request_type: 'withdrawal', quantity: 1, requested_date: '', notes: '' });
    this.movementModalVisible.set(true);
  }

  submitMovementRequest(): void {
    if (this.movementForm.invalid) {
      this.movementForm.markAllAsTouched();
      return;
    }
    const val = this.movementForm.value as {
      line: string;
      request_type: CreatePortalMovementRequest['request_type'];
      quantity: number;
      requested_date: string;
      notes: string;
    };
    const [warehouseId, stockItemId] = val.line.split('|');
    const payload: CreatePortalMovementRequest = {
      warehouse_id: warehouseId,
      stock_item_id: stockItemId,
      request_type: val.request_type,
      quantity: val.quantity,
      requested_date: val.requested_date || null,
      notes: val.notes || null,
    };
    this.loading.set(true);
    this.portalApi.createMovementRequest(this.token(), payload).subscribe({
      next: () => {
        this.loading.set(false);
        this.msg.success(this.t('PORTAL.MOVEMENT_REQUEST_CREATED'));
        this.movementModalVisible.set(false);
        this.loadStockAndMovements();
      },
      error: () => {
        this.loading.set(false);
        this.msg.error(this.t('PORTAL.ACTION_ERROR'));
      },
    });
  }

  // Customs shipment requests
  openShipmentModal(): void {
    this.shipmentForm.reset({
      service_type: 'Standard Air Cargo',
      direction: 'export',
      origin_country: 'IT',
      destination_country: 'CH',
      gross_weight_kg: 10,
      packages: 1,
    });
    this.shipmentModalVisible.set(true);
  }

  submitShipmentRequest(): void {
    if (this.shipmentForm.invalid) {
      this.shipmentForm.markAllAsTouched();
      return;
    }
    const val = this.shipmentForm.value as CustomsPortalShipmentRequest;
    this.loading.set(true);
    this.portalApi.createCustomsShipmentRequest(this.token(), val).subscribe({
      next: () => {
        this.loading.set(false);
        this.msg.success(this.t('PORTAL.SHIPMENT_REQUEST_CREATED'));
        this.shipmentModalVisible.set(false);
        this.loadCustoms();
      },
      error: () => {
        this.loading.set(false);
        this.msg.error(this.t('PORTAL.ACTION_ERROR'));
      },
    });
  }

  // Helpers
  getPaymentStatusBadge(status: string): string {
    switch (status) {
      case 'paid':
        return 'success';
      case 'partial':
        return 'warning';
      case 'overdue':
        return 'error';
      default:
        return 'default';
    }
  }

  getTicketStatusBadge(status: string): string {
    switch (status) {
      case 'resolved':
      case 'closed':
        return 'success';
      case 'pending':
        return 'warning';
      case 'open':
        return 'processing';
      default:
        return 'default';
    }
  }

  private t(key: string): string {
    return this.translate.instant(key);
  }
}
