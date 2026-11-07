import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable, switchMap } from 'rxjs';
import { ApiResponse } from '../models';
import { getCsrfCookieUrl } from '../auth/csrf.utils';
import type { UserProfile } from '../auth/auth.store';

export interface LoginPayload {
  email: string;
  password: string;
  tenant_id?: string | null;
  remember?: boolean;
}

export interface LoginResult {
  user?: UserProfile;
  message?: string;
  token?: string;
  access_token?: string;
  token_type?: string;
  tenant_id?: string;
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
  logout(): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(
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
