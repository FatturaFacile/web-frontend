import { Service, signal } from '@angular/core';

const ACCESS_TOKEN_KEY = 'ff_access_token';
const REFRESH_TOKEN_KEY = 'ff_refresh_token';
const TENANT_ID_KEY = 'ff_active_tenant_id';

@Service()
export class TokenStorageService {
  private readonly _token = signal<string | null>(this.readInitialToken());
  private readonly _tenantId = signal<string | null>(this.readInitialTenantId());

  readonly token = this._token.asReadonly();
  readonly tenantId = this._tenantId.asReadonly();

  getToken(): string | null {
    return this._token();
  }

  hasToken(): boolean {
    return !!this._token();
  }

  setToken(token: string): void {
    this._token.set(token);
    this.safeStorageSet(ACCESS_TOKEN_KEY, token);
  }

  getRefreshToken(): string | null {
    return this.safeStorageGet(REFRESH_TOKEN_KEY);
  }

  setRefreshToken(refreshToken: string): void {
    this.safeStorageSet(REFRESH_TOKEN_KEY, refreshToken);
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
    this._token.set(null);
    this._tenantId.set(null);
    this.safeStorageRemove(ACCESS_TOKEN_KEY);
    this.safeStorageRemove(REFRESH_TOKEN_KEY);
    this.safeStorageRemove(TENANT_ID_KEY);
  }

  private readInitialToken(): string | null {
    return this.safeStorageGet(ACCESS_TOKEN_KEY);
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
