import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import {
  ApiResponse,
  RotateScimTokenPayload,
  SamlProvider,
  ScimGroupMapping,
  ScimGroupMappingsResponse,
  ScimLogFilters,
  ScimProvisioningLog,
  ScimTokenRotation,
  ScimTokenStatus,
  SecurityAuditEvent,
  SecurityAuditEventType,
  SecurityAuditFilters,
  SecurityPagedResponse,
  SecurityPolicy,
  SsoProvider,
  UpdateSecurityPolicyPayload,
  UpsertSamlProviderPayload,
  UpsertScimGroupMappingPayload,
  UpsertSsoProviderPayload,
} from '../models';

/**
 * Tenant security policy, OpenID Connect and SAML providers, SCIM token, group mappings and logs, the security audit
 * log and account unlock (`routes/enterprise_auth.php`, owners and administrators, module `system`). Secrets are only
 * sent, never returned: the plain SCIM token is in the rotation response once and the caller must not keep it.
 */
@Service()
export class EnterpriseAuthApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/settings/security`;
  private readonly usersBase = `${environment.apiBaseUrl}/settings/users`;

  getPolicy(): Observable<ApiResponse<SecurityPolicy>> {
    return this.http.get<ApiResponse<SecurityPolicy>>(`${this.base}/policy`);
  }

  updatePolicy(payload: UpdateSecurityPolicyPayload): Observable<ApiResponse<SecurityPolicy>> {
    return this.http.put<ApiResponse<SecurityPolicy>>(`${this.base}/policy`, payload);
  }

  /** `data` is null while no provider is configured. */
  getSsoProvider(): Observable<ApiResponse<SsoProvider | null>> {
    return this.http.get<ApiResponse<SsoProvider | null>>(`${this.base}/sso`);
  }

  upsertSsoProvider(payload: UpsertSsoProviderPayload): Observable<ApiResponse<SsoProvider>> {
    return this.http.put<ApiResponse<SsoProvider>>(`${this.base}/sso`, payload);
  }

  /** Reads the OpenID configuration of the issuer again: the connection test of the provider. */
  refreshSsoDiscovery(): Observable<ApiResponse<SsoProvider>> {
    return this.http.post<ApiResponse<SsoProvider>>(`${this.base}/sso/discovery`, {});
  }

  deleteSsoProvider(): Observable<ApiResponse<null>> {
    return this.http.delete<ApiResponse<null>>(`${this.base}/sso`);
  }

  /** `data` is null while no provider is configured. */
  getSamlProvider(): Observable<ApiResponse<SamlProvider | null>> {
    return this.http.get<ApiResponse<SamlProvider | null>>(`${this.base}/saml`);
  }

  upsertSamlProvider(payload: UpsertSamlProviderPayload): Observable<ApiResponse<SamlProvider>> {
    return this.http.put<ApiResponse<SamlProvider>>(`${this.base}/saml`, payload);
  }

  /** Fetches the identity provider metadata again from its URL: the connection test of the provider. */
  refreshSamlMetadata(): Observable<ApiResponse<SamlProvider>> {
    return this.http.post<ApiResponse<SamlProvider>>(`${this.base}/saml/metadata`, {});
  }

  deleteSamlProvider(): Observable<ApiResponse<null>> {
    return this.http.delete<ApiResponse<null>>(`${this.base}/saml`);
  }

  /** Token status and, in `data.sync`, the provisioning counters and the last error of the identity provider. */
  getScimToken(): Observable<ApiResponse<ScimTokenStatus>> {
    return this.http.get<ApiResponse<ScimTokenStatus>>(`${this.base}/scim`);
  }

  /** Creates a new token and revokes the previous one; the plain token is in this response only. */
  rotateScimToken(payload: RotateScimTokenPayload = {}): Observable<ApiResponse<ScimTokenRotation>> {
    return this.http.post<ApiResponse<ScimTokenRotation>>(`${this.base}/scim/token`, payload);
  }

  revokeScimToken(): Observable<ApiResponse<null>> {
    return this.http.delete<ApiResponse<null>>(`${this.base}/scim/token`);
  }

  /** Group-to-role mappings; `meta.roles` lists the roles a group may be mapped to. */
  getScimGroupMappings(): Observable<ScimGroupMappingsResponse> {
    return this.http.get<ScimGroupMappingsResponse>(`${this.base}/scim/group-mappings`);
  }

  /** Creates (201) or updates (200) the mapping of a group name. */
  upsertScimGroupMapping(payload: UpsertScimGroupMappingPayload): Observable<ApiResponse<ScimGroupMapping>> {
    return this.http.put<ApiResponse<ScimGroupMapping>>(`${this.base}/scim/group-mappings`, payload);
  }

  deleteScimGroupMapping(id: string): Observable<ApiResponse<null>> {
    return this.http.delete<ApiResponse<null>>(`${this.base}/scim/group-mappings/${id}`);
  }

  getScimLogs(filters: ScimLogFilters = {}): Observable<SecurityPagedResponse<ScimProvisioningLog>> {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, String(value));
      }
    }
    return this.http.get<SecurityPagedResponse<ScimProvisioningLog>>(`${this.base}/scim/logs`, { params });
  }

  /** Security audit log of the tenant (logins, passwords, second factors, sessions, lockouts, SSO, SCIM, policy). */
  getSecurityAudit(filters: SecurityAuditFilters = {}): Observable<SecurityPagedResponse<SecurityAuditEvent>> {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value === undefined || value === null || value === '') {
        continue;
      }
      if (Array.isArray(value)) {
        if (value.length > 0) {
          params = params.set(key, value.join(','));
        }
      } else {
        params = params.set(key, String(value));
      }
    }
    return this.http.get<SecurityPagedResponse<SecurityAuditEvent>>(`${this.base}/audit`, { params });
  }

  getSecurityAuditEventTypes(): Observable<ApiResponse<SecurityAuditEventType[]>> {
    return this.http.get<ApiResponse<SecurityAuditEventType[]>>(`${this.base}/audit/event-types`);
  }

  /** Lifts the lockout of a member and resets the failed attempts (owners and administrators). */
  unlockUser(userId: string): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(`${this.usersBase}/${userId}/unlock`, {});
  }
}
