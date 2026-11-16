import { HttpClient, HttpContext } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { toHttpParams } from '../http/laravel-http.utils';
import { HANDLED_ERROR_STATUSES } from '../interceptors/error.interceptor';
import {
  AcceptEstimatePayload,
  DeclineEstimatePayload,
  EsmEnvelope,
  PublicEstimate,
  PublicEstimateDecisionResult,
  PublicTracking,
} from '../models';

/**
 * Customer-facing estimate approval and RMA tracking (`/public/rma`, no session).
 * Bad or expired tokens answer 404 and repeated decisions 409: the public pages render
 * those states themselves, so the global error toast is suppressed for them.
 */
@Service()
export class PublicRmaApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/public/rma`;

  private readonly context = () => new HttpContext().set(HANDLED_ERROR_STATUSES, [404, 409]);

  getEstimate(token: string): Observable<EsmEnvelope<PublicEstimate>> {
    return this.http.get<EsmEnvelope<PublicEstimate>>(
      `${this.base}/estimates/${encodeURIComponent(token)}`,
      {
        context: this.context(),
      },
    );
  }

  acceptEstimate(
    token: string,
    payload: AcceptEstimatePayload,
  ): Observable<EsmEnvelope<PublicEstimateDecisionResult>> {
    return this.http.post<EsmEnvelope<PublicEstimateDecisionResult>>(
      `${this.base}/estimates/${encodeURIComponent(token)}/accept`,
      payload,
      { context: this.context() },
    );
  }

  declineEstimate(
    token: string,
    payload: DeclineEstimatePayload,
  ): Observable<EsmEnvelope<PublicEstimateDecisionResult>> {
    return this.http.post<EsmEnvelope<PublicEstimateDecisionResult>>(
      `${this.base}/estimates/${encodeURIComponent(token)}/decline`,
      payload,
      { context: this.context() },
    );
  }

  getTracking(rmaNumber: string, token: string): Observable<EsmEnvelope<PublicTracking>> {
    return this.http.get<EsmEnvelope<PublicTracking>>(`${this.base}/tracking`, {
      params: toHttpParams({ rma_number: rmaNumber, token }),
      context: this.context(),
    });
  }
}
