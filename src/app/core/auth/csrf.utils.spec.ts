import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getXsrfCookie, getSanctumBaseUrl, getCsrfCookieUrl, isBackendApiRequest } from './csrf.utils';
import { environment } from '@env';

describe('CSRF and Sanctum Utilities', () => {
  const originalCookie = document.cookie;
  const originalApiBaseUrl = environment.apiBaseUrl;

  beforeEach(() => {
    document.cookie = 'XSRF-TOKEN=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    document.cookie = 'other_cookie=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    document.cookie = 'session_id=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    document.cookie = 'theme=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
  });

  afterEach(() => {
    document.cookie = originalCookie;
    environment.apiBaseUrl = originalApiBaseUrl;
  });

  describe('getXsrfCookie', () => {
    it('should return null when cookie is not present', () => {
      document.cookie = 'other_cookie=xyz; path=/';
      expect(getXsrfCookie('XSRF-TOKEN')).toBeNull();
    });

    it('should read and URL-decode XSRF-TOKEN cookie', () => {
      document.cookie = 'XSRF-TOKEN=test%3Dtoken%2B123; path=/';
      expect(getXsrfCookie('XSRF-TOKEN')).toBe('test=token+123');
    });

    it('should extract correct cookie among multiple cookies', () => {
      document.cookie = 'session_id=abc; path=/';
      document.cookie = 'XSRF-TOKEN=csrf_secret_999; path=/';
      document.cookie = 'theme=dark; path=/';
      expect(getXsrfCookie('XSRF-TOKEN')).toBe('csrf_secret_999');
    });
  });

  describe('getSanctumBaseUrl', () => {
    it('should extract the origin from an absolute apiBaseUrl', () => {
      environment.apiBaseUrl = 'https://api.fatturafacile.eu/api/v1';
      expect(getSanctumBaseUrl()).toBe('https://api.fatturafacile.eu');
    });

    it('should return empty string for relative apiBaseUrl', () => {
      environment.apiBaseUrl = '/api';
      expect(getSanctumBaseUrl()).toBe('');
    });
  });

  describe('getCsrfCookieUrl', () => {
    it('should return full URL to /sanctum/csrf-cookie for absolute base URL', () => {
      environment.apiBaseUrl = 'https://api.fatturafacile.eu/api/v1';
      expect(getCsrfCookieUrl()).toBe('https://api.fatturafacile.eu/sanctum/csrf-cookie');
    });

    it('should return relative /sanctum/csrf-cookie for relative base URL', () => {
      environment.apiBaseUrl = '/api';
      expect(getCsrfCookieUrl()).toBe('/sanctum/csrf-cookie');
    });
  });

  describe('isBackendApiRequest', () => {
    it('should return false for frontend assets', () => {
      expect(isBackendApiRequest('/assets/i18n/it.json')).toBe(false);
      expect(isBackendApiRequest('/assets/mock-data/crm-clients.json')).toBe(false);
    });

    it('should return true for relative API routes', () => {
      expect(isBackendApiRequest('/api/crm/clients')).toBe(true);
      expect(isBackendApiRequest('/sanctum/csrf-cookie')).toBe(true);
    });

    it('should return true for configured apiBaseUrl routes', () => {
      environment.apiBaseUrl = 'https://api.fatturafacile.eu/api/v1';
      expect(isBackendApiRequest('https://api.fatturafacile.eu/api/v1/auth/login')).toBe(true);
      expect(isBackendApiRequest('https://api.fatturafacile.eu/sanctum/csrf-cookie')).toBe(true);
    });

    it('should return false for third-party external URLs', () => {
      expect(isBackendApiRequest('https://images.unsplash.com/photo-123')).toBe(false);
    });
  });
});
