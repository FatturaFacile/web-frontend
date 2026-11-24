import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import {
  ApiResponse,
  CreateDeliveryNotePayload,
  CreateSalesOrderPayload,
  CreateSalesQuotePayload,
  DeliveryNoteResource,
  PaginatedResponse,
  SalesOrderResource,
  SalesQuoteResource,
} from '../models';
import { toHttpParams } from '../http/laravel-http.utils';

@Service()
export class SalesApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  // 1. Sales Quotes
  getQuotes(params?: {
    status?: string;
    contact_id?: string;
    page?: number;
    per_page?: number;
  }): Observable<PaginatedResponse<SalesQuoteResource>> {
    return this.http.get<PaginatedResponse<SalesQuoteResource>>(`${this.base}/invoicing/quotes`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  getQuote(id: string): Observable<ApiResponse<SalesQuoteResource>> {
    return this.http.get<ApiResponse<SalesQuoteResource>>(`${this.base}/invoicing/quotes/${id}`);
  }

  createQuote(payload: CreateSalesQuotePayload): Observable<ApiResponse<SalesQuoteResource>> {
    return this.http.post<ApiResponse<SalesQuoteResource>>(`${this.base}/invoicing/quotes`, payload);
  }

  submitQuoteForApproval(id: string): Observable<ApiResponse<SalesQuoteResource>> {
    return this.http.post<ApiResponse<SalesQuoteResource>>(`${this.base}/invoicing/quotes/${id}/submit-for-approval`, {});
  }

  approveQuote(id: string): Observable<ApiResponse<SalesQuoteResource>> {
    return this.http.post<ApiResponse<SalesQuoteResource>>(`${this.base}/invoicing/quotes/${id}/approve`, {});
  }

  rejectQuote(id: string, reason?: string): Observable<ApiResponse<SalesQuoteResource>> {
    return this.http.post<ApiResponse<SalesQuoteResource>>(`${this.base}/invoicing/quotes/${id}/reject`, { reason });
  }

  acceptQuote(id: string): Observable<ApiResponse<SalesQuoteResource>> {
    return this.http.post<ApiResponse<SalesQuoteResource>>(`${this.base}/invoicing/quotes/${id}/accept`, {});
  }

  convertQuoteToOrder(id: string): Observable<ApiResponse<SalesOrderResource>> {
    return this.http.post<ApiResponse<SalesOrderResource>>(`${this.base}/invoicing/quotes/${id}/convert`, {});
  }

  // 2. Sales Orders
  getOrders(params?: {
    status?: string;
    contact_id?: string;
    page?: number;
    per_page?: number;
  }): Observable<PaginatedResponse<SalesOrderResource>> {
    return this.http.get<PaginatedResponse<SalesOrderResource>>(`${this.base}/invoicing/orders`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  getOrder(id: string): Observable<ApiResponse<SalesOrderResource>> {
    return this.http.get<ApiResponse<SalesOrderResource>>(`${this.base}/invoicing/orders/${id}`);
  }

  createOrder(payload: CreateSalesOrderPayload): Observable<ApiResponse<SalesOrderResource>> {
    return this.http.post<ApiResponse<SalesOrderResource>>(`${this.base}/invoicing/orders`, payload);
  }

  approveOrder(id: string): Observable<ApiResponse<SalesOrderResource>> {
    return this.http.post<ApiResponse<SalesOrderResource>>(`${this.base}/invoicing/orders/${id}/approve`, {});
  }

  reserveOrderStock(id: string): Observable<ApiResponse<SalesOrderResource>> {
    return this.http.post<ApiResponse<SalesOrderResource>>(`${this.base}/invoicing/orders/${id}/reserve`, {});
  }

  cancelOrder(id: string): Observable<ApiResponse<SalesOrderResource>> {
    return this.http.post<ApiResponse<SalesOrderResource>>(`${this.base}/invoicing/orders/${id}/cancel`, {});
  }

  invoiceOrder(orderId: string): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(`${this.base}/invoicing/invoices/from-order/${orderId}`, {});
  }

  // 3. Delivery Notes (DDT)
  getDeliveryNotes(params?: {
    page?: number;
    per_page?: number;
  }): Observable<PaginatedResponse<DeliveryNoteResource>> {
    return this.http.get<PaginatedResponse<DeliveryNoteResource>>(`${this.base}/invoicing/delivery-notes`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  getDeliveryNote(id: string): Observable<ApiResponse<DeliveryNoteResource>> {
    return this.http.get<ApiResponse<DeliveryNoteResource>>(`${this.base}/invoicing/delivery-notes/${id}`);
  }

  createDeliveryNote(payload: CreateDeliveryNotePayload): Observable<ApiResponse<DeliveryNoteResource>> {
    return this.http.post<ApiResponse<DeliveryNoteResource>>(`${this.base}/invoicing/delivery-notes`, payload);
  }

  dispatchDeliveryNote(id: string): Observable<ApiResponse<DeliveryNoteResource>> {
    return this.http.post<ApiResponse<DeliveryNoteResource>>(`${this.base}/invoicing/delivery-notes/${id}/dispatch`, {});
  }

  confirmDeliveryNote(id: string): Observable<ApiResponse<DeliveryNoteResource>> {
    return this.http.post<ApiResponse<DeliveryNoteResource>>(`${this.base}/invoicing/delivery-notes/${id}/confirm`, {});
  }

  invoiceDeliveryNote(id: string): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(`${this.base}/invoicing/invoices/from-delivery/${id}`, {});
  }
}
