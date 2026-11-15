import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { toHttpParams } from '../http/laravel-http.utils';
import { ApiResponse, PaginatedResponse } from '../models';

export type SdiTransmissionStatus = 'draft' | 'sending' | 'sent' | 'delivered' | 'accepted' | 'rejected' | 'not_delivered' | 'failed';

export const SDI_TRANSMISSION_STATUSES: readonly SdiTransmissionStatus[] = ['draft', 'sending', 'sent', 'delivered', 'accepted', 'rejected', 'not_delivered', 'failed'];

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

  /** Sends the invoice to SDI again (accepted by the API for a failed transmission only). */
  retry(invoiceId: string): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(`${environment.apiBaseUrl}/sales/invoices/${invoiceId}/send-sdi`, {});
  }
}
