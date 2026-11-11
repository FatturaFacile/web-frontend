import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AuthApiService, LoginPayload } from '@core/api/auth-api.service';
import { environment } from '@env';
import { TEST_API_ORIGIN, TEST_API_BASE_URL } from '../../../testing/api';
import { TEST_PASSWORD } from '../../../testing/credentials';

describe('AuthApiService (Sanctum SPA Cookie Authentication)', () => {
  let service: AuthApiService;
  let httpTesting: HttpTestingController;
  const originalApiBaseUrl = environment.apiBaseUrl;

  beforeEach(() => {
    environment.apiBaseUrl = TEST_API_BASE_URL;

    TestBed.configureTestingModule({
      providers: [AuthApiService, provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(AuthApiService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
    environment.apiBaseUrl = originalApiBaseUrl;
  });

  it('should fetch the CSRF cookie via getCsrfCookie()', () => {
    service.getCsrfCookie().subscribe();

    const req = httpTesting.expectOne(`${TEST_API_ORIGIN}/sanctum/csrf-cookie`);
    expect(req.request.method).toBe('GET');
    expect(req.request.withCredentials).toBe(true);
    req.flush('');
  });

  it('should execute getCsrfCookie before POST /auth/login during login()', () => {
    const payload: LoginPayload = {
      email: 'm.rossi@example.com',
      password: TEST_PASSWORD,
      remember: true,
    };

    let loginResult: unknown = null;
    service.login(payload).subscribe((res) => {
      loginResult = res;
    });

    // 1. First request must be to the Sanctum CSRF cookie endpoint
    const csrfReq = httpTesting.expectOne(`${TEST_API_ORIGIN}/sanctum/csrf-cookie`);
    expect(csrfReq.request.method).toBe('GET');
    expect(csrfReq.request.withCredentials).toBe(true);
    csrfReq.flush('');

    // 2. Second request must be the login mutation with credentials
    const loginReq = httpTesting.expectOne(`${TEST_API_ORIGIN}/api/v1/auth/login`);
    expect(loginReq.request.method).toBe('POST');
    expect(loginReq.request.withCredentials).toBe(true);
    expect(loginReq.request.body).toEqual(payload);

    const mockResponse = {
      success: true,
      message: 'Authenticated',
      data: {
        user: {
          id: 'usr-001',
          name: 'Marco Rossi',
          email: 'm.rossi@example.com',
          avatar: '',
          role: 'Admin',
          roles: ['ADMIN'],
        },
      },
    };
    loginReq.flush(mockResponse);

    expect(loginResult).toEqual(mockResponse);
  });

  it('should call POST /auth/two-factor-challenge with credentials on twoFactorChallenge()', () => {
    const payload = {
      challenge_token: 'a'.repeat(64),
      code: '123456',
    };

    service.twoFactorChallenge(payload).subscribe();

    const req = httpTesting.expectOne(`${TEST_API_ORIGIN}/api/v1/auth/two-factor-challenge`);
    expect(req.request.method).toBe('POST');
    expect(req.request.withCredentials).toBe(true);
    expect(req.request.body).toEqual(payload);
    req.flush({ success: true, message: 'Authenticated successfully', data: {} });
  });

  it('should call GET /auth/two-factor with credentials on getTwoFactorStatus()', () => {
    service.getTwoFactorStatus().subscribe();

    const req = httpTesting.expectOne(`${TEST_API_ORIGIN}/api/v1/auth/two-factor`);
    expect(req.request.method).toBe('GET');
    expect(req.request.withCredentials).toBe(true);
    req.flush({
      success: true,
      message: 'Operation successful',
      data: {
        enabled: true,
        pending_setup: false,
        confirmed_at: '2026-01-01T00:00:00Z',
        remaining_recovery_codes: 8,
        required_by_tenant: false,
      },
    });
  });

  it('should call POST /auth/two-factor/enable with credentials on enableTwoFactor()', () => {
    const payload = { current_password: TEST_PASSWORD };
    service.enableTwoFactor(payload).subscribe();

    const req = httpTesting.expectOne(`${TEST_API_ORIGIN}/api/v1/auth/two-factor/enable`);
    expect(req.request.method).toBe('POST');
    expect(req.request.withCredentials).toBe(true);
    expect(req.request.body).toEqual(payload);
    req.flush({
      success: true,
      message: 'Scan the QR code',
      data: { secret: 'SECRET123', otpauth_uri: 'otpauth://totp/...' },
    });
  });

  it('should call POST /auth/two-factor/confirm with credentials on confirmTwoFactor()', () => {
    const payload = { code: '654321' };
    service.confirmTwoFactor(payload).subscribe();

    const req = httpTesting.expectOne(`${TEST_API_ORIGIN}/api/v1/auth/two-factor/confirm`);
    expect(req.request.method).toBe('POST');
    expect(req.request.withCredentials).toBe(true);
    expect(req.request.body).toEqual(payload);
    req.flush({
      success: true,
      message: 'Enabled',
      data: { recovery_codes: ['code-1', 'code-2'] },
    });
  });

  it('should call POST /auth/two-factor/recovery-codes with credentials on getTwoFactorRecoveryCodes()', () => {
    const payload = { current_password: TEST_PASSWORD };
    service.getTwoFactorRecoveryCodes(payload).subscribe();

    const req = httpTesting.expectOne(`${TEST_API_ORIGIN}/api/v1/auth/two-factor/recovery-codes`);
    expect(req.request.method).toBe('POST');
    expect(req.request.withCredentials).toBe(true);
    expect(req.request.body).toEqual(payload);
    req.flush({
      success: true,
      message: 'New recovery codes generated',
      data: { recovery_codes: ['code-a', 'code-b'] },
    });
  });

  it('should call POST /auth/two-factor/disable with credentials on disableTwoFactor()', () => {
    const payload = { current_password: TEST_PASSWORD, code: '123456' };
    service.disableTwoFactor(payload).subscribe();

    const req = httpTesting.expectOne(`${TEST_API_ORIGIN}/api/v1/auth/two-factor/disable`);
    expect(req.request.method).toBe('POST');
    expect(req.request.withCredentials).toBe(true);
    expect(req.request.body).toEqual(payload);
    req.flush({
      success: true,
      message: 'Two-factor authentication disabled.',
      data: {
        enabled: false,
        pending_setup: false,
        confirmed_at: null,
        remaining_recovery_codes: 0,
        required_by_tenant: false,
      },
    });
  });

  it('should call GET /auth/sessions with credentials on getSessions()', () => {
    service.getSessions().subscribe();

    const req = httpTesting.expectOne(`${TEST_API_ORIGIN}/api/v1/auth/sessions`);
    expect(req.request.method).toBe('GET');
    expect(req.request.withCredentials).toBe(true);
    req.flush({
      success: true,
      message: 'Operation successful',
      data: [[], []],
    });
  });

  it('should call DELETE /auth/sessions/{kind}/{id} with credentials on revokeSession()', () => {
    service.revokeSession('session', 'sess-123').subscribe();

    const req = httpTesting.expectOne(`${TEST_API_ORIGIN}/api/v1/auth/sessions/session/sess-123`);
    expect(req.request.method).toBe('DELETE');
    expect(req.request.withCredentials).toBe(true);
    req.flush({ success: true, message: 'Session revoked.', data: null });
  });

  it('should call POST /auth/sessions/revoke-others with credentials on revokeOtherSessions()', () => {
    const payload = { current_password: TEST_PASSWORD };
    service.revokeOtherSessions(payload).subscribe();

    const req = httpTesting.expectOne(`${TEST_API_ORIGIN}/api/v1/auth/sessions/revoke-others`);
    expect(req.request.method).toBe('POST');
    expect(req.request.withCredentials).toBe(true);
    expect(req.request.body).toEqual(payload);
    req.flush({
      success: true,
      message: 'All other sessions have been signed out.',
      data: { tokens: 1, sessions: 2 },
    });
  });

  it('should call POST /auth/logout with credentials on logout()', () => {
    service.logout().subscribe();

    const req = httpTesting.expectOne(`${TEST_API_ORIGIN}/api/v1/auth/logout`);
    expect(req.request.method).toBe('POST');
    expect(req.request.withCredentials).toBe(true);
    req.flush({ success: true, message: 'Logged out', data: null });
  });

  it('should call GET /auth/profile with credentials on me()', () => {
    service.me().subscribe();

    const req = httpTesting.expectOne(`${TEST_API_ORIGIN}/api/v1/auth/profile`);
    expect(req.request.method).toBe('GET');
    expect(req.request.withCredentials).toBe(true);
    req.flush({
      success: true,
      message: 'Profile retrieved',
      data: {
        id: 'usr-001',
        name: 'Marco Rossi',
        email: 'm.rossi@example.com',
        avatar: '',
        role: 'Admin',
        roles: ['ADMIN'],
      },
    });
  });

  it('should call POST /auth/switch-tenant with credentials on switchTenant()', () => {
    service.switchTenant({ tenant_id: 't-ch-02' }).subscribe();

    const req = httpTesting.expectOne(`${TEST_API_ORIGIN}/api/v1/auth/switch-tenant`);
    expect(req.request.method).toBe('POST');
    expect(req.request.withCredentials).toBe(true);
    expect(req.request.body).toEqual({ tenant_id: 't-ch-02' });
    req.flush({ success: true, message: 'Switched', data: null });
  });

  it('should request the CSRF cookie before POST /auth/register', () => {
    service.register({
      first_name: 'Giulia',
      last_name: 'Bianchi',
      email: 'giuliabianchitest@example.com',
      password: TEST_PASSWORD,
      password_confirmation: TEST_PASSWORD,
      company_name: 'Bianchi Srl',
      country: 'IT',
      tax_id: '12345678901',
      terms_accepted: true,
      privacy_accepted: true,
    }).subscribe();

    httpTesting.expectOne(`${TEST_API_ORIGIN}/sanctum/csrf-cookie`).flush('');

    const req = httpTesting.expectOne(`${TEST_API_BASE_URL}/auth/register`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body.tax_id).toBe('12345678901');
    req.flush({ success: true });
  });

  it('should send the token of the link to GET /auth/verify-email', () => {
    service.verifyEmail('abc.def').subscribe();

    const req = httpTesting.expectOne(`${TEST_API_BASE_URL}/auth/verify-email?token=abc.def`);
    expect(req.request.method).toBe('GET');
    req.flush({ success: true });
  });

  it('should request the CSRF cookie before POST /auth/resend-verification-email', () => {
    service.resendVerificationEmail('giuliabianchitest@example.com').subscribe();

    httpTesting.expectOne(`${TEST_API_ORIGIN}/sanctum/csrf-cookie`).flush('');

    const req = httpTesting.expectOne(`${TEST_API_BASE_URL}/auth/resend-verification-email`);
    expect(req.request.body).toEqual({ email: 'giuliabianchitest@example.com' });
    req.flush({ success: true });
  });

  it.each([
    ['forgotPassword', 'forgot-password'],
    ['resendResetPasswordEmail', 'resend-reset-password-email'],
  ] as const)('should request the CSRF cookie before %s', (method, path) => {
    service[method]('giuliabianchitest@example.com').subscribe();

    httpTesting.expectOne(`${TEST_API_ORIGIN}/sanctum/csrf-cookie`).flush('');

    const req = httpTesting.expectOne(`${TEST_API_BASE_URL}/auth/${path}`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ email: 'giuliabianchitest@example.com' });
    req.flush({ success: true });
  });

  it('should validate a reset token with GET /auth/validate-reset-token', () => {
    service.validateResetToken('abc.def').subscribe();

    const req = httpTesting.expectOne(`${TEST_API_BASE_URL}/auth/validate-reset-token?token=abc.def`);
    expect(req.request.method).toBe('GET');
    req.flush({ success: true });
  });

  it('should request the CSRF cookie before POST /auth/reset-password', () => {
    const payload = { token: 'abc.def', password: TEST_PASSWORD, password_confirmation: TEST_PASSWORD };
    service.resetPassword(payload).subscribe();

    httpTesting.expectOne(`${TEST_API_ORIGIN}/sanctum/csrf-cookie`).flush('');

    const req = httpTesting.expectOne(`${TEST_API_BASE_URL}/auth/reset-password`);
    expect(req.request.body).toEqual(payload);
    req.flush({ success: true });
  });

  it('should call PUT /auth/password with credentials on changePassword()', () => {
    const payload = {
      current_password: TEST_PASSWORD,
      password: `${TEST_PASSWORD}N`,
      password_confirmation: `${TEST_PASSWORD}N`,
      code: '123456',
    };
    service.changePassword(payload).subscribe();

    const req = httpTesting.expectOne(`${TEST_API_BASE_URL}/auth/password`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.withCredentials).toBe(true);
    expect(req.request.body).toEqual(payload);
    req.flush({ success: true });
  });

  it('starts an OpenID Connect sign-in and returns the authorization URL', () => {
    let url = '';
    service.startSso('oidc', 'tenant-1').subscribe((value) => (url = value));

    const req = httpTesting.expectOne(`${TEST_API_BASE_URL}/auth/sso/start`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ tenant_id: 'tenant-1' });
    req.flush({ data: { authorization_url: 'https://idp.example.com/authorize' } });
    expect(url).toBe('https://idp.example.com/authorize');
  });

  it('starts a SAML sign-in and returns the redirect URL', () => {
    let url = '';
    service.startSso('saml', 'tenant-1').subscribe((value) => (url = value));

    const req = httpTesting.expectOne(`${TEST_API_BASE_URL}/auth/saml/start`);
    req.flush({ data: { redirect_url: 'https://idp.example.com/saml' } });
    expect(url).toBe('https://idp.example.com/saml');
  });

  it('gets the CSRF cookie before exchanging the SSO code, with credentials', () => {
    service.exchangeSsoCode('c'.repeat(64)).subscribe();

    httpTesting.expectOne(`${TEST_API_ORIGIN}/sanctum/csrf-cookie`).flush('');

    const req = httpTesting.expectOne(`${TEST_API_BASE_URL}/auth/sso/exchange`);
    expect(req.request.method).toBe('POST');
    expect(req.request.withCredentials).toBe(true);
    expect(req.request.body).toEqual({ code: 'c'.repeat(64) });
    req.flush({ data: {} });
  });

  it('discovers the SSO of an email address without a tenant', () => {
    let sso: unknown;
    service.discoverSso('anna@acme.example').subscribe((v) => (sso = v));

    const req = httpTesting.expectOne(`${TEST_API_BASE_URL}/auth/sso/discover`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ email: 'anna@acme.example' });
    req.flush({ data: { sso: { available: true, protocol: 'oidc', tenant_id: 'tenant-1' } } });
    expect(sso).toEqual({ available: true, protocol: 'oidc', tenant_id: 'tenant-1' });
  });

  it('treats a missing discovery answer as unavailable', () => {
    let sso: unknown;
    service.discoverSso('anna@acme.example').subscribe((v) => (sso = v));

    httpTesting.expectOne(`${TEST_API_BASE_URL}/auth/sso/discover`).flush({ data: {} });
    expect(sso).toEqual({ available: false, protocol: null, tenant_id: null });
  });

  it('posts the OpenID Connect code and state to the callback with credentials, after the CSRF cookie', () => {
    service.completeOidcSso('abc', 'xyz').subscribe();

    httpTesting.expectOne(`${TEST_API_ORIGIN}/sanctum/csrf-cookie`).flush('');

    const req = httpTesting.expectOne(`${TEST_API_BASE_URL}/auth/sso/callback`);
    expect(req.request.withCredentials).toBe(true);
    expect(req.request.body).toEqual({ code: 'abc', state: 'xyz' });
    req.flush({ data: {} });
  });
});
