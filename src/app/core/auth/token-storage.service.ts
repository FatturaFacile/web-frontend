import { Service, signal } from '@angular/core';

const ACCESS_TOKEN_KEY = 'ff_access_token';
const REFRESH_TOKEN_KEY = 'ff_refresh_token';
const TENANT_ID_KEY = 'ff_active_tenant_id';

/**
 * Token and tenant storage service.
 *
 * NOTE: For Laravel Sanctum SPA cookie-based session authentication, bearer tokens
 * are NEVER stored in localStorage, sessionStorage, or IndexedDB.
 * Token operations return null / no-op to prevent client-side token storage (XSS mitigation).
 * Non-sensitive routing metadata such as tenant context is maintained.
 */
@Service()
export class TokenStorageService {
  private readonly _tenantId = signal<string | null>(this.readInitialTenantId());

  readonly token = signal<string | null>(null).asReadonly();
  readonly tenantId = this._tenantId.asReadonly();

  getToken(): string | null {
    // Cookie-first: bearer tokens are not stored or read on the client.
    return null;
  }

  hasToken(): boolean {
    return false;
  }

  setToken(_token: string): void {
    // Deliberately no-op: bearer tokens must NOT be stored in client storage.
  }

  getRefreshToken(): string | null {
    return null;
  }

  setRefreshToken(_refreshToken: string): void {
    // Deliberately no-op: refresh tokens must NOT be stored in client storage.
  }

  getTenantId(): string | null {
    return this._tenantId();
  }

  setTenantId(tenantId: string | null): void {
    this._tenantId.set(tenantId);
    if (tenantId) {
      this.safeStorageSet(TENANT_ID_KEY, tenantId);
    } else {
      this.safeStorageRemove(TENANT_ID_KEY);
    }
  }

  clear(): void {
    this._tenantId.set(null);
    this.safeStorageRemove(TENANT_ID_KEY);
    // Clean up any legacy token keys from storage
    this.safeStorageRemove(ACCESS_TOKEN_KEY);
    this.safeStorageRemove(REFRESH_TOKEN_KEY);
    this.safeStorageRemove('token');
    this.safeStorageRemove('auth_token');
  }

  private readInitialTenantId(): string | null {
    return this.safeStorageGet(TENANT_ID_KEY);
  }

  private safeStorageGet(key: string): string | null {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(key);
      }
    } catch {
      // Storage unavailable or disabled
    }
    return null;
  }

  private safeStorageSet(key: string, value: string): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
      }
    } catch {
      // Storage unavailable
    }
  }

  private safeStorageRemove(key: string): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
      }
    } catch {
      // Storage unavailable
    }
  }
}
