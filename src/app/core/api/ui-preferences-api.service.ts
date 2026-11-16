import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { ApiResponse } from '../models';
import {
  TenantBranding,
  UpdateTenantBrandingPayload,
  UpdateUserUiPreferencesPayload,
  UserUiPreferences,
} from '../theme/ui-preferences.types';

/** Interface preferences of the signed-in user and the branding of the active tenant. */
@Service()
export class UiPreferencesApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  getUserPreferences(): Observable<ApiResponse<UserUiPreferences>> {
    return this.http.get<ApiResponse<UserUiPreferences>>(`${this.base}/user/preferences`);
  }

  updateUserPreferences(
    payload: UpdateUserUiPreferencesPayload,
  ): Observable<ApiResponse<UserUiPreferences>> {
    return this.http.patch<ApiResponse<UserUiPreferences>>(
      `${this.base}/user/preferences`,
      payload,
    );
  }

  getTenantBranding(): Observable<ApiResponse<TenantBranding>> {
    return this.http.get<ApiResponse<TenantBranding>>(`${this.base}/tenant/branding`);
  }

  updateTenantBranding(
    payload: UpdateTenantBrandingPayload,
  ): Observable<ApiResponse<TenantBranding>> {
    return this.http.patch<ApiResponse<TenantBranding>>(`${this.base}/tenant/branding`, payload);
  }
}
