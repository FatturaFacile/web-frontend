import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { toHttpParams } from '../http/laravel-http.utils';
import {
  TndAlert,
  TndBenchmark,
  TndBenchmarkFilters,
  TndBenchmarkPayload,
  TndBenchmarkStatistics,
  TndConversionResult,
  TndConvertPayload,
  TndDashboard,
  TndEdgue,
  TndEligibility,
  TndEnvelope,
  TndEnvelopeItem,
  TndEnvelopeKey,
  TndChecklistDefinition,
  TndLookups,
  TndNotice,
  TndNoticeFilters,
  TndNoticePayload,
  TndOfferPayload,
  TndOfferResult,
  TndPage,
  TndParticipation,
  TndParticipationDetail,
  TndParticipationFilters,
  TndParticipationPayload,
  TndParticipationStatus,
  TndReadiness,
  TndVaultDocument,
  TndVaultFilters,
  TndVaultOverview,
  TndVaultPayload,
} from '../models';

type Envelope<T> = Observable<TndEnvelope<T>>;

/** Endpoints of the tender management module (Mod 169). */
@Service()
export class TenderManagementApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/tender-management`;

  getLookups(): Envelope<TndLookups> {
    return this.http.get<TndEnvelope<TndLookups>>(`${this.base}/lookups`);
  }

  getDashboard(): Envelope<TndDashboard> {
    return this.http.get<TndEnvelope<TndDashboard>>(`${this.base}/dashboard`);
  }

  // --- Notices ---

  listNotices(filters: TndNoticeFilters = {}): Observable<TndPage<TndNotice>> {
    return this.http.get<TndPage<TndNotice>>(`${this.base}/notices`, {
      params: toHttpParams(filters),
    });
  }

  getNotice(id: string): Envelope<TndNotice> {
    return this.http.get<TndEnvelope<TndNotice>>(`${this.base}/notices/${id}`);
  }

  createNotice(payload: TndNoticePayload): Envelope<TndNotice> {
    return this.http.post<TndEnvelope<TndNotice>>(`${this.base}/notices`, payload);
  }

  updateNotice(id: string, payload: TndNoticePayload): Envelope<TndNotice> {
    return this.http.put<TndEnvelope<TndNotice>>(`${this.base}/notices/${id}`, payload);
  }

  deleteNotice(id: string): Envelope<null> {
    return this.http.delete<TndEnvelope<null>>(`${this.base}/notices/${id}`);
  }

  ingestSimap(payload: Record<string, unknown>): Envelope<TndNotice> {
    return this.http.post<TndEnvelope<TndNotice>>(`${this.base}/notices/ingest-simap`, { payload });
  }

  // --- Participations ---

  listParticipations(filters: TndParticipationFilters = {}): Observable<TndPage<TndParticipation>> {
    return this.http.get<TndPage<TndParticipation>>(`${this.base}/participations`, {
      params: toHttpParams(filters),
    });
  }

  getParticipation(id: string): Envelope<TndParticipationDetail> {
    return this.http.get<TndEnvelope<TndParticipationDetail>>(`${this.base}/participations/${id}`);
  }

  createParticipation(payload: {
    tender_id: string;
    participation_mode?: string;
    notes?: string | null;
  }): Envelope<TndParticipation> {
    return this.http.post<TndEnvelope<TndParticipation>>(`${this.base}/participations`, payload);
  }

  updateParticipation(id: string, payload: TndParticipationPayload): Envelope<TndParticipation> {
    return this.http.put<TndEnvelope<TndParticipation>>(
      `${this.base}/participations/${id}`,
      payload,
    );
  }

  deleteParticipation(id: string): Envelope<null> {
    return this.http.delete<TndEnvelope<null>>(`${this.base}/participations/${id}`);
  }

  transition(
    id: string,
    status: TndParticipationStatus,
    reason?: string,
  ): Envelope<TndParticipation> {
    return this.http.post<TndEnvelope<TndParticipation>>(
      `${this.base}/participations/${id}/transition`,
      { status, reason },
    );
  }

  evaluateEligibility(id: string): Envelope<TndEligibility> {
    return this.http.post<TndEnvelope<TndEligibility>>(
      `${this.base}/participations/${id}/evaluate-eligibility`,
      {},
    );
  }

  calculateOffer(id: string, payload: TndOfferPayload): Envelope<TndOfferResult> {
    return this.http.post<TndEnvelope<TndOfferResult>>(
      `${this.base}/participations/${id}/economic-offer`,
      payload,
    );
  }

  getReadiness(id: string): Envelope<TndReadiness> {
    return this.http.get<TndEnvelope<TndReadiness>>(`${this.base}/participations/${id}/readiness`);
  }

  saveChecklist(
    id: string,
    envelope: TndEnvelopeKey,
    items: TndChecklistDefinition[],
  ): Envelope<TndEnvelopeItem[]> {
    return this.http.put<TndEnvelope<TndEnvelopeItem[]>>(
      `${this.base}/participations/${id}/envelopes/${envelope}`,
      { items },
    );
  }

  seedChecklist(id: string, envelope: TndEnvelopeKey): Envelope<TndEnvelopeItem[]> {
    return this.http.post<TndEnvelope<TndEnvelopeItem[]>>(
      `${this.base}/participations/${id}/envelopes/${envelope}/seed`,
      {},
    );
  }

  uploadEnvelopeDocument(
    id: string,
    envelope: TndEnvelopeKey,
    docKey: string,
    file: File,
    label?: string,
  ): Envelope<TndEnvelopeItem> {
    const form = new FormData();
    form.append('doc_key', docKey);
    form.append('file', file);
    if (label) {
      form.append('label', label);
    }
    return this.http.post<TndEnvelope<TndEnvelopeItem>>(
      `${this.base}/participations/${id}/envelopes/${envelope}/documents`,
      form,
    );
  }

  removeEnvelopeDocument(
    id: string,
    envelope: TndEnvelopeKey,
    docKey: string,
  ): Envelope<TndEnvelopeItem> {
    return this.http.delete<TndEnvelope<TndEnvelopeItem>>(
      `${this.base}/participations/${id}/envelopes/${envelope}/documents/${docKey}`,
    );
  }

  getEdgue(id: string): Envelope<TndEdgue> {
    return this.http.get<TndEnvelope<TndEdgue>>(`${this.base}/participations/${id}/edgue`);
  }

  downloadEdgue(id: string, format: 'xml' | 'pdf'): Observable<Blob> {
    return this.http.get(`${this.base}/participations/${id}/edgue/download`, {
      params: { format },
      responseType: 'blob',
    });
  }

  submit(id: string): Envelope<TndParticipation> {
    return this.http.post<TndEnvelope<TndParticipation>>(
      `${this.base}/participations/${id}/submit`,
      {},
    );
  }

  convert(id: string, payload: TndConvertPayload): Envelope<TndConversionResult> {
    return this.http.post<TndEnvelope<TndConversionResult>>(
      `${this.base}/participations/${id}/convert`,
      payload,
    );
  }

  // --- Qualification vault ---

  getVaultOverview(): Envelope<TndVaultOverview> {
    return this.http.get<TndEnvelope<TndVaultOverview>>(`${this.base}/vault/overview`);
  }

  listVaultDocuments(filters: TndVaultFilters = {}): Observable<TndPage<TndVaultDocument>> {
    return this.http.get<TndPage<TndVaultDocument>>(`${this.base}/vault/documents`, {
      params: toHttpParams(filters),
    });
  }

  createVaultDocument(payload: TndVaultPayload): Envelope<TndVaultDocument> {
    return this.http.post<TndEnvelope<TndVaultDocument>>(
      `${this.base}/vault/documents`,
      vaultForm(payload),
    );
  }

  updateVaultDocument(id: string, payload: TndVaultPayload): Envelope<TndVaultDocument> {
    // Multipart updates travel as POST with a method override: PHP does not parse multipart bodies of PUT.
    const form = vaultForm(payload);
    form.append('_method', 'PUT');
    return this.http.post<TndEnvelope<TndVaultDocument>>(
      `${this.base}/vault/documents/${id}`,
      form,
    );
  }

  deleteVaultDocument(id: string): Envelope<null> {
    return this.http.delete<TndEnvelope<null>>(`${this.base}/vault/documents/${id}`);
  }

  renewVaultDocument(id: string, payload: TndVaultPayload): Envelope<TndVaultDocument> {
    return this.http.post<TndEnvelope<TndVaultDocument>>(
      `${this.base}/vault/documents/${id}/renew`,
      vaultForm(payload),
    );
  }

  syncFvoe(id: string): Envelope<TndVaultDocument> {
    return this.http.post<TndEnvelope<TndVaultDocument>>(
      `${this.base}/vault/documents/${id}/sync-fvoe`,
      {},
    );
  }

  // --- Competitor benchmarks ---

  listBenchmarks(filters: TndBenchmarkFilters = {}): Observable<TndPage<TndBenchmark>> {
    return this.http.get<TndPage<TndBenchmark>>(`${this.base}/benchmarks`, {
      params: toHttpParams({ ...filters, winners_only: filters.winners_only ? 1 : undefined }),
    });
  }

  getBenchmarkStatistics(
    filters: Pick<TndBenchmarkFilters, 'contracting_authority_name' | 'cpv_code'> = {},
  ): Envelope<TndBenchmarkStatistics> {
    return this.http.get<TndEnvelope<TndBenchmarkStatistics>>(`${this.base}/benchmarks/statistics`, {
      params: toHttpParams(filters),
    });
  }

  createBenchmark(payload: Partial<TndBenchmarkPayload>): Envelope<TndBenchmark> {
    return this.http.post<TndEnvelope<TndBenchmark>>(`${this.base}/benchmarks`, payload);
  }

  updateBenchmark(id: string, payload: Partial<TndBenchmarkPayload>): Envelope<TndBenchmark> {
    return this.http.put<TndEnvelope<TndBenchmark>>(`${this.base}/benchmarks/${id}`, payload);
  }

  deleteBenchmark(id: string): Envelope<null> {
    return this.http.delete<TndEnvelope<null>>(`${this.base}/benchmarks/${id}`);
  }

  // --- Alerts ---

  listAlerts(
    filters: { acknowledged?: boolean; per_page?: number } = {},
  ): Observable<TndPage<TndAlert>> {
    return this.http.get<TndPage<TndAlert>>(`${this.base}/alerts`, {
      params: toHttpParams({
        ...filters,
        acknowledged: filters.acknowledged === undefined ? undefined : filters.acknowledged ? 1 : 0,
      }),
    });
  }

  acknowledgeAlert(id: string): Envelope<TndAlert> {
    return this.http.post<TndEnvelope<TndAlert>>(`${this.base}/alerts/${id}/acknowledge`, {});
  }
}

/** Multipart body of a vault document: absent values are left out, the SOA list travels as JSON. */
function vaultForm(payload: TndVaultPayload): FormData {
  const form = new FormData();
  for (const [key, value] of Object.entries(payload)) {
    if (value === undefined || value === null || value === '') {
      continue;
    }
    if (key === 'soa_categories_classifications') {
      form.append(key, JSON.stringify(value));
    } else if (value instanceof File) {
      form.append(key, value);
    } else {
      form.append(key, String(value));
    }
  }
  return form;
}
