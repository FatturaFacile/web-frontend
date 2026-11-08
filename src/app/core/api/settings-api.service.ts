import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import {
  ApiResponse,
  AuditLogResource,
  BranchResource,
  ResetUserTwoFactorResponse,
  RoleResource,
  TenantPreferences,
  TenantSettings,
  TwoFactorPolicyResponse,
  UpdateTenantSettingsPayload,
  UpdateTwoFactorPolicyPayload,
  UserResource,
} from '../models';

@Service()
export class SettingsApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/settings`;

  getTenantSettings(): Observable<ApiResponse<TenantSettings>> {
    return this.http.get<ApiResponse<TenantSettings>>(`${this.base}/tenant`);
  }

  updateTenantSettings(payload: UpdateTenantSettingsPayload): Observable<ApiResponse<TenantSettings>> {
    return this.http.put<ApiResponse<TenantSettings>>(`${this.base}/tenant`, payload);
  }

  getBranches(): Observable<ApiResponse<BranchResource[]>> {
    return this.http.get<ApiResponse<BranchResource[]>>(`${this.base}/branches`);
  }

  syncExchangeRates(): Observable<ApiResponse<{ synced_count: number }>> {
    return this.http.post<ApiResponse<{ synced_count: number }>>(`${this.base}/exchange-rates/sync`, {});
  }

  getTenantUsers(): Observable<ApiResponse<UserResource[]>> {
    return this.http.get<ApiResponse<UserResource[]>>(`${this.base}/users`);
  }

  getSystemRoles(): Observable<ApiResponse<RoleResource[]>> {
    return this.http.get<ApiResponse<RoleResource[]>>(`${this.base}/roles`);
  }

  getAuditLogs(): Observable<ApiResponse<AuditLogResource[]>> {
    return this.http.get<ApiResponse<AuditLogResource[]>>(`${this.base}/audit-logs`);
  }

  getTenantPreferences(): Observable<ApiResponse<TenantPreferences>> {
    return this.http.get<ApiResponse<TenantPreferences>>(`${this.base}/preferences`);
  }

  updateTenantPreferences(group: string, payload: Record<string, unknown>): Observable<ApiResponse<TenantPreferences>> {
    return this.http.put<ApiResponse<TenantPreferences>>(`${this.base}/preferences/${group}`, payload);
  }

  getTwoFactorPolicy(): Observable<ApiResponse<TwoFactorPolicyResponse>> {
    return this.http.get<ApiResponse<TwoFactorPolicyResponse>>(`${this.base}/security/two-factor`);
  }

  updateTwoFactorPolicy(payload: UpdateTwoFactorPolicyPayload): Observable<ApiResponse<TwoFactorPolicyResponse>> {
    return this.http.put<ApiResponse<TwoFactorPolicyResponse>>(`${this.base}/security/two-factor`, payload);
  }

  resetUserTwoFactor(userId: string): Observable<ApiResponse<ResetUserTwoFactorResponse>> {
    return this.http.post<ApiResponse<ResetUserTwoFactorResponse>>(`${this.base}/users/${userId}/two-factor/reset`, {});
  }
}
