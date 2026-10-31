import { HttpClient } from '@angular/common/http';
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
