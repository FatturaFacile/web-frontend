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
  token?: string; // Kept optional for backward compatibility
}

@Service()
export class AuthApiService {
  private readonly http = inject(HttpClient);
  private readonly csrfCookieUrl = getCsrfCookieUrl();

  /**
   * Fetches the CSRF cookie from Laravel Sanctum (`GET /sanctum/csrf-cookie`).
   * This sets the `XSRF-TOKEN` cookie required for state-mutating requests (such as login).
   */
  getCsrfCookie(): Observable<unknown> {
    return this.http.get(this.csrfCookieUrl, {
      withCredentials: true,
      responseType: 'text',
    });
  }

  /**
   * Executes a cookie-based login request.
   * Ensures the CSRF cookie is obtained before dispatching the `POST /auth/login` mutation.
   */
  login(payload: LoginPayload): Observable<ApiResponse<LoginResult>> {
    return this.getCsrfCookie().pipe(
      switchMap(() =>
        this.http.post<ApiResponse<LoginResult>>(
          `${environment.apiBaseUrl}/auth/login`,
          payload,
          { withCredentials: true }
        )
      )
    );
  }

  /**
   * Invalidates the active Laravel Sanctum session on the server.
   */
  logout(): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(
      `${environment.apiBaseUrl}/auth/logout`,
      {},
      { withCredentials: true }
    );
  }

  /**
   * Retrieves the currently authenticated user profile from the backend session.
   */
  me(): Observable<ApiResponse<UserProfile>> {
    return this.http.get<ApiResponse<UserProfile>>(
      `${environment.apiBaseUrl}/auth/me`,
      { withCredentials: true }
    );
  }
}
