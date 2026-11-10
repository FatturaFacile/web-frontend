import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  AnswerPortalCsatRequest,
  ApprovePortalQuoteRequest,
  CreatePortalMovementRequest,
  CreatePortalTicketRequest,
  CustomsPortalDossier,
  CustomsPortalShipmentRequest,
  PortalAccessData,
  PortalAppointment,
  PortalHelpdeskMessage,
  PortalHelpdeskTicket,
  PortalInvoice,
  PortalKnowledgeArticle,
  PortalKnowledgeCategory,
  PortalMovementRequest,
  PortalQuote,
  PortalServiceReport,
  PortalStockLine,
  PortalSubscription,
  RejectPortalQuoteRequest,
  ReplyPortalTicketRequest,
} from '../models';
import { PortalApiService } from './portal-api.service';

describe('PortalApiService', () => {
  let service: PortalApiService;
  let httpMock: HttpTestingController;

  const mockAccess: PortalAccessData = {
    customer: {
      id: 'cust-1',
      name: 'Acme Corp',
      email: 'info@acme.com',
      vat_number: 'IT12345678901',
    },
    summary: {
      pending_quotes: 2,
      unpaid_invoices: 1,
      open_tickets: 3,
      upcoming_appointments: 1,
    },
  };

  const mockQuote: PortalQuote = {
    id: 'quote-1',
    quote_number: 'PREV-2026-001',
    date: '2026-03-01',
    currency: 'EUR',
    total_net: 1000,
    total_tax: 220,
    total_gross: 1220,
    status: 'sent',
    is_accepted: false,
    is_rejected: false,
    items: [],
  };

  const mockInvoice: PortalInvoice = {
    id: 'inv-1',
    invoice_number: 'FATT-2026-042',
    date: '2026-03-10',
    currency: 'EUR',
    total_net: 500,
    total_tax: 110,
    total_gross: 610,
    total_paid: 0,
    payment_status: 'unpaid',
    is_paid: false,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [PortalApiService, provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(PortalApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  it('should validate token and fetch customer access dashboard', () => {
    service.getAccess('magic-token-xyz').subscribe((res) => {
      expect(res.data.customer.name).toBe('Acme Corp');
      expect(res.data.summary.open_tickets).toBe(3);
    });

    const req = httpMock.expectOne('/api/v1/portal/access/magic-token-xyz');
    expect(req.request.method).toBe('GET');
    req.flush({ data: mockAccess });
  });

  it('should handle quote details, acceptance, rejection, and PDF download', () => {
    service.getQuote('token-123').subscribe((res) => {
      expect(res.data.quote_number).toBe('PREV-2026-001');
    });
    const req1 = httpMock.expectOne('/api/v1/portal/quotes/token-123');
    req1.flush({ data: mockQuote });

    const approvePayload: ApprovePortalQuoteRequest = { signer_name: 'Mario Rossi' };
    service.approveQuote('token-123', approvePayload).subscribe((res) => {
      expect(res.data.message).toBe('Quote accepted');
    });
    const req2 = httpMock.expectOne('/api/v1/portal/quotes/token-123/approve');
    expect(req2.request.method).toBe('POST');
    req2.flush({ data: { message: 'Quote accepted', quote: { ...mockQuote, is_accepted: true } } });

    const rejectPayload: RejectPortalQuoteRequest = { reason: 'Budget exceeded' };
    service.rejectQuote('token-123', rejectPayload).subscribe((res) => {
      expect(res.data.message).toBe('Quote rejected');
    });
    const req3 = httpMock.expectOne('/api/v1/portal/quotes/token-123/reject');
    expect(req3.request.method).toBe('POST');
    req3.flush({ data: { message: 'Quote rejected', quote: { ...mockQuote, is_rejected: true } } });

    service.downloadQuotePdf('token-123').subscribe((blob) => {
      expect(blob).toBeTruthy();
    });
    const req4 = httpMock.expectOne('/api/v1/portal/quotes/token-123/pdf');
    req4.flush(new Blob());
  });

  it('should retrieve invoices, service reports, appointments, and subscriptions', () => {
    service.getInvoices('token-123').subscribe((res) => {
      expect(res.data.length).toBe(1);
    });
    const req1 = httpMock.expectOne('/api/v1/portal/invoices/token-123');
    req1.flush({ data: [mockInvoice] });

    service.downloadInvoicePdf('token-123', 'inv-1').subscribe((blob) => {
      expect(blob).toBeTruthy();
    });
    const req2 = httpMock.expectOne('/api/v1/portal/invoices/token-123/inv-1/pdf');
    req2.flush(new Blob());

    const mockReport: PortalServiceReport = {
      id: 'rep-1',
      report_number: 'RAPP-101',
      report_date: '2026-03-05',
      total_hours: 3.5,
      is_signed: true,
      lines: [],
    };
    service.getServiceReports('token-123').subscribe((res) => {
      expect(res.data[0].report_number).toBe('RAPP-101');
    });
    const req3 = httpMock.expectOne('/api/v1/portal/service-reports/token-123');
    req3.flush({ data: [mockReport] });

    const mockAppointment: PortalAppointment = {
      id: 'apt-1',
      title: 'Annual HVAC Maintenance',
      start_at: '2026-04-01T09:00:00Z',
      end_at: '2026-04-01T11:00:00Z',
      status: 'confirmed',
    };
    service.getAppointments('token-123').subscribe((res) => {
      expect(res.data[0].title).toContain('HVAC');
    });
    const req4 = httpMock.expectOne('/api/v1/portal/appointments/token-123');
    req4.flush({ data: [mockAppointment] });

    const mockSub: PortalSubscription = {
      id: 'sub-1',
      subscription_number: 'SUB-2026',
      name: 'Cloud Maintenance Plan',
      plan: 'Enterprise',
      status: 'active',
      currency: 'EUR',
      auto_renew: true,
    };
    service.getSubscriptions('token-123').subscribe((res) => {
      expect(res.data[0].plan).toBe('Enterprise');
    });
    const req5 = httpMock.expectOne('/api/v1/portal/subscriptions/token-123');
    req5.flush({ data: [mockSub] });
  });

  it('should handle support tickets, replies, CSAT, KB, stock, and customs shipment requests', () => {
    const mockTicket: PortalHelpdeskTicket = {
      id: 'tick-1',
      ticket_number: 'HD-991',
      subject: 'Billing question',
      status: 'open',
      priority: 'normal',
      created_at: '2026-03-11T09:00:00Z',
    };

    service.getTickets('token-123').subscribe((res) => {
      expect(res.data[0].ticket_number).toBe('HD-991');
    });
    const req1 = httpMock.expectOne('/api/v1/portal/helpdesk/token-123/tickets');
    req1.flush({ data: [mockTicket] });

    const createPayload: CreatePortalTicketRequest = {
      subject: 'Urgent printer repair',
      description: 'Paper jam on primary unit',
    };
    service.createTicket('token-123', createPayload).subscribe((res) => {
      expect(res.data.id).toBe('tick-2');
    });
    const req2 = httpMock.expectOne('/api/v1/portal/helpdesk/token-123/tickets');
    expect(req2.request.method).toBe('POST');
    req2.flush({ data: { ...mockTicket, id: 'tick-2', subject: createPayload.subject } });

    const replyPayload: ReplyPortalTicketRequest = { message: 'Technician arrived, all good' };
    const mockMsg: PortalHelpdeskMessage = {
      id: 'msg-1',
      message: replyPayload.message,
      created_at: '2026-03-11T12:00:00Z',
    };
    service.replyTicket('token-123', 'tick-1', replyPayload).subscribe((res) => {
      expect(res.data.message).toBe(replyPayload.message);
    });
    const req3 = httpMock.expectOne('/api/v1/portal/helpdesk/token-123/tickets/tick-1/reply');
    expect(req3.request.method).toBe('POST');
    req3.flush({ data: mockMsg });

    const csatPayload: AnswerPortalCsatRequest = { score: 5, feedback: 'Great response speed' };
    service.answerCsat('token-123', csatPayload).subscribe((res) => {
      expect(res.data.score).toBe(5);
    });
    const req4 = httpMock.expectOne('/api/v1/portal/csat/token-123');
    req4.flush({ data: { ticket_id: 'tick-1', ticket_number: 'HD-991', can_answer: false, score: 5 } });

    const mockCategory: PortalKnowledgeCategory = { id: 'cat-1', name: 'Invoicing FAQ' };
    service.getKnowledgeCategories('token-123').subscribe((res) => {
      expect(res.data[0].name).toBe('Invoicing FAQ');
    });
    const req5 = httpMock.expectOne('/api/v1/portal/kb/token-123/categories');
    req5.flush({ data: [mockCategory] });

    const mockArticle: PortalKnowledgeArticle = {
      id: 'art-1',
      title: 'How to pay invoices online',
      content: 'You can use SEPA or credit card',
    };
    service.getKnowledgeArticles('token-123', { query: 'pay' }).subscribe((res) => {
      expect(res.data[0].title).toContain('pay');
    });
    const req6 = httpMock.expectOne('/api/v1/portal/kb/token-123/articles?q=pay');
    req6.flush({ data: [mockArticle] });

    const mockStock: PortalStockLine = {
      id: 'stk-1',
      product_sku: 'PROD-A',
      product_name: 'Hydraulic Valve',
      warehouse_name: 'Client Hub',
      available_qty: 40,
      reserved_qty: 5,
      unit_of_measure: 'PZ',
    };
    service.getStock('token-123').subscribe((res) => {
      expect(res.data[0].available_qty).toBe(40);
    });
    const req7 = httpMock.expectOne('/api/v1/portal/stock/token-123');
    req7.flush({ data: [mockStock] });

    const movPayload: CreatePortalMovementRequest = { request_type: 'withdrawal', quantity: 10 };
    const mockMov: PortalMovementRequest = {
      id: 'mov-1',
      request_type: 'withdrawal',
      quantity: '10',
      status: 'pending',
    };
    service.createMovementRequest('token-123', movPayload).subscribe((res) => {
      expect(res.data.status).toBe('pending');
    });
    const req8 = httpMock.expectOne('/api/v1/portal/movement-requests/token-123');
    req8.flush({ data: mockMov });

    const shipmentPayload: CustomsPortalShipmentRequest = {
      service_type: 'Express Cargo',
      direction: 'export',
      origin_country: 'IT',
      destination_country: 'CH',
      gross_weight_kg: 150,
      packages: 2,
    };
    const mockDossier: CustomsPortalDossier = {
      id: 'dos-1',
      dossier_number: 'EXP-CH-88',
      direction: 'export',
      status: 'draft',
      origin_country: 'IT',
      destination_country: 'CH',
      packages: 2,
      gross_weight_kg: 150,
      created_at: '2026-03-12T14:00:00Z',
    };
    service.createCustomsShipmentRequest('token-123', shipmentPayload).subscribe((res) => {
      expect(res.data.dossier_number).toBe('EXP-CH-88');
    });
    const req9 = httpMock.expectOne('/api/v1/portal/customs/token-123/shipment-requests');
    req9.flush({ data: mockDossier });
  });

  it('lists the stock movements of the customer page by page', () => {
    service.getStockMovements('token-123', 2).subscribe((res) => {
      expect(res.data[0].quantity).toBe('12.500');
      expect(res.meta.total).toBe(31);
    });
    const req = httpMock.expectOne((r) => r.url === '/api/v1/portal/stock-movements/token-123');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('page')).toBe('2');
    req.flush({
      data: [{ id: 'm1', executed_at: '2026-03-01T10:00:00Z', direction: 'in', sku: 'A1', name: 'Bolt', lot_number: null, quantity: '12.500' }],
      meta: { current_page: 2, last_page: 2, total: 31 },
    });
  });

  it('downloads attachments as blobs, through the generic and the helpdesk routes', () => {
    service.downloadAttachment('token-123', 'att-1').subscribe((blob) => expect(blob.size).toBe(3));
    const generic = httpMock.expectOne('/api/v1/portal/attachments/token-123/att-1');
    expect(generic.request.responseType).toBe('blob');
    generic.flush(new Blob(['pdf']));

    service.downloadHelpdeskAttachment('token-123', 'tkt-1', 'att-2').subscribe((blob) => expect(blob.size).toBe(3));
    const helpdesk = httpMock.expectOne('/api/v1/portal/helpdesk/token-123/tickets/tkt-1/attachments/att-2');
    expect(helpdesk.request.responseType).toBe('blob');
    helpdesk.flush(new Blob(['png']));
  });

  it('lists portal tickets and replies with multipart attachments', () => {
    service.getPortalTickets('token-123').subscribe((res) => {
      expect(res.meta.per_page).toBe(20);
    });
    const list = httpMock.expectOne((r) => r.url === '/api/v1/portal/tickets/token-123');
    expect(list.request.params.get('page')).toBe('1');
    list.flush({ success: true, message: '', data: [], meta: { current_page: 1, per_page: 20, total: 0 } });

    const file = new File(['x'], 'photo.png', { type: 'image/png' });
    service.replyPortalTicket('token-123', 'tkt-1', { message: 'Thanks', author_name: 'Mario', attachments: [file] }).subscribe();
    const reply = httpMock.expectOne('/api/v1/portal/tickets/token-123/reply/tkt-1');
    expect(reply.request.method).toBe('POST');
    const form = reply.request.body as FormData;
    expect(form.get('message')).toBe('Thanks');
    expect(form.get('author_name')).toBe('Mario');
    expect((form.getAll('attachments[]')[0] as File).name).toBe('photo.png');
    reply.flush({ success: true, message: '', data: { id: 'msg-1' } });
  });

  it('opens a payslip link with the date of birth and receives the PDF', () => {
    service.openPayslipLink('slip-token', { birth_date: '1985-04-12' }).subscribe((blob) => expect(blob.size).toBe(3));
    const req = httpMock.expectOne('/api/v1/portal/payslips/slip-token');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ birth_date: '1985-04-12' });
    expect(req.request.responseType).toBe('blob');
    req.flush(new Blob(['pdf']));
  });
});
