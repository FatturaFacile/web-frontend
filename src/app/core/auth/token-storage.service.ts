import { Service, signal } from '@angular/core';

const TENANT_ID_KEY = 'ff_active_tenant_id';

/** Keys under which an older version of the app stored a bearer token: they are only ever removed. */
const LEGACY_TOKEN_KEYS = ['ff_access_token', 'ff_refresh_token', 'access_token', 'token', 'auth_token'] as const;

/**
 * Removes the bearer tokens that older versions of the app left in the browser storage.
 * The app authenticates only through the HttpOnly session cookie, so nothing here is ever read back.
 */
export function purgeLegacyTokenKeys(): void {
  for (const storage of [safeStorage('localStorage'), safeStorage('sessionStorage')]) {
    for (const key of LEGACY_TOKEN_KEYS) {
      try {
        storage?.removeItem(key);
      } catch {
        // Storage unavailable
      }
    }
  }
}

function safeStorage(kind: 'localStorage' | 'sessionStorage'): Storage | null {
  try {
    return typeof window !== 'undefined' ? window[kind] : null;
  } catch {
    return null;
  }
}

/**
 * Tenant context storage.
 *
 * Authentication is cookie-only: the session lives in an HttpOnly cookie that the browser sends by itself,
 * so no access or refresh token is ever stored, read or sent from here. Only the non-sensitive tenant
 * context used for routing (`X-Tenant-Id`) is kept.
 */
@Service()
export class TokenStorageService {
  private readonly _tenantId = signal<string | null>(this.readInitialTenantId());

  readonly tenantId = this._tenantId.asReadonly();

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
    purgeLegacyTokenKeys();
  }

  private readInitialTenantId(): string | null {
    return this.safeStorageGet(TENANT_ID_KEY);
  }

  private safeStorageGet(key: string): string | null {
    try {
      return safeStorage('localStorage')?.getItem(key) ?? null;
    } catch {
      return null;
    }
  }

  private safeStorageSet(key: string, value: string): void {
    try {
      safeStorage('localStorage')?.setItem(key, value);
    } catch {
      // Storage unavailable
    }
  }

  private safeStorageRemove(key: string): void {
    try {
      safeStorage('localStorage')?.removeItem(key);
    } catch {
      // Storage unavailable
    }
  }
}
