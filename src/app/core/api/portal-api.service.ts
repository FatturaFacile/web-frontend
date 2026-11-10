import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import {
  AnswerPortalCsatRequest,
  ApiResponse,
  ApprovePortalQuoteRequest,
  CreatePortalMovementRequest,
  CreatePortalTicketRequest,
  CustomsPortalDossier,
  CustomsPortalShipmentRequest,
  PortalAccessData,
  PortalAppointment,
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
  PortalStockMovementPage,
  PortalSubscription,
  PortalTicketListItem,
  PortalTicketReplyRequest,
  PayslipLinkRequest,
  RejectPortalQuoteRequest,
  ReplyPortalTicketRequest,
} from '../models';

@Service()
export class PortalApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/portal`;

  getAccess(token: string): Observable<ApiResponse<PortalAccessData>> {
    return this.http.get<ApiResponse<PortalAccessData>>(`${this.base}/access/${token}`);
  }

  getQuote(token: string): Observable<ApiResponse<PortalQuote>> {
    return this.http.get<ApiResponse<PortalQuote>>(`${this.base}/quotes/${token}`);
  }

  approveQuote(token: string, payload: ApprovePortalQuoteRequest): Observable<ApiResponse<{ message: string; quote: PortalQuote }>> {
    return this.http.post<ApiResponse<{ message: string; quote: PortalQuote }>>(`${this.base}/quotes/${token}/approve`, payload);
  }

  rejectQuote(token: string, payload: RejectPortalQuoteRequest): Observable<ApiResponse<{ message: string; quote: PortalQuote }>> {
    return this.http.post<ApiResponse<{ message: string; quote: PortalQuote }>>(`${this.base}/quotes/${token}/reject`, payload);
  }

  downloadQuotePdf(token: string): Observable<Blob> {
    return this.http.get(`${this.base}/quotes/${token}/pdf`, { responseType: 'blob' });
  }

  getInvoices(token: string): Observable<ApiResponse<PortalInvoice[]>> {
    return this.http.get<ApiResponse<PortalInvoice[]>>(`${this.base}/invoices/${token}`);
  }

  downloadInvoicePdf(token: string, invoiceId: string): Observable<Blob> {
    return this.http.get(`${this.base}/invoices/${token}/${invoiceId}/pdf`, { responseType: 'blob' });
  }

  getServiceReports(token: string): Observable<ApiResponse<PortalServiceReport[]>> {
    return this.http.get<ApiResponse<PortalServiceReport[]>>(`${this.base}/service-reports/${token}`);
  }

  downloadServiceReportPdf(token: string, reportId: string): Observable<Blob> {
    return this.http.get(`${this.base}/service-reports/${token}/${reportId}/pdf`, { responseType: 'blob' });
  }

  getTickets(token: string): Observable<ApiResponse<PortalHelpdeskTicket[]>> {
    return this.http.get<ApiResponse<PortalHelpdeskTicket[]>>(`${this.base}/helpdesk/${token}/tickets`);
  }

  getTicket(token: string, ticketId: string): Observable<ApiResponse<PortalHelpdeskTicket & { messages: PortalHelpdeskMessage[] }>> {
    return this.http.get<ApiResponse<PortalHelpdeskTicket & { messages: PortalHelpdeskMessage[] }>>(
      `${this.base}/helpdesk/${token}/tickets/${ticketId}`
    );
  }

  createTicket(token: string, payload: CreatePortalTicketRequest): Observable<ApiResponse<PortalHelpdeskTicket>> {
    return this.http.post<ApiResponse<PortalHelpdeskTicket>>(`${this.base}/helpdesk/${token}/tickets`, payload);
  }

  replyTicket(token: string, ticketId: string, payload: ReplyPortalTicketRequest): Observable<ApiResponse<PortalHelpdeskMessage>> {
    return this.http.post<ApiResponse<PortalHelpdeskMessage>>(`${this.base}/helpdesk/${token}/tickets/${ticketId}/reply`, payload);
  }

  /** Tickets of the customer (helpdesk and former tickets table) with their customer-facing messages, 20 per page. */
  getPortalTickets(token: string, page = 1): Observable<ApiResponse<PortalTicketListItem[]> & { meta: { current_page: number; per_page: number; total: number } }> {
    return this.http.get<ApiResponse<PortalTicketListItem[]> & { meta: { current_page: number; per_page: number; total: number } }>(
      `${this.base}/tickets/${token}`,
      { params: new HttpParams().set('page', String(page)) },
    );
  }

  /** Reply to a ticket listed by `getPortalTickets`; files travel as multipart form data. */
  replyPortalTicket(token: string, ticketId: string, payload: PortalTicketReplyRequest): Observable<ApiResponse<PortalHelpdeskMessage>> {
    const body = new FormData();
    body.append('message', payload.message);
    if (payload.author_name) {
      body.append('author_name', payload.author_name);
    }
    for (const file of payload.attachments ?? []) {
      body.append('attachments[]', file);
    }
    return this.http.post<ApiResponse<PortalHelpdeskMessage>>(`${this.base}/tickets/${token}/reply/${ticketId}`, body);
  }

  downloadAttachment(token: string, attachmentId: string): Observable<Blob> {
    return this.http.get(`${this.base}/attachments/${token}/${attachmentId}`, { responseType: 'blob' });
  }

  downloadHelpdeskAttachment(token: string, ticketId: string, attachmentId: string): Observable<Blob> {
    return this.http.get(`${this.base}/helpdesk/${token}/tickets/${ticketId}/attachments/${attachmentId}`, {
      responseType: 'blob',
    });
  }

  getStockMovements(token: string, page = 1): Observable<PortalStockMovementPage> {
    return this.http.get<PortalStockMovementPage>(`${this.base}/stock-movements/${token}`, {
      params: new HttpParams().set('page', String(page)),
    });
  }

  /** Public payslip link: the PDF is returned against the date of birth of the employee (every failure answers 404). */
  openPayslipLink(token: string, payload: PayslipLinkRequest): Observable<Blob> {
    return this.http.post(`${this.base}/payslips/${token}`, payload, { responseType: 'blob' });
  }

  getAppointments(token: string): Observable<ApiResponse<PortalAppointment[]>> {
    return this.http.get<ApiResponse<PortalAppointment[]>>(`${this.base}/appointments/${token}`);
  }

  getCsat(token: string): Observable<ApiResponse<PortalCsatSurvey>> {
    return this.http.get<ApiResponse<PortalCsatSurvey>>(`${this.base}/csat/${token}`);
  }

  answerCsat(token: string, payload: AnswerPortalCsatRequest): Observable<ApiResponse<PortalCsatSurvey>> {
    return this.http.post<ApiResponse<PortalCsatSurvey>>(`${this.base}/csat/${token}`, payload);
  }

  getKnowledgeCategories(token: string): Observable<ApiResponse<PortalKnowledgeCategory[]>> {
    return this.http.get<ApiResponse<PortalKnowledgeCategory[]>>(`${this.base}/kb/${token}/categories`);
  }

  getKnowledgeArticles(
    token: string,
    params?: { query?: string; category_id?: string }
  ): Observable<ApiResponse<PortalKnowledgeArticle[]>> {
    let httpParams = new HttpParams();
    if (params?.query) httpParams = httpParams.set('q', params.query);
    if (params?.category_id) httpParams = httpParams.set('knowledge_category_id', params.category_id);

    return this.http.get<ApiResponse<PortalKnowledgeArticle[]>>(`${this.base}/kb/${token}/articles`, {
      params: httpParams,
    });
  }

  getKnowledgeArticle(token: string, id: string): Observable<ApiResponse<PortalKnowledgeArticle>> {
    return this.http.get<ApiResponse<PortalKnowledgeArticle>>(`${this.base}/kb/${token}/articles/${id}`);
  }

  getSubscriptions(token: string): Observable<ApiResponse<PortalSubscription[]>> {
    return this.http.get<ApiResponse<PortalSubscription[]>>(`${this.base}/subscriptions/${token}`);
  }

  getStock(token: string): Observable<ApiResponse<PortalStockLine[]>> {
    return this.http.get<ApiResponse<PortalStockLine[]>>(`${this.base}/stock/${token}`);
  }

  getMovementRequests(token: string): Observable<ApiResponse<PortalMovementRequest[]>> {
    return this.http.get<ApiResponse<PortalMovementRequest[]>>(`${this.base}/movement-requests/${token}`);
  }

  createMovementRequest(token: string, payload: CreatePortalMovementRequest): Observable<ApiResponse<PortalMovementRequest>> {
    return this.http.post<ApiResponse<PortalMovementRequest>>(`${this.base}/movement-requests/${token}`, payload);
  }

  getCustomsDossiers(token: string): Observable<ApiResponse<CustomsPortalDossier[]>> {
    return this.http.get<ApiResponse<CustomsPortalDossier[]>>(`${this.base}/customs/${token}/dossiers`);
  }

  createCustomsShipmentRequest(token: string, payload: CustomsPortalShipmentRequest): Observable<ApiResponse<CustomsPortalDossier>> {
    return this.http.post<ApiResponse<CustomsPortalDossier>>(`${this.base}/customs/${token}/shipment-requests`, payload);
  }
}
