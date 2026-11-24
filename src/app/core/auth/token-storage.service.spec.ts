import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { purgeLegacyTokenKeys, TokenStorageService } from '@core/auth/token-storage.service';

describe('TokenStorageService', () => {
  let service: TokenStorageService;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    service = new TokenStorageService();
  });

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('has no token API at all: the session lives only in the HttpOnly cookie', () => {
    const api = service as unknown as Record<string, unknown>;

    for (const name of ['token', 'getToken', 'hasToken', 'setToken', 'getRefreshToken', 'setRefreshToken']) {
      expect(api[name]).toBeUndefined();
    }
  });

  it('should store and retrieve tenant id and clear legacy keys on clear()', () => {
    service.setTenantId('tenant-456');
    expect(service.getTenantId()).toBe('tenant-456');
    expect(localStorage.getItem('ff_active_tenant_id')).toBe('tenant-456');

    // Simulate presence of legacy tokens
    localStorage.setItem('ff_access_token', 'old-token');
    localStorage.setItem('token', 'old-token');

    service.clear();
    expect(service.getTenantId()).toBeNull();
    expect(localStorage.getItem('ff_active_tenant_id')).toBeNull();
    expect(localStorage.getItem('ff_access_token')).toBeNull();
    expect(localStorage.getItem('token')).toBeNull();
  });

  it('removes the legacy token keys from local and session storage and keeps everything else', () => {
    for (const key of ['ff_access_token', 'ff_refresh_token', 'access_token', 'token', 'auth_token']) {
      localStorage.setItem(key, 'old');
      sessionStorage.setItem(key, 'old');
    }
    localStorage.setItem('lang', 'it');

    purgeLegacyTokenKeys();

    expect(localStorage.length).toBe(1);
    expect(localStorage.getItem('lang')).toBe('it');
    expect(sessionStorage.length).toBe(0);
  });
});
