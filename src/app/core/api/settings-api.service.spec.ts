import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SettingsApiService } from '@core/api/settings-api.service';
import { environment } from '@env';
import { TEST_API_BASE_URL, TEST_API_ORIGIN } from '../../../testing/api';

describe('SettingsApiService', () => {
  let service: SettingsApiService;
  let httpTesting: HttpTestingController;
  const originalApiBaseUrl = environment.apiBaseUrl;

  beforeEach(() => {
    environment.apiBaseUrl = TEST_API_BASE_URL;

    TestBed.configureTestingModule({
      providers: [SettingsApiService, provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(SettingsApiService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
    environment.apiBaseUrl = originalApiBaseUrl;
  });

  it('should fetch two-factor policy via getTwoFactorPolicy()', () => {
    service.getTwoFactorPolicy().subscribe();

    const req = httpTesting.expectOne(`${TEST_API_ORIGIN}/api/v1/settings/security/two-factor`);
    expect(req.request.method).toBe('GET');
    req.flush({
      success: true,
      message: 'Operation successful',
      data: {
        require_two_factor: true,
        members: [
          {
            id: 'usr-1',
            name: 'Marco Rossi',
            email: 'm.rossi@example.com',
            role: 'owner',
            two_factor_enabled: true,
          },
        ],
      },
    });
  });

  it('should update two-factor policy via updateTwoFactorPolicy()', () => {
    service.updateTwoFactorPolicy({ require_two_factor: true }).subscribe();

    const req = httpTesting.expectOne(`${TEST_API_ORIGIN}/api/v1/settings/security/two-factor`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ require_two_factor: true });
    req.flush({
      success: true,
      message: 'Two-factor authentication policy updated.',
      data: {
        require_two_factor: true,
        members: [],
      },
    });
  });

  it('should reset user two-factor via resetUserTwoFactor()', () => {
    service.resetUserTwoFactor('usr-123').subscribe();

    const req = httpTesting.expectOne(`${TEST_API_ORIGIN}/api/v1/settings/users/usr-123/two-factor/reset`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});
    req.flush({
      success: true,
      message: "The user's two-factor authentication has been reset.",
      data: {
        user_id: 'usr-123',
        two_factor_enabled: false,
      },
    });
  });

  it('should get tenant settings via getTenantSettings()', () => {
    service.getTenantSettings().subscribe();

    const req = httpTesting.expectOne(`${TEST_API_ORIGIN}/api/v1/settings/tenant`);
    expect(req.request.method).toBe('GET');
    req.flush({
      success: true,
      data: { id: 't-1', name: 'Test Tenant', default_currency: 'EUR' },
    });
  });

  it('should update tenant settings via updateTenantSettings()', () => {
    service.updateTenantSettings({ name: 'Updated Tenant' }).subscribe();

    const req = httpTesting.expectOne(`${TEST_API_ORIGIN}/api/v1/settings/tenant`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ name: 'Updated Tenant' });
    req.flush({
      success: true,
      data: { id: 't-1', name: 'Updated Tenant' },
    });
  });

  it('should get branches via getBranches()', () => {
    service.getBranches().subscribe();

    const req = httpTesting.expectOne(`${TEST_API_ORIGIN}/api/v1/settings/branches`);
    expect(req.request.method).toBe('GET');
    req.flush({
      success: true,
      data: [{ id: 'b-1', name: 'Sede Principale', is_headquarters: true }],
    });
  });

  it('should sync exchange rates via syncExchangeRates()', () => {
    service.syncExchangeRates().subscribe();

    const req = httpTesting.expectOne(`${TEST_API_ORIGIN}/api/v1/settings/exchange-rates/sync`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});
    req.flush({
      success: true,
      data: { synced_count: 5 },
    });
  });

  it('should get tenant users via getTenantUsers()', () => {
    service.getTenantUsers().subscribe();

    const req = httpTesting.expectOne(`${TEST_API_ORIGIN}/api/v1/settings/users`);
    expect(req.request.method).toBe('GET');
    req.flush({
      success: true,
      data: [{ id: 'u-1', name: 'User 1', email: 'u1@test.com', role: 'admin', is_active: true }],
    });
  });

  it('should get system roles via getSystemRoles()', () => {
    service.getSystemRoles().subscribe();

    const req = httpTesting.expectOne(`${TEST_API_ORIGIN}/api/v1/settings/roles`);
    expect(req.request.method).toBe('GET');
    req.flush({
      success: true,
      data: [{ key: 'admin', name: 'Tenant Administrator', description: 'Admin' }],
    });
  });

  it('should get audit logs via getAuditLogs()', () => {
    service.getAuditLogs().subscribe();

    const req = httpTesting.expectOne(`${TEST_API_ORIGIN}/api/v1/settings/audit-logs`);
    expect(req.request.method).toBe('GET');
    req.flush({
      success: true,
      data: [{ id: 'log-1', event: 'login', created_at: '2026-11-08' }],
    });
  });

  it('should get preferences via getTenantPreferences()', () => {
    service.getTenantPreferences().subscribe();

    const req = httpTesting.expectOne(`${TEST_API_ORIGIN}/api/v1/settings/preferences`);
    expect(req.request.method).toBe('GET');
    req.flush({
      success: true,
      data: { date_format: 'YYYY-MM-DD', language: 'it' },
    });
  });

  it('should update preferences via updateTenantPreferences()', () => {
    service.updateTenantPreferences('general', { theme: 'dark' }).subscribe();

    const req = httpTesting.expectOne(`${TEST_API_ORIGIN}/api/v1/settings/preferences/general`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ theme: 'dark' });
    req.flush({
      success: true,
      data: { theme: 'dark' },
    });
  });
});
