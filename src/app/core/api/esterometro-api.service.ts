import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  ClassificationPreviewResult,
  CreateSelfInvoicePayload,
  EsterometroDashboard,
  SelfInvoice,
  SelfInvoiceClassificationRule,
  SelfInvoiceSetting,
} from '../models/esterometro.model';

@Injectable({ providedIn: 'root' })
export class EsterometroApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/v1/esterometro';

  getDashboard(): Observable<{ data: EsterometroDashboard }> {
    return this.http.get<{ data: EsterometroDashboard }>(`${this.baseUrl}/dashboard`);
  }

  listSelfInvoices(filters?: {
    document_type?: string | null;
    status?: string | null;
    sdi_status?: string | null;
    passive_invoice_id?: string | null;
    search?: string | null;
    per_page?: number;
  }): Observable<{ data: SelfInvoice[]; meta?: { total: number; current_page: number } }> {
    let params = new HttpParams();
    if (filters?.document_type) params = params.set('document_type', filters.document_type);
    if (filters?.status) params = params.set('status', filters.status);
    if (filters?.sdi_status) params = params.set('sdi_status', filters.sdi_status);
    if (filters?.passive_invoice_id) params = params.set('passive_invoice_id', filters.passive_invoice_id);
    if (filters?.search) params = params.set('search', filters.search);
    if (filters?.per_page) params = params.set('per_page', String(filters.per_page));

    return this.http.get<{ data: SelfInvoice[]; meta?: { total: number; current_page: number } }>(
      `${this.baseUrl}/self-invoices`,
      { params },
    );
  }

  getSelfInvoice(id: string): Observable<{ data: SelfInvoice }> {
    return this.http.get<{ data: SelfInvoice }>(`${this.baseUrl}/self-invoices/${id}`);
  }

  classifyPreview(payload: {
    passive_invoice_id?: string | null;
    supplier_country_code?: string;
    transaction_nature?: string;
    source_vat_nature?: string | null;
    has_customs_import_bill?: boolean;
    regularization_trigger?: string | null;
    override_document_type?: string | null;
  }): Observable<{ data: ClassificationPreviewResult }> {
    return this.http.post<{ data: ClassificationPreviewResult }>(
      `${this.baseUrl}/classify-preview`,
      payload,
    );
  }

  createSelfInvoice(payload: CreateSelfInvoicePayload): Observable<{ data: SelfInvoice }> {
    return this.http.post<{ data: SelfInvoice }>(`${this.baseUrl}/self-invoices`, payload);
  }

  generateFromPassive(
    passiveInvoiceId: string,
    options?: Record<string, unknown>,
  ): Observable<{ data: SelfInvoice }> {
    return this.http.post<{ data: SelfInvoice }>(
      `${this.baseUrl}/self-invoices/from-passive/${passiveInvoiceId}`,
      options ?? {},
    );
  }

  updateSelfInvoice(id: string, payload: Partial<SelfInvoice>): Observable<{ data: SelfInvoice }> {
    return this.http.put<{ data: SelfInvoice }>(`${this.baseUrl}/self-invoices/${id}`, payload);
  }

  validateXml(id: string, reconcileVat = true): Observable<{ data: SelfInvoice }> {
    return this.http.post<{ data: SelfInvoice }>(
      `${this.baseUrl}/self-invoices/${id}/validate`,
      { reconcile_vat: reconcileVat },
    );
  }

  reconcileVat(id: string): Observable<{ data: SelfInvoice }> {
    return this.http.post<{ data: SelfInvoice }>(
      `${this.baseUrl}/self-invoices/${id}/reconcile-vat`,
      {},
    );
  }

  sendToSdi(id: string): Observable<{ data: SelfInvoice }> {
    return this.http.post<{ data: SelfInvoice }>(
      `${this.baseUrl}/self-invoices/${id}/send-sdi`,
      {},
    );
  }

  batchSendToSdi(ids: string[]): Observable<{ data: { sent_ids: string[]; failed: { id: string; error: string }[] } }> {
    return this.http.post<{ data: { sent_ids: string[]; failed: { id: string; error: string }[] } }>(
      `${this.baseUrl}/self-invoices/batch-send`,
      { ids },
    );
  }

  downloadXml(id: string): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/self-invoices/${id}/xml`, { responseType: 'blob' });
  }

  listRules(): Observable<{ data: SelfInvoiceClassificationRule[] }> {
    return this.http.get<{ data: SelfInvoiceClassificationRule[] }>(`${this.baseUrl}/rules`);
  }

  getSettings(): Observable<{ data: SelfInvoiceSetting }> {
    return this.http.get<{ data: SelfInvoiceSetting }>(`${this.baseUrl}/settings`);
  }

  updateSettings(payload: Partial<SelfInvoiceSetting>): Observable<{ data: SelfInvoiceSetting }> {
    return this.http.put<{ data: SelfInvoiceSetting }>(`${this.baseUrl}/settings`, payload);
  }
}
