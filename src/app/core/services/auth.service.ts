import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { AuthApiService } from '../api/auth-api.service';

export interface LoginCredentials {
  email: string;
  password: string;
  remember?: boolean;
}

/**
 * Thin facade over `AuthApiService`, kept for callers of the legacy name. The cookie session logic (CSRF handshake,
 * `/auth/login`, `/auth/logout`, `/auth/profile`) lives only in `AuthApiService`, which is what the login page, the
 * auth guard and the app shell use. Tokens are never stored in localStorage, sessionStorage or IndexedDB.
 */
@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly api = inject(AuthApiService);

  login(credentials: LoginCredentials): Observable<unknown> {
    return this.api.login(credentials);
  }

  logout(): Observable<unknown> {
    return this.api.logout();
  }

  getUser(): Observable<unknown> {
    return this.api.me();
  }
}
