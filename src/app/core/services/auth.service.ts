import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, switchMap } from 'rxjs';
import { environment } from '@env';

export interface LoginCredentials {
  email: string;
  password: string;
  remember?: boolean;
}

function resolveBaseUrl(): string {
  const env = environment as Record<string, unknown>;
  const custom =
    (env['baseUrl'] as string | undefined) ?? (env['backendUrl'] as string | undefined);
  if (custom) {
    return custom.replace(/\/$/, '');
  }
  const apiBase =
    (env['apiBaseUrl'] as string | undefined) ?? (env['apiUrl'] as string | undefined);
  if (apiBase?.startsWith('http://') || apiBase?.startsWith('https://')) {
    try {
      return new URL(apiBase).origin;
    } catch {
      // Fallback
    }
  }
  return 'https://dev-api.fatturafacile.eu';
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = resolveBaseUrl();

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
