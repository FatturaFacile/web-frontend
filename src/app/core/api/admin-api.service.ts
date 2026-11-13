import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { toHttpParams } from '../http/laravel-http.utils';
import {
  ApiResponse,
  DocumentQuotaState,
  PaginatedResponse,
  QueryFilterParams,
  TenantAccessDecisionPayload,
  TenantAccessRequestRecord,
  TenantAccessRequestStatus,
} from '../models';

/** Platform administration under `/admin/*` (403 unless the user is a platform administrator). */
@Service()
export class AdminApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/admin`;

  getTenantAccessRequests(params?: QueryFilterParams & { status?: TenantAccessRequestStatus | null }): Observable<PaginatedResponse<TenantAccessRequestRecord>> {
    return this.http.get<PaginatedResponse<TenantAccessRequestRecord>>(`${this.base}/tenant-access-requests`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  approveTenantAccessRequest(
    id: string,
    payload: TenantAccessDecisionPayload,
  ): Observable<ApiResponse<TenantAccessRequestRecord>> {
    return this.http.post<ApiResponse<TenantAccessRequestRecord>>(`${this.base}/tenant-access-requests/${id}/approve`, payload);
  }

  /** Moves the user to another existing tenant (`tenant_id`). */
  moveTenantAccessRequest(
    id: string,
    payload: TenantAccessDecisionPayload,
  ): Observable<ApiResponse<TenantAccessRequestRecord>> {
    return this.http.post<ApiResponse<TenantAccessRequestRecord>>(`${this.base}/tenant-access-requests/${id}/move`, payload);
  }

  rejectTenantAccessRequest(
    id: string,
    payload: TenantAccessDecisionPayload,
  ): Observable<ApiResponse<TenantAccessRequestRecord>> {
    return this.http.post<ApiResponse<TenantAccessRequestRecord>>(`${this.base}/tenant-access-requests/${id}/reject`, payload);
  }

  /** `null` removes the limit. */
  setDocumentQuota(tenantId: string, points: number | null): Observable<ApiResponse<DocumentQuotaState>> {
    return this.http.put<ApiResponse<DocumentQuotaState>>(`${this.base}/tenants/${tenantId}/document-quota`, {
      document_quota_points: points,
    });
  }
}
