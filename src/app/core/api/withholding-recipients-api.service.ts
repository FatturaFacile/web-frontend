import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { toHttpParams } from '../http/laravel-http.utils';
import {
  WrAnnualRecord,
  WrCertificate,
  WrCertificatePayload,
  WrDashboardFilters,
  WrDashboardMeta,
  WrDashboardRow,
  WrEnvelope,
  WrF24Preview,
  WrInlFormat,
  WrInlNotification,
  WrInlPayload,
  WrLookups,
  WrMarkSentPayload,
  WrPage,
  WrPaymentPayload,
  WrRecipient,
  WrRecipientPayload,
  WrSettlement,
  WrSettlementFilters,
  WrSimulatePayload,
  WrSimulation,
  WrThreshold,
} from '../models';

type Envelope<T, M = Record<string, unknown>> = Observable<WrEnvelope<T, M>>;

/** Endpoints of the withholding taxes module (Mod 356). */
@Service()
export class WithholdingRecipientsApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/withholding-recipients`;

  getLookups(): Envelope<WrLookups> {
    return this.http.get<WrEnvelope<WrLookups>>(`${this.base}/lookups`);
  }

  // --- Dashboard and recipients ---

  getDashboard(filters: WrDashboardFilters = {}): Envelope<WrDashboardRow[], WrDashboardMeta> {
    return this.http.get<WrEnvelope<WrDashboardRow[], WrDashboardMeta>>(`${this.base}/dashboard`, {
      params: toHttpParams({
        ...filters,
        only_alerts: filters.only_alerts ? 1 : undefined,
      }),
    });
  }

  listRecipients(): Envelope<WrRecipient[]> {
    return this.http.get<WrEnvelope<WrRecipient[]>>(`${this.base}/recipients`);
  }

  getRecipient(id: string): Envelope<WrRecipient> {
    return this.http.get<WrEnvelope<WrRecipient>>(`${this.base}/recipients/${id}`);
  }

  createRecipient(payload: WrRecipientPayload): Envelope<WrRecipient> {
    return this.http.post<WrEnvelope<WrRecipient>>(`${this.base}/recipients`, payload);
  }

  updateRecipient(id: string, payload: WrRecipientPayload): Envelope<WrRecipient> {
    return this.http.put<WrEnvelope<WrRecipient>>(`${this.base}/recipients/${id}`, payload);
  }

  deleteRecipient(id: string): Envelope<null> {
    return this.http.delete<WrEnvelope<null>>(`${this.base}/recipients/${id}`);
  }

  getThresholds(id: string, year?: number): Envelope<WrThreshold[]> {
    return this.http.get<WrEnvelope<WrThreshold[]>>(`${this.base}/recipients/${id}/thresholds`, {
      params: toHttpParams({ year }),
    });
  }

  // --- Agent declarations (20% base) ---

  listCertificates(recipientId: string): Envelope<WrCertificate[]> {
    return this.http.get<WrEnvelope<WrCertificate[]>>(
      `${this.base}/recipients/${recipientId}/certificates`,
    );
  }

  createCertificate(recipientId: string, payload: WrCertificatePayload): Envelope<WrCertificate> {
    return this.http.post<WrEnvelope<WrCertificate>>(
      `${this.base}/recipients/${recipientId}/certificates`,
      payload,
    );
  }

  deleteCertificate(id: string): Envelope<null> {
    return this.http.delete<WrEnvelope<null>>(`${this.base}/certificates/${id}`);
  }

  // --- INL preventive communications ---

  listInlNotifications(recipientId: string): Envelope<WrInlNotification[]> {
    return this.http.get<WrEnvelope<WrInlNotification[]>>(
      `${this.base}/recipients/${recipientId}/inl-notifications`,
    );
  }

  createInlNotification(recipientId: string, payload: WrInlPayload): Envelope<WrInlNotification> {
    return this.http.post<WrEnvelope<WrInlNotification>>(
      `${this.base}/recipients/${recipientId}/inl-notifications`,
      payload,
    );
  }

  markInlSent(id: string, payload: WrMarkSentPayload = {}): Envelope<WrInlNotification> {
    return this.http.post<WrEnvelope<WrInlNotification>>(
      `${this.base}/inl-notifications/${id}/mark-sent`,
      payload,
    );
  }

  cancelInl(id: string): Envelope<WrInlNotification> {
    return this.http.post<WrEnvelope<WrInlNotification>>(
      `${this.base}/inl-notifications/${id}/cancel`,
      {},
    );
  }

  downloadInl(id: string, format: WrInlFormat): Observable<Blob> {
    return this.http.get(`${this.base}/inl-notifications/${id}/download`, {
      params: toHttpParams({ format }),
      responseType: 'blob',
    });
  }

  // --- Simulation and settlements ---

  simulate(payload: WrSimulatePayload): Envelope<WrSimulation> {
    return this.http.post<WrEnvelope<WrSimulation>>(`${this.base}/compensations/simulate`, payload);
  }

  listSettlements(filters: WrSettlementFilters = {}): Observable<WrPage<WrSettlement>> {
    return this.http.get<WrPage<WrSettlement>>(`${this.base}/settlements`, {
      params: toHttpParams(filters),
    });
  }

  getSettlement(id: string): Envelope<WrSettlement> {
    return this.http.get<WrEnvelope<WrSettlement>>(`${this.base}/settlements/${id}`);
  }

  postPayment(payload: WrPaymentPayload): Envelope<WrSettlement> {
    return this.http.post<WrEnvelope<WrSettlement>>(`${this.base}/settlements`, payload);
  }

  postBatch(items: WrPaymentPayload[]): Envelope<WrSettlement[]> {
    return this.http.post<WrEnvelope<WrSettlement[]>>(`${this.base}/settlements/batch`, { items });
  }

  // --- Flows ---

  getF24(accrualMonth: string): Envelope<WrF24Preview> {
    return this.http.get<WrEnvelope<WrF24Preview>>(`${this.base}/flows/f24`, {
      params: toHttpParams({ accrual_month: accrualMonth }),
    });
  }

  exportF24(accrualMonth: string): Observable<Blob> {
    return this.http.get(`${this.base}/flows/f24/export`, {
      params: toHttpParams({ accrual_month: accrualMonth }),
      responseType: 'blob',
    });
  }

  exportUniEmens(accrualMonth: string): Observable<Blob> {
    return this.http.get(`${this.base}/flows/uniemens`, {
      params: toHttpParams({ accrual_month: accrualMonth }),
      responseType: 'blob',
    });
  }

  // --- Annual returns ---

  listAnnualReturns(taxYear: number): Envelope<WrAnnualRecord[]> {
    return this.http.get<WrEnvelope<WrAnnualRecord[]>>(`${this.base}/annual-returns`, {
      params: toHttpParams({ tax_year: taxYear }),
    });
  }

  generateAnnualReturns(taxYear: number, recipientId?: string | null): Envelope<WrAnnualRecord[]> {
    return this.http.post<WrEnvelope<WrAnnualRecord[]>>(`${this.base}/annual-returns/generate`, {
      tax_year: taxYear,
      ...(recipientId ? { recipient_profile_id: recipientId } : {}),
    });
  }

  exportAnnualReturns(taxYear: number): Observable<Blob> {
    return this.http.get(`${this.base}/annual-returns/export`, {
      params: toHttpParams({ tax_year: taxYear }),
      responseType: 'blob',
    });
  }
}
