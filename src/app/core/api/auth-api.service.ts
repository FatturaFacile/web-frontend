import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { map, Observable, switchMap } from 'rxjs';
import {
  ApiResponse,
  ConfirmedPasswordPayload,
  ConfirmTwoFactorPayload,
  ConfirmTwoFactorResponse,
  DisableTwoFactorPayload,
  RecoveryCodesResponse,
  RevokeOtherSessionsResponse,
  TokenSessionItem,
  TwoFactorChallengePayload,
  TwoFactorEnableResponse,
  TwoFactorStatus,
  WebSessionItem,
} from '../models';
import { getCsrfCookieUrl } from '../auth/csrf.utils';
import type { UserProfile } from '../auth/auth.store';

export interface LoginPayload {
  email: string;
  password: string;
  tenant_id?: string | null;
  remember?: boolean;
}

/**
 * Result of a login. The session is the HttpOnly cookie that the API sets: the body never carries a bearer
 * token and the app would not use one (cookie-only authentication).
 */
export interface LoginResult {
  user?: UserProfile;
  message?: string;
  tenant_id?: string;
  two_factor_setup_required?: boolean;
  active_tenant?: {
    id: string;
    name: string;
    legal_name?: string;
    country: string;
    default_currency?: string;
    role: string | null;
  } | null;
  available_tenants?: {
    id: string;
    name: string;
    country: string;
    role: string | null;
  }[];
  two_factor_required?: boolean;
  challenge_token?: string;
  expires_in?: number;
}

export interface RegisterPayload {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  password_confirmation: string;
  company_name: string;
  country: 'IT' | 'CH';
  tax_id: string;
  terms_accepted: boolean;
  privacy_accepted: boolean;
}

export interface ResetPasswordPayload {
  token: string;
  password: string;
  password_confirmation: string;
}

/** With two factors active, `code` or `recovery_code` is required as well. */
export interface ChangePasswordPayload {
  current_password: string;
  password: string;
  password_confirmation: string;
  code?: string;
  recovery_code?: string;
}

/** RFC 7807 `type` of the authentication problems that need their own message. */
export const AUTH_PROBLEM = {
  EmailNotVerified: 'urn:fatturafacile:problem:email-not-verified',
  TenantApprovalPending: 'urn:fatturafacile:problem:tenant-approval-pending',
  TenantAccessRejected: 'urn:fatturafacile:problem:tenant-access-rejected',
  VerificationTokenInvalid: 'urn:fatturafacile:problem:verification-token-invalid',
  VerificationTokenExpired: 'urn:fatturafacile:problem:verification-token-expired',
  PasswordResetTokenInvalid: 'urn:fatturafacile:problem:password-reset-token-invalid',
  PasswordResetTokenExpired: 'urn:fatturafacile:problem:password-reset-token-expired',
  PasswordResetLocked: 'urn:fatturafacile:problem:password-reset-locked',
  PasswordChangeLocked: 'urn:fatturafacile:problem:password-change-locked',
  TwoFactorChallengeInvalid: 'urn:fatturafacile:problem:two-factor-challenge-invalid',
  TwoFactorCodeInvalid: 'urn:fatturafacile:problem:two-factor-code-invalid',
  TwoFactorSetupRequired: 'urn:fatturafacile:problem:two-factor-setup-required',
} as const;

export function authProblemOf(err: unknown): string | null {
  if (err instanceof HttpErrorResponse && typeof err.error === 'object' && err.error !== null) {
    const type = (err.error as { type?: unknown }).type;
    return typeof type === 'string' ? type : null;
  }
  return null;
}

/** Identity protocol of a tenant's single sign-on. The API has no public endpoint that tells which one a tenant uses. */
export type SsoProtocol = 'oidc' | 'saml';

/** Answer of `POST /auth/sso/discover`: unknown, disabled and ambiguous domains all look the same (unavailable). */
export interface SsoDiscovery {
  available: boolean;
  protocol: SsoProtocol | null;
  tenant_id: string | null;
}

export interface SwitchTenantPayload {
  tenant_id?: string | null;
}

/**
 * Service for Laravel Sanctum SPA Cookie-based authentication.
 *
 * All requests use HTTP-only session cookies and CSRF tokens instead of client-side token storage,
 * providing superior security against XSS token exfiltration.
 */
@Service()
export class AuthApiService {
  private readonly http = inject(HttpClient);
  private readonly csrfCookieUrl = getCsrfCookieUrl();
  private readonly base = environment.apiBaseUrl;

  /**
   * Fetches the CSRF cookie from Laravel Sanctum (`GET /sanctum/csrf-cookie`).
   * This initializes the browser session and sets the `XSRF-TOKEN` cookie required
   * for state-mutating requests (such as login).
   */
  getCsrfCookie(): Observable<unknown> {
    return this.http.get(this.csrfCookieUrl, {
      withCredentials: true,
      responseType: 'text',
    });
  }

