import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { toHttpParams } from '../http/laravel-http.utils';
import {
  CrisisApproach,
  CrisisCnc,
  CrisisDashboard,
  CrisisEnvelope,
  CrisisLocale,
  CrisisLoan,
  CrisisLoanPayload,
  CrisisMetadata,
  CrisisProfile,
  CrisisRangruecktritt,
  CrisisRequirementParams,
  CrisisStressInput,
  CrisisStressResult,
  CrisisTimelineResponse,
} from '../models';

/** Corporate crisis monitoring, early warning indicators and DSCR endpoints (Mod 357). */
@Service()
export class CrisisMonitoringApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/crisis-monitoring`;

  getDashboard(asOf?: string): Observable<CrisisEnvelope<CrisisDashboard>> {
    return this.http.get<CrisisEnvelope<CrisisDashboard>>(`${this.base}/dashboard`, {
      params: toHttpParams({ as_of: asOf }),
    });
  }

  compute(): Observable<CrisisEnvelope<CrisisDashboard>> {
    return this.http.post<CrisisEnvelope<CrisisDashboard>>(`${this.base}/compute`, {});
  }

  getTimeline(
    horizon: 6 | 12,
    approach: CrisisApproach,
  ): Observable<CrisisEnvelope<CrisisTimelineResponse>> {
    return this.http.get<CrisisEnvelope<CrisisTimelineResponse>>(`${this.base}/timeline`, {
      params: toHttpParams({ horizon, approach }),
    });
  }

  getCncPracticalTest(): Observable<CrisisEnvelope<CrisisCnc>> {
    return this.http.get<CrisisEnvelope<CrisisCnc>>(`${this.base}/cnc-practical-test`);
  }

  getRequirement(
    params: CrisisRequirementParams = {},
  ): Observable<CrisisEnvelope<CrisisRangruecktritt>> {
    return this.http.get<CrisisEnvelope<CrisisRangruecktritt>>(
      `${this.base}/rangruecktritt/required`,
      { params: toHttpParams(params) },
    );
  }

  stressTest(input: CrisisStressInput): Observable<CrisisEnvelope<CrisisStressResult>> {
    return this.http.post<CrisisEnvelope<CrisisStressResult>>(`${this.base}/stress-test`, input);
  }

  downloadDossier(locale: CrisisLocale): Observable<Blob> {
    return this.http.get(`${this.base}/dossier/pdf`, {
      params: toHttpParams({ locale }),
      responseType: 'blob',
    });
  }

  // --- Profile and metadata ---

  getProfile(): Observable<CrisisEnvelope<CrisisProfile>> {
    return this.http.get<CrisisEnvelope<CrisisProfile>>(`${this.base}/profile`);
  }

  updateProfile(payload: Partial<CrisisProfile>): Observable<CrisisEnvelope<CrisisProfile>> {
    return this.http.put<CrisisEnvelope<CrisisProfile>>(`${this.base}/profile`, payload);
  }

  getMetadata(): Observable<CrisisEnvelope<CrisisMetadata>> {
    return this.http.get<CrisisEnvelope<CrisisMetadata>>(`${this.base}/metadata`);
  }

  // --- Subordinated loans ---

  listLoans(): Observable<CrisisEnvelope<CrisisLoan[]>> {
    return this.http.get<CrisisEnvelope<CrisisLoan[]>>(`${this.base}/subordinated-loans`);
  }

  createLoan(payload: CrisisLoanPayload): Observable<CrisisEnvelope<CrisisLoan>> {
    return this.http.post<CrisisEnvelope<CrisisLoan>>(`${this.base}/subordinated-loans`, payload);
  }

  updateLoan(id: string, payload: CrisisLoanPayload): Observable<CrisisEnvelope<CrisisLoan>> {
    return this.http.put<CrisisEnvelope<CrisisLoan>>(
      `${this.base}/subordinated-loans/${id}`,
      payload,
    );
  }

  deleteLoan(id: string): Observable<CrisisEnvelope<unknown>> {
    return this.http.delete<CrisisEnvelope<unknown>>(`${this.base}/subordinated-loans/${id}`);
  }

  downloadAgreement(id: string, locale: CrisisLocale): Observable<Blob> {
    return this.http.get(`${this.base}/subordinated-loans/${id}/agreement/pdf`, {
      params: toHttpParams({ locale }),
      responseType: 'blob',
    });
  }
}
