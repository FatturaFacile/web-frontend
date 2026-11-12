import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { NzMessageService } from 'ng-zorro-antd/message';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { icons } from '../../icons-provider';
import {
  PortalAccessData,
  PortalApiService,
  PortalCsatSurvey,
  PortalHelpdeskTicket,
  PortalInvoice,
  PortalKnowledgeArticle,
  PortalQuote,
  PortalServiceReport,
  TranslateService,
} from '@core';
import { PortalComponent } from './portal.component';

describe('PortalComponent', () => {
  let component: PortalComponent;
  let fixture: ComponentFixture<PortalComponent>;
  let apiMock: {
    getAccess: ReturnType<typeof vi.fn>;
    getQuote: ReturnType<typeof vi.fn>;
    approveQuote: ReturnType<typeof vi.fn>;
    rejectQuote: ReturnType<typeof vi.fn>;
    downloadQuotePdf: ReturnType<typeof vi.fn>;
    getInvoices: ReturnType<typeof vi.fn>;
    downloadInvoicePdf: ReturnType<typeof vi.fn>;
    getServiceReports: ReturnType<typeof vi.fn>;
    downloadServiceReportPdf: ReturnType<typeof vi.fn>;
    getTickets: ReturnType<typeof vi.fn>;
    getTicket: ReturnType<typeof vi.fn>;
    createTicket: ReturnType<typeof vi.fn>;
    replyTicket: ReturnType<typeof vi.fn>;
    getAppointments: ReturnType<typeof vi.fn>;
    getCsat: ReturnType<typeof vi.fn>;
    answerCsat: ReturnType<typeof vi.fn>;
    getKnowledgeCategories: ReturnType<typeof vi.fn>;
    getKnowledgeArticles: ReturnType<typeof vi.fn>;
    getKnowledgeArticle: ReturnType<typeof vi.fn>;
    getSubscriptions: ReturnType<typeof vi.fn>;
    getStock: ReturnType<typeof vi.fn>;
    getMovementRequests: ReturnType<typeof vi.fn>;
    getStockMovements: ReturnType<typeof vi.fn>;
    downloadAttachment: ReturnType<typeof vi.fn>;
    downloadHelpdeskAttachment: ReturnType<typeof vi.fn>;
    createMovementRequest: ReturnType<typeof vi.fn>;
    getCustomsDossiers: ReturnType<typeof vi.fn>;
    createCustomsShipmentRequest: ReturnType<typeof vi.fn>;
  };
  let msgMock: {
    success: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
    info: ReturnType<typeof vi.fn>;
    warning: ReturnType<typeof vi.fn>;
  };
  let translateMock: {
    instant: ReturnType<typeof vi.fn>;
    get: ReturnType<typeof vi.fn>;
  };

  const mockAccess: PortalAccessData = {
    customer: {
      id: 'cust-1',
      name: 'Alpha Industries Srl',
      email: 'admin@alphaindustries.it',
      vat_number: 'IT98765432101',
    },
    summary: {
      pending_quotes: 1,
      unpaid_invoices: 2,
      open_tickets: 1,
      upcoming_appointments: 1,
    },
  };

  const mockQuote: PortalQuote = {
    id: 'quote-101',
    quote_number: 'PREV-2026-101',
    date: '2026-03-01',
    valid_until: '2026-04-01',
    currency: 'EUR',
    total_net: 2000,
    total_tax: 440,
    total_gross: 2440,
    status: 'sent',
    is_accepted: false,
    is_rejected: false,
    items: [],
  };

  const mockInvoice: PortalInvoice = {
    id: 'inv-201',
    invoice_number: 'FATT-2026-201',
    date: '2026-03-05',
    currency: 'EUR',
    total_net: 1500,
    total_tax: 330,
    total_gross: 1830,
    total_paid: 0,
    payment_status: 'unpaid',
    is_paid: false,
  };

  const mockReport: PortalServiceReport = {
    id: 'rep-301',
    report_number: 'SR-301',
    report_date: '2026-03-08',
    total_hours: 4,
    is_signed: true,
    lines: [],
  };

  const mockTicket: PortalHelpdeskTicket = {
    id: 'tick-401',
    ticket_number: 'TICK-401',
    subject: 'Network slow down',
    status: 'open',
    priority: 'high',
    created_at: '2026-03-10T08:00:00Z',
  };

  const mockCsat: PortalCsatSurvey = {
    ticket_id: 'tick-401',
    ticket_number: 'TICK-401',
    can_answer: true,
  };

  const mockArticle: PortalKnowledgeArticle = {
    id: 'art-501',
    title: 'Connecting VPN',
    content: 'Step 1: Open client...',
  };

  beforeEach(() => {
    apiMock = {
      getAccess: vi.fn().mockReturnValue(of({ data: mockAccess })),
      getQuote: vi.fn().mockReturnValue(of({ data: mockQuote })),
      approveQuote: vi.fn().mockReturnValue(of({ data: { message: 'Approved', quote: mockQuote } })),
      rejectQuote: vi.fn().mockReturnValue(of({ data: { message: 'Rejected', quote: mockQuote } })),
      downloadQuotePdf: vi.fn().mockReturnValue(of(new Blob(['pdf-content'], { type: 'application/pdf' }))),
      getInvoices: vi.fn().mockReturnValue(of({ data: [mockInvoice] })),
      downloadInvoicePdf: vi.fn().mockReturnValue(of(new Blob(['pdf-content'], { type: 'application/pdf' }))),
      getServiceReports: vi.fn().mockReturnValue(of({ data: [mockReport] })),
      downloadServiceReportPdf: vi.fn().mockReturnValue(of(new Blob(['pdf-content'], { type: 'application/pdf' }))),
      getTickets: vi.fn().mockReturnValue(of({ data: [mockTicket] })),
      getTicket: vi.fn().mockReturnValue(
        of({
          data: {
            ...mockTicket,
            messages: [
              { id: 'm-1', message: 'Hello, need help', created_at: '2026-03-10T08:05:00Z', author_type: 'customer' },
            ],
          },
        })
      ),
      createTicket: vi.fn().mockReturnValue(of({ data: mockTicket })),
      replyTicket: vi.fn().mockReturnValue(of({ data: { id: 'm-2', message: 'We are on it' } })),
      getAppointments: vi.fn().mockReturnValue(of({ data: [] })),
      getCsat: vi.fn().mockReturnValue(of({ data: mockCsat })),
      answerCsat: vi.fn().mockReturnValue(of({ data: { ...mockCsat, can_answer: false, score: 5 } })),
      getKnowledgeCategories: vi.fn().mockReturnValue(of({ data: [] })),
      getKnowledgeArticles: vi.fn().mockReturnValue(of({ data: [mockArticle] })),
      getKnowledgeArticle: vi.fn().mockReturnValue(of({ data: mockArticle })),
      getSubscriptions: vi.fn().mockReturnValue(of({ data: [] })),
      getStock: vi.fn().mockReturnValue(of({ data: [] })),
      getMovementRequests: vi.fn().mockReturnValue(of({ data: [] })),
      getStockMovements: vi.fn().mockReturnValue(
        of({
          data: [{ id: 'mv-1', executed_at: '2026-03-01T10:00:00Z', direction: 'in', sku: 'A1', name: 'Bolt', lot_number: null, quantity: '5.000' }],
          meta: { current_page: 1, last_page: 2, total: 2 },
        }),
      ),
      downloadAttachment: vi.fn().mockReturnValue(of(new Blob(['x']))),
      downloadHelpdeskAttachment: vi.fn().mockReturnValue(of(new Blob(['x']))),
      createMovementRequest: vi.fn().mockReturnValue(of({ data: {} })),
      getCustomsDossiers: vi.fn().mockReturnValue(of({ data: [] })),
      createCustomsShipmentRequest: vi.fn().mockReturnValue(of({ data: {} })),
    };

    msgMock = {
      success: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      warning: vi.fn(),
    };

    translateMock = {
      instant: vi.fn((key: string) => key),
      translate: vi.fn((key: string) => key),
      get: vi.fn((key: string) => of(key)),
    };

    TestBed.configureTestingModule({
      imports: [PortalComponent],
      providers: [
        provideNzIcons(icons),
        { provide: PortalApiService, useValue: apiMock },
        { provide: NzMessageService, useValue: msgMock },
        { provide: TranslateService, useValue: translateMock },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: { get: () => 'test-token-777' },
              queryParamMap: { get: () => null },
            },
          },
        },
      ],
    });

    // Mock URL.createObjectURL and URL.revokeObjectURL
    window.URL.createObjectURL = vi.fn().mockReturnValue('blob:test');
    window.URL.revokeObjectURL = vi.fn();

    fixture = TestBed.createComponent(PortalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should initialize and load customer access, quotes, invoices, tickets, and KB', () => {
    expect(component.token()).toBe('test-token-777');
    expect(apiMock.getAccess).toHaveBeenCalledWith('test-token-777');
    expect(component.accessData()?.customer.name).toBe('Alpha Industries Srl');
    expect(component.quotes().length).toBe(1);
    expect(component.invoices().length).toBe(1);
    expect(component.tickets().length).toBe(1);
    expect(component.kbArticles().length).toBe(1);
  });

  it('should open approve quote modal and approve quote', () => {
    component.openApproveModal(mockQuote);
    expect(component.approveModalVisible()).toBe(true);

    component.approveForm.patchValue({
      signer_name: 'Mario Rossi',
      notes: 'Approved as discussed',
    });

    component.submitApproveQuote();
    expect(apiMock.approveQuote).toHaveBeenCalledWith('test-token-777', {
      signer_name: 'Mario Rossi',
      notes: 'Approved as discussed',
    });
    expect(msgMock.success).toHaveBeenCalledWith('PORTAL.QUOTE_APPROVED_SUCCESS');
    expect(component.approveModalVisible()).toBe(false);
  });

  it('should not call the API when the approve and shipment forms are submitted empty or invalid', () => {
    component.openApproveModal(mockQuote);
    component.approveForm.patchValue({ signer_name: '' });
    component.submitApproveQuote();
    expect(apiMock.approveQuote).not.toHaveBeenCalled();
    expect(component.approveForm.controls['signer_name'].touched).toBe(true);

    component.openShipmentModal();
    component.shipmentForm.patchValue({ service_type: '', packages: 0 });
    component.submitShipmentRequest();
    expect(apiMock.createCustomsShipmentRequest).not.toHaveBeenCalled();
  });

  it('should open reject quote modal and reject quote', () => {
    component.openRejectModal(mockQuote);
    expect(component.rejectModalVisible()).toBe(true);

    component.rejectForm.patchValue({
      reason: 'Pricing out of range',
    });

    component.submitRejectQuote();
    expect(apiMock.rejectQuote).toHaveBeenCalledWith('test-token-777', {
      reason: 'Pricing out of range',
    });
    expect(msgMock.info).toHaveBeenCalledWith('PORTAL.QUOTE_REJECTED_SUCCESS');
    expect(component.rejectModalVisible()).toBe(false);
  });

  it('should trigger PDF downloads for quote, invoice, and service report', () => {
    component.selectedQuote.set(mockQuote);
    component.downloadQuotePdf();
    expect(apiMock.downloadQuotePdf).toHaveBeenCalledWith('test-token-777');
    expect(window.URL.createObjectURL).toHaveBeenCalled();

    component.downloadInvoicePdf(mockInvoice);
    expect(apiMock.downloadInvoicePdf).toHaveBeenCalledWith('test-token-777', 'inv-201');

    component.downloadServiceReportPdf(mockReport);
    expect(apiMock.downloadServiceReportPdf).toHaveBeenCalledWith('test-token-777', 'rep-301');
  });

  it('should create a new support ticket', () => {
    component.openCreateTicketModal();
    expect(component.createTicketModalVisible()).toBe(true);

    component.ticketForm.patchValue({
      subject: 'VPN configuration error',
      description: 'Cannot connect to gateway',
    });

    component.submitCreateTicket();
    expect(apiMock.createTicket).toHaveBeenCalledWith('test-token-777', {
      subject: 'VPN configuration error',
      description: 'Cannot connect to gateway',
    });
    expect(msgMock.success).toHaveBeenCalledWith('PORTAL.TICKET_CREATED_SUCCESS');
    expect(component.createTicketModalVisible()).toBe(false);
  });

  it('should open ticket drawer, view messages and send a reply', () => {
    component.openTicketDrawer(mockTicket);
    expect(apiMock.getTicket).toHaveBeenCalledWith('test-token-777', 'tick-401');
    expect(component.ticketDrawerVisible()).toBe(true);
    expect(component.selectedTicket()?.messages.length).toBe(1);

    component.replyForm.patchValue({
      message: 'Still having issues after reboot',
      author_name: 'Mario Rossi',
    });

    component.submitTicketReply();
    expect(apiMock.replyTicket).toHaveBeenCalledWith('test-token-777', 'tick-401', {
      message: 'Still having issues after reboot',
      author_name: 'Mario Rossi',
    });
    expect(msgMock.success).toHaveBeenCalledWith('PORTAL.REPLY_SENT_SUCCESS');
  });

  it('should submit CSAT satisfaction survey', () => {
    component.openCsatModal();
    expect(component.csatModalVisible()).toBe(true);

    component.csatForm.patchValue({
      score: 5,
      feedback: 'Excellent response time',
    });

    component.submitCsat();
    expect(apiMock.answerCsat).toHaveBeenCalledWith('test-token-777', {
      score: 5,
      feedback: 'Excellent response time',
    });
    expect(msgMock.success).toHaveBeenCalledWith('PORTAL.SURVEY_SUBMITTED_SUCCESS');
    expect(component.csatModalVisible()).toBe(false);
  });

  it('should open knowledge article detail modal and search articles', () => {
    component.openArticleModal(mockArticle);
    expect(component.articleModalVisible()).toBe(true);
    expect(component.selectedArticle()?.title).toBe('Connecting VPN');

    component.kbSearchQuery.set('VPN');
    component.searchKnowledgeBase();
    expect(apiMock.getKnowledgeArticles).toHaveBeenCalledWith('test-token-777', { query: 'VPN' });
  });

  it('should load the stock movement history page by page', () => {
    expect(apiMock.getStockMovements).toHaveBeenCalledWith('test-token-777', 1);
    expect(component.stockMovements().length).toBe(1);
    expect(component.stockMovementsHasMore()).toBe(true);

    apiMock.getStockMovements.mockReturnValue(
      of({
        data: [{ id: 'mv-2', executed_at: null, direction: 'out', sku: null, name: null, lot_number: 'L1', quantity: '1.000' }],
        meta: { current_page: 2, last_page: 2, total: 2 },
      }),
    );
    component.loadMoreStockMovements();
    expect(apiMock.getStockMovements).toHaveBeenCalledWith('test-token-777', 2);
    expect(component.stockMovements().map((m) => m.id)).toEqual(['mv-1', 'mv-2']);
    expect(component.stockMovementsHasMore()).toBe(false);
  });

  it('should download attachments of service reports and ticket messages', () => {
    component.downloadAttachment({ id: 'att-1', original_name: 'photo.png' });
    expect(apiMock.downloadAttachment).toHaveBeenCalledWith('test-token-777', 'att-1');

    component.downloadTicketAttachment({ id: 'tkt-1' } as never, { id: 'att-2' });
    expect(apiMock.downloadHelpdeskAttachment).toHaveBeenCalledWith('test-token-777', 'tkt-1', 'att-2');
    expect(window.URL.createObjectURL).toHaveBeenCalled();
  });

  it('should submit consignment movement request', () => {
    component.openMovementModal();
    expect(component.movementModalVisible()).toBe(true);

    component.movementForm.patchValue({
      line: 'wh-1|item-1',
      request_type: 'withdrawal',
      quantity: 5,
      notes: 'Pick up for production',
    });

    component.submitMovementRequest();
    expect(apiMock.createMovementRequest).toHaveBeenCalledWith(
      'test-token-777',
      expect.objectContaining({
        warehouse_id: 'wh-1',
        stock_item_id: 'item-1',
        request_type: 'withdrawal',
        quantity: 5,
        notes: 'Pick up for production',
      }),
    );
    expect(msgMock.success).toHaveBeenCalledWith('PORTAL.MOVEMENT_REQUEST_CREATED');
    expect(component.movementModalVisible()).toBe(false);
  });

  it('rejects a movement request dated in the past', () => {
    component.openMovementModal();
    component.movementForm.patchValue({ line: 'wh-1|item-1', requested_date: '2020-01-01' });
    expect(component.movementForm.controls['requested_date'].hasError('inPast')).toBe(true);
    component.submitMovementRequest();
    expect(apiMock.createMovementRequest).not.toHaveBeenCalled();
  });

  it('should submit customs shipment request', () => {
    component.openShipmentModal();
    expect(component.shipmentModalVisible()).toBe(true);

    component.shipmentForm.patchValue({
      service_type: 'Express Cargo',
      direction: 'export',
      origin_country: 'IT',
      destination_country: 'CH',
      gross_weight_kg: 50,
      volume_m3: 0.8,
      packages: 3,
    });

    component.submitShipmentRequest();
    expect(apiMock.createCustomsShipmentRequest).toHaveBeenCalledWith(
      'test-token-777',
      expect.objectContaining({
        service_type: 'Express Cargo',
        direction: 'export',
        origin_country: 'IT',
        destination_country: 'CH',
        gross_weight_kg: 50,
        volume_m3: 0.8,
        packages: 3,
      }),
    );
    expect(msgMock.success).toHaveBeenCalledWith('PORTAL.SHIPMENT_REQUEST_CREATED');
    expect(component.shipmentModalVisible()).toBe(false);
  });

  it('should return correct badge colors for statuses', () => {
    expect(component.getPaymentStatusBadge('paid')).toBe('success');
    expect(component.getPaymentStatusBadge('partial')).toBe('warning');
    expect(component.getPaymentStatusBadge('overdue')).toBe('error');
    expect(component.getPaymentStatusBadge('other')).toBe('default');

    expect(component.getTicketStatusBadge('resolved')).toBe('success');
    expect(component.getTicketStatusBadge('closed')).toBe('success');
    expect(component.getTicketStatusBadge('pending')).toBe('warning');
    expect(component.getTicketStatusBadge('open')).toBe('processing');
    expect(component.getTicketStatusBadge('unknown')).toBe('default');
  });

  it('should handle API errors gracefully during actions', () => {
    apiMock.approveQuote.mockReturnValue(throwError(() => new Error('Approval error')));
    component.approveForm.patchValue({ signer_name: 'Test' });
    component.submitApproveQuote();
    expect(msgMock.error).toHaveBeenCalledWith('PORTAL.ACTION_ERROR');

    apiMock.createTicket.mockReturnValue(throwError(() => new Error('Ticket error')));
    component.ticketForm.patchValue({ subject: 'Sub', description: 'Desc' });
    component.submitCreateTicket();
    expect(msgMock.error).toHaveBeenCalledWith('PORTAL.ACTION_ERROR');
  });
});
