import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TokenStorageService } from './token-storage.service';

describe('TokenStorageService', () => {
  let service: TokenStorageService;

  beforeEach(() => {
    localStorage.clear();
    service = new TokenStorageService();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should NOT store bearer tokens in storage (cookie-first Sanctum auth)', () => {
    expect(service.hasToken()).toBe(false);
    expect(service.getToken()).toBeNull();

    service.setToken('jwt-access-token-123');
    expect(service.hasToken()).toBe(false);
    expect(service.getToken()).toBeNull();
    expect(localStorage.getItem('ff_access_token')).toBeNull();

    service.setRefreshToken('refresh-token-xyz');
    expect(service.getRefreshToken()).toBeNull();
    expect(localStorage.getItem('ff_refresh_token')).toBeNull();
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
});
