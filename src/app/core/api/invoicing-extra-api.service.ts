import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { toHttpParams } from '../http/laravel-http.utils';
import {
  ApiResponse,
  CreateInvoicePayload,
  InvoiceDetailResource,
  InvoiceFilterParams,
  InvoiceResource,
  PaginatedResponse,
} from '../models';

/** Query params of `GET /invoicing/invoices`. */
export interface InvoicingInvoiceFilterParams extends InvoiceFilterParams {
  status?: string;
  contact_id?: string;
  invoice_type?: string;
}

/** Invoice endpoints of the Invoicing module (`/invoicing/invoices`), next to the legacy `/sales/invoices`. */
@Service()
export class InvoicingExtraApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/invoicing`;

  getInvoices(filters?: InvoicingInvoiceFilterParams): Observable<PaginatedResponse<InvoiceResource>> {
    return this.http.get<PaginatedResponse<InvoiceResource>>(`${this.base}/invoices`, {
      params: filters ? toHttpParams(filters) : undefined,
    });
  }

  getInvoice(id: string): Observable<ApiResponse<InvoiceDetailResource>> {
    return this.http.get<ApiResponse<InvoiceDetailResource>>(`${this.base}/invoices/${id}`);
  }

  createInvoice(payload: CreateInvoicePayload): Observable<ApiResponse<InvoiceResource>> {
    return this.http.post<ApiResponse<InvoiceResource>>(`${this.base}/invoices`, payload);
  }
}
