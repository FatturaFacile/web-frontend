import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { toHttpParams } from '../http/laravel-http.utils';
import {
  EbillBulkVerifyResult,
  EbillConnectionTest,
  EbillCustomerSync,
  EbillCustomerData,
  EbillDashboard,
  EbillEnvelope,
  EbillInvoiceLifecycle,
  EbillLookupPayload,
  EbillParticipant,
  EbillSettings,
  EbillSettingsPayload,
  EbillTransmission,
  EbillTransmissionFilters,
} from '../models';

type Envelope<T> = Observable<EbillEnvelope<T>>;

/** Endpoints of the Swiss eBill module (Mod 025): SIX Paynet / PostFinance settings, participant directory, transmissions and dashboard. */
@Service()
export class SwissEbillApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/swiss-ebill`;

  // --- Settings ---

  getSettings(): Envelope<EbillSettings> {
    return this.http.get<EbillEnvelope<EbillSettings>>(`${this.base}/settings`);
  }

  saveSettings(payload: EbillSettingsPayload): Envelope<EbillSettings> {
    return this.http.put<EbillEnvelope<EbillSettings>>(`${this.base}/settings`, payload);
  }

  testConnection(): Envelope<EbillConnectionTest> {
    return this.http.post<EbillEnvelope<EbillConnectionTest>>(
      `${this.base}/settings/test-connection`,
      {},
    );
  }

  rotateWebhookSecret(): Envelope<EbillSettings> {
    return this.http.post<EbillEnvelope<EbillSettings>>(
      `${this.base}/settings/rotate-webhook-secret`,
      {},
    );
  }

  // --- Participant directory ---

  lookupParticipant(payload: EbillLookupPayload): Envelope<EbillParticipant | null> {
    return this.http.post<EbillEnvelope<EbillParticipant | null>>(
      `${this.base}/participants/lookup`,
      payload,
    );
  }

  syncCustomer(customerId: string, forceRefresh = false): Envelope<EbillCustomerSync> {
    return this.http.post<EbillEnvelope<EbillCustomerSync>>(
      `${this.base}/customers/${customerId}/ebill/sync`,
      {},
      { params: toHttpParams({ force_refresh: forceRefresh ? 1 : undefined }) },
    );
  }

  linkCustomer(
    customerId: string,
    participantId: string,
  ): Envelope<{ customer: EbillCustomerData }> {
    return this.http.post<EbillEnvelope<{ customer: EbillCustomerData }>>(
      `${this.base}/customers/${customerId}/ebill/link`,
      { participant_id: participantId },
    );
  }

  bulkVerifyCustomers(
    customerIds: string[],
    forceRefresh = false,
  ): Envelope<EbillBulkVerifyResult> {
    return this.http.post<EbillEnvelope<EbillBulkVerifyResult>>(
      `${this.base}/customers/ebill/bulk-verify`,
      { customer_ids: customerIds, force_refresh: forceRefresh },
    );
  }

  // --- Transmissions ---

  getDashboard(from?: string | null, to?: string | null): Envelope<EbillDashboard> {
    return this.http.get<EbillEnvelope<EbillDashboard>>(`${this.base}/dashboard`, {
      params: toHttpParams({ from: from ?? undefined, to: to ?? undefined }),
    });
  }

  listTransmissions(filters: EbillTransmissionFilters = {}): Envelope<EbillTransmission[]> {
    return this.http.get<EbillEnvelope<EbillTransmission[]>>(`${this.base}/transmissions`, {
      params: toHttpParams({ ...filters }),
    });
  }

  getTransmission(id: string): Envelope<EbillTransmission> {
    return this.http.get<EbillEnvelope<EbillTransmission>>(`${this.base}/transmissions/${id}`);
  }

  downloadPayload(id: string): Observable<Blob> {
    return this.http.get(`${this.base}/transmissions/${id}/payload`, { responseType: 'blob' });
  }

  getInvoiceLifecycle(invoiceId: string): Envelope<EbillInvoiceLifecycle> {
    return this.http.get<EbillEnvelope<EbillInvoiceLifecycle>>(
      `${this.base}/invoices/${invoiceId}`,
    );
  }

  sendInvoice(invoiceId: string): Envelope<EbillTransmission> {
    return this.http.post<EbillEnvelope<EbillTransmission>>(
      `${this.base}/invoices/${invoiceId}/send`,
      {},
    );
  }

  reviseTransmission(id: string): Envelope<EbillTransmission> {
    return this.http.post<EbillEnvelope<EbillTransmission>>(
      `${this.base}/transmissions/${id}/revise`,
      {},
    );
  }

  retryTransmission(id: string): Envelope<EbillTransmission> {
    return this.http.post<EbillEnvelope<EbillTransmission>>(
      `${this.base}/transmissions/${id}/retry`,
      {},
    );
  }

  cancelTransmission(id: string): Envelope<EbillTransmission> {
    return this.http.post<EbillEnvelope<EbillTransmission>>(
      `${this.base}/transmissions/${id}/cancel`,
      {},
    );
  }
}
