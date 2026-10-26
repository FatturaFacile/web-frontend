import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import {
  ApiResponse,
  CreateInvoicePayload,
  InvoiceDetailResource,
  InvoiceFilterParams,
  InvoiceResource,
  PaginatedResponse,
  SendDocumentEmailPayload,
} from '../models';
import { toHttpParams } from '../http/laravel-http.utils';

/**
 * Only operations exposed by the backend are implemented. The spec has no
 * update / delete / duplicate endpoint for invoices.
 */
@Service()
export class InvoiceApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;
  private readonly url = `${this.base}/sales/invoices`;

  list(filters: InvoiceFilterParams): Observable<PaginatedResponse<InvoiceResource>> {
    return this.http.get<PaginatedResponse<InvoiceResource>>(this.url, {
      params: toHttpParams(filters),
    });
  }

  get(id: string): Observable<ApiResponse<InvoiceDetailResource>> {
    return this.http.get<ApiResponse<InvoiceDetailResource>>(`${this.url}/${id}`);
  }

  create(payload: CreateInvoicePayload): Observable<ApiResponse<InvoiceResource>> {
    return this.http.post<ApiResponse<InvoiceResource>>(this.url, payload);
  }

  /** PDF stream of the invoice (`inline` renders it in the browser). */
  downloadPdf(id: string, inline = true): Observable<Blob> {
    return this.http.get(`${this.base}/documents/invoice/${id}/pdf`, {
      params: toHttpParams({ inline }),
      responseType: 'blob',
    });
  }

  sendByEmail(id: string, payload: SendDocumentEmailPayload = {}): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(`${this.base}/documents/invoice/${id}/email`, payload);
  }

  sendToSdi(id: string): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(`${this.url}/${id}/send-sdi`, {});
  }

  generateQrBill(id: string): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(`${this.url}/${id}/generate-qr-bill`, {});
  }

  /** SVG payment slip stream. */
  downloadQrBill(id: string): Observable<Blob> {
    return this.http.get(`/${id}/download-qr-bill`, { responseType: 'blob' });
  }

  convertProforma(id: string): Observable<ApiResponse<InvoiceResource>> {
    return this.http.post<ApiResponse<InvoiceResource>>(`${this.url}/${id}/convert-proforma`, {});
  }
}


