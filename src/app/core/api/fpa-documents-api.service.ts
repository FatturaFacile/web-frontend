import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { toHttpParams } from '../http/laravel-http.utils';
import { ApiResponse } from '../models';

export type FpaStatus =
  | 'draft'
  | 'validated'
  | 'validation_failed'
  | 'signed'
  | 'queued'
  | 'transmitted'
  | 'delivered'
  | 'undelivered'
  | 'rejected'
  | 'pa_accepted'
  | 'pa_rejected'
  | 'deadline_passed'
  | 'transmitted_attested'
  | 'inbound_received'
  | 'inbound_processed';

export const FPA_STATUSES: readonly FpaStatus[] = [
  'draft',
  'validated',
  'validation_failed',
  'signed',
  'queued',
  'transmitted',
  'delivered',
  'undelivered',
  'rejected',
  'pa_accepted',
  'pa_rejected',
  'deadline_passed',
  'transmitted_attested',
  'inbound_received',
  'inbound_processed',
];

export interface FpaDocument {
  id: string;
  invoice_id: string | null;
  parent_fpa_document_id: string | null;
  direction: 'outbound' | 'inbound';
  format_transmission: 'FPR12' | 'FPA12' | 'FSM10';
  document_type: string;
  document_number: string | null;
  document_date: string | null;
  sdi_identifier: string | null;
  file_name: string | null;
  transmission_progressive: string | null;
  status: FpaStatus;
  validation_errors: { code: string; description?: string }[] | null;
  transmitted_at: string | null;
  rejected_at: string | null;
  resubmission_deadline_at: string | null;
}

export interface FpaNotification {
  id: string;
  type: 'NS' | 'RC' | 'MC' | 'NE' | 'DT' | 'AT' | 'MT';
  outcome_code: string | null;
  error_codes: { code: string; description: string; line_reference: string | null }[] | null;
  received_at: string | null;
}

export interface FpaKpi {
  ready: number;
  transmitted: number;
  delivered: number;
  undelivered: number;
  rejected: number;
  inbound_to_process: number;
}

export interface FpaListResponse {
  data: FpaDocument[];
  meta: { total: number; current_page: number; last_page: number; per_page: number; kpi: FpaKpi };
}

export interface FpaQuery {
  direction?: 'outbound' | 'inbound';
  status?: FpaStatus;
  page?: number;
  per_page?: number;
}

export interface PreflightIssue {
  code: string;
  path: string;
  params: Record<string, string | number | null>;
}

export interface PreflightResult {
  xml: string;
  valid: boolean;
  errors: PreflightIssue[];
  warnings: PreflightIssue[];
}

export interface SdiConfiguration {
  transmitter_country_code: string;
  transmitter_fiscal_code: string | null;
  progressivo_invio_counter: number;
  channel_type: 'pec' | 'webservice_sdi' | 'intermediary_api' | null;
  default_codice_destinatario: string;
  pec_address: string | null;
  signature_mode: 'none' | 'local_pkcs12' | 'remote_hsm_provider';
  certificate_reference: string | null;
  auto_sign_on_send: boolean;
  legal_archiving_enabled: boolean;
  sandbox_simulator_enabled: boolean;
  has_credentials: boolean;
  has_certificate: boolean;
}

/** Electronic invoice envelopes, pre-flight validation, resubmission and SDI/signature settings. */
@Service()
export class FpaDocumentsApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  list(query?: FpaQuery): Observable<FpaListResponse> {
    return this.http.get<FpaListResponse>(`${this.base}/fpa-documents`, {
      params: query ? toHttpParams(query) : undefined,
    });
  }

  show(id: string): Observable<ApiResponse<FpaDocument & { notifications: FpaNotification[] }>> {
    return this.http.get<ApiResponse<FpaDocument & { notifications: FpaNotification[] }>>(
      `${this.base}/fpa-documents/${id}`,
    );
  }

  /** Readable HTML of the envelope's XML, for an iframe, in the ministerial or AssoSoftware layout. */
  render(id: string, style: 'ministerial' | 'assosoftware' = 'ministerial'): Observable<Blob> {
    return this.http.get(`${this.base}/fpa-documents/${id}/render`, {
      params: { style },
      responseType: 'blob',
    });
  }

  /** Hands the invoice to SDI (the same send the invoice list uses). */
  send(invoiceId: string): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(`${this.base}/sdi/invoices/${invoiceId}/send`, {});
  }

  /** Saves the settings and, when given, the PKCS#12 certificate (multipart; the method is spoofed as PUT). */
  saveSettingsWithCertificate(
    body: Partial<Record<string, string | boolean | null>>,
    certificate: File,
    password: string,
  ): Observable<ApiResponse<SdiConfiguration>> {
    const form = new FormData();
    form.append('_method', 'PUT');
    for (const [key, value] of Object.entries(body)) {
      if (value !== null && value !== undefined) {
        form.append(key, typeof value === 'boolean' ? (value ? '1' : '0') : value);
      }
    }
    form.append('certificate', certificate, certificate.name);
    form.append('certificate_password', password);

    return this.http.post<ApiResponse<SdiConfiguration>>(`${this.base}/settings/sdi`, form);
  }

  /** "Fix & resubmit": creates the linked revision of a rejected envelope, keeping the original number and date. */
  resubmit(id: string): Observable<ApiResponse<FpaDocument>> {
    return this.http.post<ApiResponse<FpaDocument>>(
      `${this.base}/fpa-documents/${id}/resubmit`,
      {},
    );
  }

  /** Sandbox only: applies a simulated SDI receipt. */
  simulate(
    id: string,
    body: { type: string; outcome?: 'EC01' | 'EC02'; error_code?: string },
  ): Observable<ApiResponse<FpaDocument>> {
    return this.http.post<ApiResponse<FpaDocument>>(
      `${this.base}/fpa-documents/${id}/simulate`,
      body,
    );
  }

  /** Generates the XML and runs the XSD and Sogei checks without sending anything. */
  preflight(invoiceId: string): Observable<ApiResponse<PreflightResult>> {
    return this.http.post<ApiResponse<PreflightResult>>(
      `${this.base}/sdi/invoices/${invoiceId}/preflight`,
      {},
    );
  }

  settings(): Observable<ApiResponse<SdiConfiguration>> {
    return this.http.get<ApiResponse<SdiConfiguration>>(`${this.base}/settings/sdi`);
  }

  saveSettings(
    body: Partial<
      Omit<SdiConfiguration, 'has_credentials' | 'has_certificate' | 'progressivo_invio_counter'>
    >,
  ): Observable<ApiResponse<SdiConfiguration>> {
    return this.http.put<ApiResponse<SdiConfiguration>>(`${this.base}/settings/sdi`, body);
  }
}
