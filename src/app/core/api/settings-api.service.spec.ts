import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SettingsApiService } from '@core/api/settings-api.service';
import { environment } from '@env';
import { TEST_API_ORIGIN, TEST_API_BASE_URL } from '../../../testing/api';

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
});
