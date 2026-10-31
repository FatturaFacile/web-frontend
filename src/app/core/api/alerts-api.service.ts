import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import {
  AlertResource,
  ApiResponse,
  CreateAlertPayload,
  PaginatedResponse,
  QueryFilterParams,
  UpdateAlertPayload,
} from '../models';
import { toHttpParams } from '../http/laravel-http.utils';

export interface AlertFilterParams extends QueryFilterParams {
  alertable_type?: string;
  alertable_id?: string;
}

@Service()
export class AlertsApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/alerts`;

  getAlerts(params?: AlertFilterParams): Observable<PaginatedResponse<AlertResource>> {
    return this.http.get<PaginatedResponse<AlertResource>>(this.base, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  getActiveAlerts(params?: { alertable_type?: string; alertable_id?: string }): Observable<ApiResponse<AlertResource[]>> {
    return this.http.get<ApiResponse<AlertResource[]>>(`${this.base}/active`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  getAlertById(id: string): Observable<ApiResponse<AlertResource>> {
    return this.http.get<ApiResponse<AlertResource>>(`${this.base}/${id}`);
  }

  createAlert(payload: CreateAlertPayload): Observable<ApiResponse<AlertResource>> {
    return this.http.post<ApiResponse<AlertResource>>(this.base, payload);
  }

  updateAlert(id: string, payload: UpdateAlertPayload): Observable<ApiResponse<AlertResource>> {
    return this.http.put<ApiResponse<AlertResource>>(`${this.base}/${id}`, payload);
  }

  deleteAlert(id: string): Observable<ApiResponse<unknown>> {
    return this.http.delete<ApiResponse<unknown>>(`${this.base}/${id}`);
  }
}
