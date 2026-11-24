import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import {
  ApiResponse,
  CommercialDocumentResource,
  DailyCorrispettivoResource,
  PaginatedResponse,
  QueryFilterParams,
  RetailPosSessionPage,
  RetailReturn,
  RetailReturnPayload,
  RetailSaleRefundPayload,
  RetailTicket,
  RetailTicketLinePayload,
  RetailTicketPayload,
  RetailTicketPreview,
  StoreCommercialDocumentPayload,
} from '../models';
import { toHttpParams } from '../http/laravel-http.utils';

@Service()
export class RetailApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/fiscal-retail`;

  getCommercialDocuments(params?: QueryFilterParams): Observable<PaginatedResponse<CommercialDocumentResource>> {
    return this.http.get<PaginatedResponse<CommercialDocumentResource>>(`${this.base}/commercial-documents`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  getCommercialDocument(id: string): Observable<ApiResponse<CommercialDocumentResource>> {
    return this.http.get<ApiResponse<CommercialDocumentResource>>(`${this.base}/commercial-documents/${id}`);
  }

  createCommercialDocument(payload: StoreCommercialDocumentPayload): Observable<ApiResponse<CommercialDocumentResource>> {
    return this.http.post<ApiResponse<CommercialDocumentResource>>(`${this.base}/commercial-documents`, payload);
  }

  voidCommercialDocument(id: string): Observable<ApiResponse<CommercialDocumentResource>> {
    return this.http.post<ApiResponse<CommercialDocumentResource>>(`${this.base}/commercial-documents/${id}/void`, {});
  }

  getDailyCorrispettivi(date: string): Observable<ApiResponse<DailyCorrispettivoResource>> {
    return this.http.get<ApiResponse<DailyCorrispettivoResource>>(`${this.base}/corrispettivi/daily/${date}`);
  }

  getPosSessions(params?: QueryFilterParams): Observable<ApiResponse<RetailPosSessionPage>> {
    return this.http.get<ApiResponse<RetailPosSessionPage>>(`${environment.apiBaseUrl}/retail/pos/sessions`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }
  previewTicket(items: RetailTicketLinePayload[]): Observable<{ data: RetailTicketPreview }> {
    return this.http.post<{ data: RetailTicketPreview }>(`${this.base}/pos/promotions/preview`, { items });
  }

  createTicket(payload: RetailTicketPayload): Observable<{ data: RetailTicket }> {
    return this.http.post<{ data: RetailTicket }>(`${this.base}/pos/tickets`, payload);
  }

  getTicket(id: string): Observable<{ data: RetailTicket }> {
    return this.http.get<{ data: RetailTicket }>(`${this.base}/pos/tickets/${id}`);
  }

  createReturn(saleId: string, payload: RetailReturnPayload): Observable<{ data: RetailReturn }> {
    return this.http.post<{ data: RetailReturn }>(`${this.base}/pos/sales/${saleId}/returns`, payload);
  }

  refundSale(saleId: string, payload: RetailSaleRefundPayload): Observable<{ data: RetailReturn }> {
    return this.http.post<{ data: RetailReturn }>(`${this.base}/pos/sales/${saleId}/refund`, payload);
  }
}
