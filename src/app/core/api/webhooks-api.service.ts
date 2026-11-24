import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { toHttpParams } from '../http/laravel-http.utils';
import { ApiResponse, PaginatedResponse } from '../models';
import { ExtraRecord } from './extra-api.types';

export type WebhookDeliveryStatus = 'pending' | 'retrying' | 'succeeded' | 'dead';

export interface WebhookEndpointRequest {
  name: string;
  /** HTTPS URL only. */
  url: string;
  description?: string | null;
  events: string[];
  payload_version?: string;
}

export interface WebhookDeliveryParams {
  endpoint_id?: string;
  status?: WebhookDeliveryStatus;
  event_name?: string;
  page?: number;
  per_page?: number;
}

/** Outbound webhooks: event catalog, endpoints and delivery log (`/integrations/webhook-*`). */
@Service()
export class WebhooksApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/integrations`;

  /** Catalog of the events an endpoint can subscribe to, plus the signature documentation. */
  getEventCatalog(): Observable<ApiResponse<Record<string, unknown>>> {
    return this.http.get<ApiResponse<Record<string, unknown>>>(`${this.base}/webhook-events`);
  }

  // --- ENDPOINTS ---
  getEndpoints(): Observable<PaginatedResponse<ExtraRecord>> {
    return this.http.get<PaginatedResponse<ExtraRecord>>(`${this.base}/webhook-endpoints`);
  }

  getEndpoint(id: string): Observable<ApiResponse<ExtraRecord>> {
    return this.http.get<ApiResponse<ExtraRecord>>(`${this.base}/webhook-endpoints/${id}`);
  }

  /** The signing secret is returned only in this response. */
  createEndpoint(payload: WebhookEndpointRequest): Observable<ApiResponse<ExtraRecord>> {
    return this.http.post<ApiResponse<ExtraRecord>>(`${this.base}/webhook-endpoints`, payload);
  }

  updateEndpoint(id: string, payload: Partial<WebhookEndpointRequest>): Observable<ApiResponse<ExtraRecord>> {
    return this.http.put<ApiResponse<ExtraRecord>>(`${this.base}/webhook-endpoints/${id}`, payload);
  }

  deleteEndpoint(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/webhook-endpoints/${id}`);
  }

  /** Issues a new secret; the old one stays valid for `overlapHours` hours. */
  rotateEndpointSecret(id: string, overlapHours?: number): Observable<ApiResponse<ExtraRecord>> {
    return this.http.post<ApiResponse<ExtraRecord>>(
      `${this.base}/webhook-endpoints/${id}/rotate-secret`,
      overlapHours === undefined ? {} : { overlap_hours: overlapHours },
    );
  }

  enableEndpoint(id: string): Observable<ApiResponse<ExtraRecord>> {
    return this.http.post<ApiResponse<ExtraRecord>>(`${this.base}/webhook-endpoints/${id}/enable`, {});
  }

  disableEndpoint(id: string): Observable<ApiResponse<ExtraRecord>> {
    return this.http.post<ApiResponse<ExtraRecord>>(`${this.base}/webhook-endpoints/${id}/disable`, {});
  }

  /** Sends a test event to the endpoint. */
  testEndpoint(id: string): Observable<ApiResponse<ExtraRecord>> {
    return this.http.post<ApiResponse<ExtraRecord>>(`${this.base}/webhook-endpoints/${id}/test`, {});
  }

  // --- DELIVERIES ---
  getDeliveries(params?: WebhookDeliveryParams): Observable<PaginatedResponse<ExtraRecord>> {
    return this.http.get<PaginatedResponse<ExtraRecord>>(`${this.base}/webhook-deliveries`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  getDelivery(id: string): Observable<ApiResponse<ExtraRecord>> {
    return this.http.get<ApiResponse<ExtraRecord>>(`${this.base}/webhook-deliveries/${id}`);
  }

  redeliver(id: string): Observable<ApiResponse<ExtraRecord>> {
    return this.http.post<ApiResponse<ExtraRecord>>(`${this.base}/webhook-deliveries/${id}/redeliver`, {});
  }
}