  /**
   * Executes a cookie-based login request.
   * Ensures the CSRF cookie handshake is performed before dispatching the `POST /auth/login` mutation.
   * On success, the backend sets the HTTP-only session cookie (`laravel_session`).
   */
  login(payload: LoginPayload): Observable<ApiResponse<LoginResult>> {
    return this.getCsrfCookie().pipe(
      switchMap(() =>
        this.http.post<ApiResponse<LoginResult>>(
          `${this.base}/auth/login`,
          payload,
          { withCredentials: true }
        )
      )
    );
  }

  /**
   * Which single sign-on to offer for an email address (`POST /auth/sso/discover`, public). It does not say whether
   * the password login is still allowed, so the password form must stay.
   */
  discoverSso(email: string): Observable<SsoDiscovery> {
    return this.http
      .post<ApiResponse<{ sso?: SsoDiscovery }>>(`${this.base}/auth/sso/discover`, { email }, { withCredentials: true })
      .pipe(map((res) => res.data?.sso ?? { available: false, protocol: null, tenant_id: null }));
  }

  /**
   * Completes an OpenID Connect sign-in: posts the `code` and `state` the identity provider returned to the SPA
   * (`POST /auth/sso/callback`, credentials included so the `sso_flow` cookie binds it to this browser).
   */
  completeOidcSso(code: string, state: string): Observable<ApiResponse<LoginResult>> {
    return this.getCsrfCookie().pipe(
      switchMap(() =>
        this.http.post<ApiResponse<LoginResult>>(
          `${this.base}/auth/sso/callback`,
          { code, state },
          { withCredentials: true },
        ),
      ),
    );
  }

  /**
   * Starts a single sign-on for a tenant and returns the URL of its identity provider
   * (`POST /auth/sso/start` for OpenID Connect, `POST /auth/saml/start` for SAML).
   */
  startSso(protocol: SsoProtocol, tenantId: string): Observable<string> {
    const path = protocol === 'saml' ? 'saml' : 'sso';
    return this.http
      .post<ApiResponse<{ authorization_url?: string; redirect_url?: string }>>(
        `${this.base}/auth/${path}/start`,
        { tenant_id: tenantId },
        { withCredentials: true },
      )
      .pipe(map((res) => res.data?.authorization_url ?? res.data?.redirect_url ?? ''));
  }

  /**
   * Exchanges the single-use code that the SAML sign-in handed to the SPA for the cookie session
   * (`POST /auth/sso/exchange`, after the CSRF cookie handshake). The answer is that of the password login.
   */
  exchangeSsoCode(code: string): Observable<ApiResponse<LoginResult>> {
    return this.getCsrfCookie().pipe(
      switchMap(() =>
        this.http.post<ApiResponse<LoginResult>>(
          `${this.base}/auth/sso/exchange`,
          { code },
          { withCredentials: true },
        ),
      ),
    );
  }

  /**
   * Exchanges the challenge of a login with two factors for a Sanctum session.
   */
  twoFactorChallenge(payload: TwoFactorChallengePayload): Observable<ApiResponse<LoginResult>> {
    return this.http.post<ApiResponse<LoginResult>>(
      `${this.base}/auth/two-factor-challenge`,
      payload,
      { withCredentials: true }
    );
  }

  /**
   * Retrieves the current user's two-factor authentication configuration.
   */
  getTwoFactorStatus(): Observable<ApiResponse<TwoFactorStatus>> {
    return this.http.get<ApiResponse<TwoFactorStatus>>(
      `${this.base}/auth/two-factor`,
      { withCredentials: true }
    );
  }

  /**
   * Begins enabling two-factor authentication by verifying the password and obtaining the OTP URI.
   */
  enableTwoFactor(payload: ConfirmedPasswordPayload): Observable<ApiResponse<TwoFactorEnableResponse>> {
    return this.http.post<ApiResponse<TwoFactorEnableResponse>>(
      `${this.base}/auth/two-factor/enable`,
      payload,
      { withCredentials: true }
    );
  }

  /**
   * Confirms two-factor authentication with the first authenticator code and returns single-use recovery codes.
   */
  confirmTwoFactor(payload: ConfirmTwoFactorPayload): Observable<ApiResponse<ConfirmTwoFactorResponse>> {
    return this.http.post<ApiResponse<ConfirmTwoFactorResponse>>(
      `${this.base}/auth/two-factor/confirm`,
      payload,
      { withCredentials: true }
    );
  }

  /**
   * Regenerates a new set of two-factor recovery codes.
   */
  getTwoFactorRecoveryCodes(payload: ConfirmedPasswordPayload): Observable<ApiResponse<RecoveryCodesResponse>> {
    return this.http.post<ApiResponse<RecoveryCodesResponse>>(
      `${this.base}/auth/two-factor/recovery-codes`,
      payload,
      { withCredentials: true }
    );
  }

  /**
   * Disables two-factor authentication with password confirmation and a code or recovery code.
   */
  disableTwoFactor(payload: DisableTwoFactorPayload): Observable<ApiResponse<TwoFactorStatus>> {
    return this.http.post<ApiResponse<TwoFactorStatus>>(
      `${this.base}/auth/two-factor/disable`,
      payload,
      { withCredentials: true }
    );
  }

