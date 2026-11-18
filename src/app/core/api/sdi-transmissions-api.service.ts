import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { toHttpParams } from '../http/laravel-http.utils';
import { ApiResponse, PaginatedResponse } from '../models';

export type SdiTransmissionStatus = 'draft' | 'generated' | 'sending' | 'sent' | 'delivered' | 'accepted' | 'rejected' | 'not_delivered' | 'failed';

export const SDI_TRANSMISSION_STATUSES: readonly SdiTransmissionStatus[] = ['draft', 'generated', 'sending', 'sent', 'delivered', 'accepted', 'rejected', 'not_delivered', 'failed'];

/** One invoice handed to SDI (`GET /sdi/transmissions`). */
export interface SdiTransmission {
  id: string;
  invoice_id: string;
  invoice_number: string | null;
  invoice_date: string | null;
  total_gross: string | number | null;
  currency: string | null;
  sdi_status: SdiTransmissionStatus | string;
  sdi_identifier: string | null;
  file_name: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  last_error: string | null;
  can_retry: boolean;
}

/** Outcome of `POST /sdi/passive/import`: the drafts read (none in preview mode) and the readable rendering of the file. */
export interface SdiPassiveImportResult {
  preview_html: string;
  signature_verified: boolean | null;
  invoices?: { duplicate: boolean; invoice: Record<string, unknown> }[];
}

/** One outbound exchange with the SDI provider (`GET /sdi/invoices/{id}/notifications`, `outbound`). */
export interface SdiOutboundLog {
  id: string;
  provider: string | null;
  action: string | null;
  status: string | null;
  sdi_uuid: string | null;
  file_name: string | null;
  error: string | null;
  created_at: string;
}

/** One SDI notification received for the invoice (`inbound`). */
export interface SdiInboundLog {
  id: string;
  provider: string | null;
  event_type: string | null;
  status: string | null;
  sdi_uuid: string | null;
  error: string | null;
  processed_at: string | null;
  created_at: string;
}

export interface SdiNotificationLogs {
  outbound: SdiOutboundLog[];
  inbound: SdiInboundLog[];
}

export interface SdiTransmissionQuery {
  status?: SdiTransmissionStatus;
  search?: string;
  page?: number;
  per_page?: number;
}

/** History of the invoices sent to SDI; a retry is the normal send of the invoice. */
@Service()
export class SdiTransmissionsApiService {
  private readonly http = inject(HttpClient);

  list(query?: SdiTransmissionQuery): Observable<PaginatedResponse<SdiTransmission>> {
    return this.http.get<PaginatedResponse<SdiTransmission>>(`${environment.apiBaseUrl}/sdi/transmissions`, {
      params: query ? toHttpParams(query) : undefined,
    });
  }

  /** The FatturaPA of an invoice as sandboxed read-only HTML, to be shown through an object URL in an iframe. */
  previewHtml(invoiceId: string): Observable<Blob> {
    return this.http.get(`${environment.apiBaseUrl}/sdi/invoices/${invoiceId}/preview-html`, { responseType: 'blob' });
  }

  /** The status history of an invoice: what was sent to SDI and the notifications received back. */
  notifications(invoiceId: string): Observable<ApiResponse<SdiNotificationLogs>> {
    return this.http.get<ApiResponse<SdiNotificationLogs>>(`${environment.apiBaseUrl}/sdi/invoices/${invoiceId}/notifications`);
  }

  /** Reads a supplier FatturaPA (.xml or CAdES .xml.p7m); with `previewOnly` nothing is saved. */
  importPassive(file: File, previewOnly: boolean): Observable<ApiResponse<SdiPassiveImportResult>> {
    const form = new FormData();
    form.append('file', file, file.name);
    form.append('preview_only', previewOnly ? '1' : '0');

    return this.http.post<ApiResponse<SdiPassiveImportResult>>(`${environment.apiBaseUrl}/sdi/passive/import`, form);
  }

  /** Sends the invoice to SDI again (accepted by the API for a failed transmission only). */
  retry(invoiceId: string): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(`${environment.apiBaseUrl}/sales/invoices/${invoiceId}/send-sdi`, {});
  }
}
