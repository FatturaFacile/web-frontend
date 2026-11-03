import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, switchMap } from 'rxjs';
import { getSanctumBaseUrl } from '@core/auth/csrf.utils';

export interface LoginCredentials {
  email: string;
  password: string;
  remember?: boolean;
}

/**
 * Service for session-based authentication with Laravel Sanctum.
 *
 * Enforces pure cookie-based SPA authentication:
 * - Handshakes with `/sanctum/csrf-cookie` to establish the CSRF token and session cookies.
 * - Authenticates via `/login` using `withCredentials: true`.
 * - Tokens are NEVER stored in localStorage, sessionStorage, or IndexedDB.
 */
@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = getSanctumBaseUrl();

  login(credentials: LoginCredentials): Observable<unknown> {
    return this.http
      .get(`${this.baseUrl}/sanctum/csrf-cookie`, { withCredentials: true })
      .pipe(
        switchMap(() =>
          this.http.post(`${this.baseUrl}/login`, credentials, { withCredentials: true }),
        ),
      );
  }

  logout(): Observable<unknown> {
    return this.http.post(`${this.baseUrl}/logout`, {}, { withCredentials: true });
  }

  getUser(): Observable<unknown> {
    return this.http.get(`${this.baseUrl}/api/user`, { withCredentials: true });
  }
}