  /**
   * Retrieves active tokens and web sessions for the authenticated user.
   */
  getSessions(): Observable<ApiResponse<[TokenSessionItem[], WebSessionItem[]]>> {
    return this.http.get<ApiResponse<[TokenSessionItem[], WebSessionItem[]]>>(
      `${this.base}/auth/sessions`,
      { withCredentials: true }
    );
  }

  /**
   * Revokes a specific token or web session.
   */
  revokeSession(kind: 'token' | 'session', id: string): Observable<ApiResponse<null>> {
    return this.http.delete<ApiResponse<null>>(
      `${this.base}/auth/sessions/${kind}/${id}`,
      { withCredentials: true }
    );
  }

  /**
   * Revokes all other sessions except the active one, requiring password confirmation.
   */
  revokeOtherSessions(payload: ConfirmedPasswordPayload): Observable<ApiResponse<RevokeOtherSessionsResponse>> {
    return this.http.post<ApiResponse<RevokeOtherSessionsResponse>>(
      `${this.base}/auth/sessions/revoke-others`,
      payload,
      { withCredentials: true }
    );
  }

  /** Creates an account. The answer is the same whether or not the address is already known. */
  register(payload: RegisterPayload): Observable<ApiResponse<unknown>> {
    return this.getCsrfCookie().pipe(
      switchMap(() =>
        this.http.post<ApiResponse<unknown>>(`${this.base}/auth/register`, payload, {
          withCredentials: true,
        }),
      ),
    );
  }

  /** Consumes the single-use token of a verification link. */
  verifyEmail(token: string): Observable<ApiResponse<unknown>> {
    return this.http.get<ApiResponse<unknown>>(`${this.base}/auth/verify-email`, {
      params: { token },
    });
  }

  /** Requests a new verification link, invalidating the previous one. */
  resendVerificationEmail(email: string): Observable<ApiResponse<unknown>> {
    return this.getCsrfCookie().pipe(
      switchMap(() =>
        this.http.post<ApiResponse<unknown>>(
          `${this.base}/auth/resend-verification-email`,
          { email },
          { withCredentials: true },
        ),
      ),
    );
  }

  /** Requests a reset link. The answer is the same whether or not the address is known. */
  forgotPassword(email: string): Observable<ApiResponse<unknown>> {
    return this.postPublic('forgot-password', { email });
  }

  /** Requests a new reset link, invalidating the previous one. */
  resendResetPasswordEmail(email: string): Observable<ApiResponse<unknown>> {
    return this.postPublic('resend-reset-password-email', { email });
  }

  /** Checks the token of a reset link without consuming it. */
  validateResetToken(token: string): Observable<ApiResponse<unknown>> {
    return this.http.get<ApiResponse<unknown>>(`${this.base}/auth/validate-reset-token`, {
      params: { token },
    });
  }

  /** Consumes the token and sets the new password, signing the user out everywhere. */
  resetPassword(payload: ResetPasswordPayload): Observable<ApiResponse<unknown>> {
    return this.postPublic('reset-password', payload);
  }

  /** Changes the password of the signed-in user; the server then closes every session, this one included. */
  changePassword(payload: ChangePasswordPayload): Observable<ApiResponse<unknown>> {
    return this.http.put<ApiResponse<unknown>>(`${this.base}/auth/password`, payload, {
      withCredentials: true,
    });
  }

  private postPublic(path: string, body: unknown): Observable<ApiResponse<unknown>> {
    return this.getCsrfCookie().pipe(
      switchMap(() =>
        this.http.post<ApiResponse<unknown>>(`${this.base}/auth/${path}`, body, {
          withCredentials: true,
        }),
      ),
    );
  }

  /**
   * Invalidates the active Laravel Sanctum cookie session on the server.
   */
  logout(): Observable<ApiResponse<{ idp_logout_url?: string | null } | null>> {
    return this.http.post<ApiResponse<{ idp_logout_url?: string | null } | null>>(
      `${this.base}/auth/logout`,
      {},
      { withCredentials: true }
    );
  }

  /**
   * Retrieves the currently authenticated user profile from the backend session.
   * Validates whether the browser cookie session is active.
   */
  me(): Observable<ApiResponse<UserProfile>> {
    return this.http.get<ApiResponse<UserProfile>>(
      `${this.base}/auth/profile`,
      { withCredentials: true }
    );
  }

  /**
   * Alias for me() matching OpenAPI operationId `getProfile`.
   */
  getProfile(): Observable<ApiResponse<UserProfile>> {
    return this.me();
  }

  /**
   * Switches active tenant context for the authenticated user session.
   */
  switchTenant(payload: SwitchTenantPayload): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(
      `${this.base}/auth/switch-tenant`,
      payload,
      { withCredentials: true }
    );
  }

  /**
   * Refreshes the active session.
   */
  refreshToken(): Observable<ApiResponse<{ token: string }>> {
    return this.http.post<ApiResponse<{ token: string }>>(
      `${this.base}/auth/refresh`,
      {},
      { withCredentials: true }
    );
  }
}
