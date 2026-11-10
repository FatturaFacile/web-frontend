import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import {
  ApiResponse,
  BulkSdiResult,
  CreateCreditNotePayload,
  CreateInvoicePayload,
  CreditNoteResource,
  InvoiceDetailResource,
  InvoiceFilterParams,
  InvoiceInstallment,
  InvoiceResource,
  PaginatedResponse,
  SdiLogsData,
  DocumentEmailRecord,
  DocumentEmailType,
  SendDocumentEmailPayload,
  SwissQrBillData,
} from '../models';
import { toHttpParams } from '../http/laravel-http.utils';

export interface RecordPaymentPayload {
  amount: number;
  payment_date: string;
  payment_method: string;
  bank_account_id?: string;
  notes?: string;
}

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

  /** E-mails sent for a document, newest first. */
  getDocumentEmails(type: DocumentEmailType, id: string): Observable<ApiResponse<DocumentEmailRecord[]>> {
    return this.http.get<ApiResponse<DocumentEmailRecord[]>>(`${this.base}/documents/${type}/${id}/emails`);
  }

  // SDI Electronic Invoicing
  sendToSdi(id: string): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(`${this.url}/${id}/send-sdi`, {});
  }

  sendSdiBulk(invoiceIds: string[]): Observable<ApiResponse<BulkSdiResult>> {
    return this.http.post<ApiResponse<BulkSdiResult>>(`${this.url}/send-sdi-bulk`, {
      invoice_ids: invoiceIds,
    });
  }

  generateSdiXml(id: string): Observable<ApiResponse<{ xml_url?: string; status: string }>> {
    return this.http.post<ApiResponse<{ xml_url?: string; status: string }>>(
      `${this.url}/${id}/generate-sdi-xml`,
      {},
    );
  }

  getSdiLogs(id: string): Observable<ApiResponse<SdiLogsData>> {
    return this.http.get<ApiResponse<SdiLogsData>>(`${this.url}/${id}/sdi-logs`);
  }

  // Swiss QR-Bill
  /** Swiss QR-bill payload fetch with SPC data and reference. */
  getQrBill(id: string): Observable<ApiResponse<SwissQrBillData>> {
    return this.http.get<ApiResponse<SwissQrBillData>>(`${this.url}/${id}/qr-bill`);
  }

  generateQrBill(id: string): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(`${this.url}/${id}/generate-qr-bill`, {});
  }

  /** SVG payment slip stream. */
  downloadQrBill(id: string): Observable<Blob> {
    return this.http.get(`${this.url}/${id}/download-qr-bill`, { responseType: 'blob' });
  }

  convertProforma(id: string): Observable<ApiResponse<InvoiceResource>> {
    return this.http.post<ApiResponse<InvoiceResource>>(`${this.url}/${id}/convert-proforma`, {});
  }

  recordPayment(id: string, payload: RecordPaymentPayload): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(`${this.url}/${id}/payments`, payload);
  }

  // Credit Notes
  createCreditNote(payload: CreateCreditNotePayload): Observable<ApiResponse<CreditNoteResource>> {
    return this.http.post<ApiResponse<CreditNoteResource>>(`${this.base}/invoicing/credit-notes`, payload);
  }

  applyCreditNote(creditNoteId: string, targetInvoiceId: string, amount: number): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(`${this.base}/invoicing/credit-notes/${creditNoteId}/apply`, {
      target_invoice_id: targetInvoiceId,
      amount,
    });
  }

  // Installments / Scadenze
  getInstallments(id: string): Observable<ApiResponse<InvoiceInstallment[]>> {
    return this.http.get<ApiResponse<InvoiceInstallment[]>>(`${this.base}/invoicing/invoices/${id}/installments`);
  }

  // Approvals & Posting
  approveInvoice(id: string): Observable<ApiResponse<InvoiceResource>> {
    return this.http.post<ApiResponse<InvoiceResource>>(`${this.base}/invoicing/invoices/${id}/approve`, {});
  }

  postInvoice(id: string): Observable<ApiResponse<InvoiceResource>> {
    return this.http.post<ApiResponse<InvoiceResource>>(`${this.base}/invoicing/invoices/${id}/post`, {});
  }
}
