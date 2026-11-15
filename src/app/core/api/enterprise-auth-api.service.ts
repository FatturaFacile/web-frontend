import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import {
  ApiResponse,
  RotateScimTokenPayload,
  SamlProvider,
  ScimTokenRotation,
  ScimTokenStatus,
  SecurityPolicy,
  SsoProvider,
  UpdateSecurityPolicyPayload,
  UpsertSamlProviderPayload,
  UpsertSsoProviderPayload,
} from '../models';

/**
 * Tenant security policy, OpenID Connect and SAML providers and SCIM token (`routes/enterprise_auth.php`,
 * owners and administrators, module `system`). Secrets are only sent, never returned: the plain SCIM token
 * is in the rotation response once and the caller must not keep it.
 */
@Service()
export class EnterpriseAuthApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/settings/security`;

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
}
