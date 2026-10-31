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

  it('should store, retrieve, and clear bearer tokens', () => {
    expect(service.hasToken()).toBe(false);
    expect(service.getToken()).toBeNull();

    service.setToken('jwt-access-token-123');
    expect(service.hasToken()).toBe(true);
    expect(service.getToken()).toBe('jwt-access-token-123');
    expect(localStorage.getItem('ff_access_token')).toBe('jwt-access-token-123');

    service.clear();
    expect(service.hasToken()).toBe(false);
    expect(service.getToken()).toBeNull();
    expect(localStorage.getItem('ff_access_token')).toBeNull();
  });

  it('should store and retrieve refresh token and tenant id', () => {
    service.setRefreshToken('refresh-token-xyz');
    expect(service.getRefreshToken()).toBe('refresh-token-xyz');

    service.setTenantId('tenant-456');
    expect(service.getTenantId()).toBe('tenant-456');

    service.clear();
    expect(service.getRefreshToken()).toBeNull();
    expect(service.getTenantId()).toBeNull();
  });
});
