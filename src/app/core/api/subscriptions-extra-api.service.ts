import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { toHttpParams } from '../http/laravel-http.utils';
import { ApiResponse, LaravelPaginationMeta } from '../models';

type Filters = Record<string, string | number | boolean | null | undefined | string[]>;
/** Request body: field names mirror the Laravel FormRequest of the route. */
type Payload = Record<string, unknown>;
/** Generic resource returned by the API. */
type Row = Record<string, unknown>;
type ListResponse<T> = ApiResponse<T[]> & { meta?: LaravelPaginationMeta };

/** Additional endpoints of the subscriptions API not covered by the dedicated typed services. */
@Service()
export class SubscriptionsExtraApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  /** POST /subscriptions/{}/pause */
  pauseSubscription(subscriptionId: string, payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/subscriptions/${subscriptionId}/pause`, payload);
  }

  /** POST /subscriptions/{}/resume */
  resumeSubscription(subscriptionId: string, payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/subscriptions/${subscriptionId}/resume`, payload);
  }

  /** POST /subscriptions/{}/cancel */
  cancelSubscription(subscriptionId: string, payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/subscriptions/${subscriptionId}/cancel`, payload);
  }

  /** POST /subscriptions/{}/bill */
  billSubscription(subscriptionId: string, payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/subscriptions/${subscriptionId}/bill`, payload);
  }

  /** GET /subscriptions/{}/runs */
  listSubscriptionRuns(subscriptionId: string, filters?: Filters): Observable<ListResponse<Row>> {
    return this.http.get<ListResponse<Row>>(`${this.base}/subscriptions/${subscriptionId}/runs`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** GET /subscriptions/{} */
  getSubscription(subscriptionId: string, filters?: Filters): Observable<ApiResponse<Row>> {
    return this.http.get<ApiResponse<Row>>(`${this.base}/subscriptions/${subscriptionId}`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** PUT /subscriptions/{} */
  updateSubscription(subscriptionId: string, payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.put<ApiResponse<Row>>(`${this.base}/subscriptions/${subscriptionId}`, payload);
  }

  /** DELETE /subscriptions/{} */
  deleteSubscription(subscriptionId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/subscriptions/${subscriptionId}`);
  }

  /** GET /subscriptions/plans */
  listPlans(filters?: Filters): Observable<ListResponse<Row>> {
    return this.http.get<ListResponse<Row>>(`${this.base}/subscriptions/plans`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** POST /subscriptions/plans */
  createPlan(payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/subscriptions/plans`, payload);
  }

  /** GET /subscriptions/metrics */
  getMetrics(filters?: Filters): Observable<ApiResponse<Row>> {
    return this.http.get<ApiResponse<Row>>(`${this.base}/subscriptions/metrics`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** PUT /subscriptions/dunning-policy */
  saveDunningPolicy(payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.put<ApiResponse<Row>>(`${this.base}/subscriptions/dunning-policy`, payload);
  }

  /** POST /sub/contracts/{}/activate */
  activateSubscription(subscriptionId: string, payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/sub/contracts/${subscriptionId}/activate`, payload);
  }

  /** POST /sub/contracts/{}/suspend */
  suspendSubscription(subscriptionId: string, payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/sub/contracts/${subscriptionId}/suspend`, payload);
  }

  /** POST /sub/contracts/{}/reactivate */
  reactivateSubscription(subscriptionId: string, payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/sub/contracts/${subscriptionId}/reactivate`, payload);
  }

  /** POST /sub/contracts/{}/upgrade */
  upgradeSubscription(subscriptionId: string, payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/sub/contracts/${subscriptionId}/upgrade`, payload);
  }

  /** POST /sub/contracts/{}/downgrade */
  downgradeSubscription(subscriptionId: string, payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/sub/contracts/${subscriptionId}/downgrade`, payload);
  }
}
