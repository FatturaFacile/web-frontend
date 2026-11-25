import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { toHttpParams } from '../http/laravel-http.utils';
import {
  CsAnalyticsFilters,
  CsAssignPayload,
  CsBreakdownRow,
  CsDispatch,
  CsEnvelope,
  CsFeedbackPayload,
  CsGranularity,
  CsGroupBy,
  CsListFilters,
  CsLookups,
  CsOverview,
  CsPublicSurvey,
  CsRecoveryCase,
  CsReport,
  CsReportFormat,
  CsReportPayload,
  CsResponse,
  CsSentiment,
  CsTemplate,
  CsTemplatePayload,
  CsTransitionPayload,
  CsTrendRow,
} from '../models';

type Envelope<T> = Observable<CsEnvelope<T>>;

/** Endpoints of the customer satisfaction module (Mod 245): staff screens and the public, token-secured survey pages. */
@Service()
export class CustomerSatisfactionApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/customer-satisfaction`;
  private readonly publicBase = `${environment.apiBaseUrl}/public/surveys`;

  getLookups(): Envelope<CsLookups> {
    return this.http.get<CsEnvelope<CsLookups>>(`${this.base}/lookups`);
  }

  // --- Templates and trigger rules ---

  listTemplates(filters: CsListFilters = {}): Envelope<CsTemplate[]> {
    return this.http.get<CsEnvelope<CsTemplate[]>>(`${this.base}/templates`, {
      params: toHttpParams(filters),
    });
  }

  createTemplate(payload: CsTemplatePayload): Envelope<CsTemplate> {
    return this.http.post<CsEnvelope<CsTemplate>>(`${this.base}/templates`, payload);
  }

  updateTemplate(id: string, payload: Partial<CsTemplatePayload>): Envelope<CsTemplate> {
    return this.http.put<CsEnvelope<CsTemplate>>(`${this.base}/templates/${id}`, payload);
  }

  deleteTemplate(id: string): Envelope<null> {
    return this.http.delete<CsEnvelope<null>>(`${this.base}/templates/${id}`);
  }

  installDefaultTemplates(): Envelope<{ created: number }> {
    return this.http.post<CsEnvelope<{ created: number }>>(
      `${this.base}/templates/install-defaults`,
      {},
    );
  }

  // --- Dispatch monitor and answers ---

  listDispatches(filters: CsListFilters = {}): Envelope<CsDispatch[]> {
    return this.http.get<CsEnvelope<CsDispatch[]>>(`${this.base}/dispatches`, {
      params: toHttpParams(filters),
    });
  }

  getDispatch(id: string): Envelope<CsDispatch> {
    return this.http.get<CsEnvelope<CsDispatch>>(`${this.base}/dispatches/${id}`);
  }

  processDispatches(): Envelope<{ sent: number; failed: number; suppressed: number }> {
    return this.http.post<CsEnvelope<{ sent: number; failed: number; suppressed: number }>>(
      `${this.base}/dispatches/process`,
      {},
    );
  }

  listResponses(filters: CsListFilters = {}): Envelope<CsResponse[]> {
    return this.http.get<CsEnvelope<CsResponse[]>>(`${this.base}/responses`, {
      params: toHttpParams(filters),
    });
  }

  /** The voice comment of an answer; fetched with the session so an `<audio>` element can play the blob. */
  getVoice(responseId: string): Observable<Blob> {
    return this.http.get(`${this.base}/responses/${responseId}/voice`, { responseType: 'blob' });
  }

  // --- Closed-loop recovery ---

  listRecoveryCases(filters: CsListFilters = {}): Envelope<CsRecoveryCase[]> {
    return this.http.get<CsEnvelope<CsRecoveryCase[]>>(`${this.base}/recovery-cases`, {
      params: toHttpParams(filters),
    });
  }

  transitionRecoveryCase(id: string, payload: CsTransitionPayload): Envelope<CsRecoveryCase> {
    return this.http.post<CsEnvelope<CsRecoveryCase>>(
      `${this.base}/recovery-cases/${id}/transition`,
      payload,
    );
  }

  assignRecoveryCase(id: string, payload: CsAssignPayload): Envelope<CsRecoveryCase> {
    return this.http.put<CsEnvelope<CsRecoveryCase>>(
      `${this.base}/recovery-cases/${id}/assign`,
      payload,
    );
  }

  // --- ISO 9001 analytics and reports ---

  getOverview(filters: CsAnalyticsFilters = {}): Envelope<CsOverview> {
    return this.http.get<CsEnvelope<CsOverview>>(`${this.base}/analytics/overview`, {
      params: toHttpParams(filters),
    });
  }

  getBreakdown(
    groupBy: CsGroupBy,
    filters: CsAnalyticsFilters = {},
  ): Envelope<{ group_by: CsGroupBy; rows: CsBreakdownRow[] }> {
    return this.http.get<CsEnvelope<{ group_by: CsGroupBy; rows: CsBreakdownRow[] }>>(
      `${this.base}/analytics/breakdown`,
      { params: toHttpParams({ ...filters, group_by: groupBy }) },
    );
  }

  getTrend(
    granularity: CsGranularity,
    filters: CsAnalyticsFilters = {},
  ): Envelope<{ granularity: CsGranularity; rows: CsTrendRow[] }> {
    return this.http.get<CsEnvelope<{ granularity: CsGranularity; rows: CsTrendRow[] }>>(
      `${this.base}/analytics/trend`,
      { params: toHttpParams({ ...filters, granularity }) },
    );
  }

  getSentiment(filters: CsAnalyticsFilters = {}): Envelope<CsSentiment> {
    return this.http.get<CsEnvelope<CsSentiment>>(`${this.base}/analytics/sentiment`, {
      params: toHttpParams(filters),
    });
  }

  listReports(): Envelope<CsReport[]> {
    return this.http.get<CsEnvelope<CsReport[]>>(`${this.base}/reports`);
  }

  getReport(id: string): Envelope<CsReport> {
    return this.http.get<CsEnvelope<CsReport>>(`${this.base}/reports/${id}`);
  }

  generateReport(payload: CsReportPayload): Envelope<CsReport> {
    return this.http.post<CsEnvelope<CsReport>>(`${this.base}/reports`, payload);
  }

  exportReport(id: string, format: CsReportFormat): Observable<Blob> {
    return this.http.get(`${this.base}/reports/${id}/export`, {
      params: toHttpParams({ format }),
      responseType: 'blob',
    });
  }

  // --- Public survey (no login, the token is the credential) ---

  getPublicSurvey(token: string): Envelope<CsPublicSurvey> {
    return this.http.get<CsEnvelope<CsPublicSurvey>>(`${this.publicBase}/${token}`);
  }

  submitPublicScore(token: string, score: number): Envelope<CsResponse> {
    return this.http.post<CsEnvelope<CsResponse>>(`${this.publicBase}/${token}/respond`, {
      score,
      submitted_via: 'landing_page',
    });
  }

  submitPublicFeedback(token: string, payload: CsFeedbackPayload): Envelope<CsResponse> {
    const form = new FormData();
    if (payload.comment_text) {
      form.append('comment_text', payload.comment_text);
    }
    if (payload.voice) {
      form.append('voice', payload.voice, 'voice-note.webm');
    }
    if (payload.voice_duration_seconds) {
      form.append('voice_duration_seconds', String(payload.voice_duration_seconds));
    }
    if (payload.voice_transcript) {
      form.append('voice_transcript', payload.voice_transcript);
    }

    return this.http.post<CsEnvelope<CsResponse>>(`${this.publicBase}/${token}/feedback`, form);
  }

  optOutPublic(token: string): Envelope<null> {
    return this.http.post<CsEnvelope<null>>(`${this.publicBase}/${token}/opt-out`, {});
  }
}
