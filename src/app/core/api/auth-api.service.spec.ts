import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AuthApiService, LoginPayload } from './auth-api.service';
import { environment } from '@env';

describe('AuthApiService (Sanctum SPA Cookie Authentication)', () => {
  let service: AuthApiService;
  let httpTesting: HttpTestingController;
  const originalApiBaseUrl = environment.apiBaseUrl;

  beforeEach(() => {
    environment.apiBaseUrl = 'https://api.fatturafacile.eu/api/v1';

    TestBed.configureTestingModule({
      providers: [
        AuthApiService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
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

    const req = httpTesting.expectOne('https://api.fatturafacile.eu/sanctum/csrf-cookie');
    expect(req.request.method).toBe('GET');
    expect(req.request.withCredentials).toBe(true);
    req.flush('');
  });

  it('should execute getCsrfCookie before POST /auth/login during login()', () => {
    const payload: LoginPayload = {
      email: 'm.rossi@rossiimpianti.it',
      password: 'password123',
      remember: true,
    };

    let loginResult: unknown = null;
    service.login(payload).subscribe((res) => {
      loginResult = res;
    });

    // 1. First request must be to the Sanctum CSRF cookie endpoint
    const csrfReq = httpTesting.expectOne('https://api.fatturafacile.eu/sanctum/csrf-cookie');
    expect(csrfReq.request.method).toBe('GET');
    expect(csrfReq.request.withCredentials).toBe(true);
    csrfReq.flush('');

    // 2. Second request must be the login mutation with credentials
    const loginReq = httpTesting.expectOne('https://api.fatturafacile.eu/api/v1/auth/login');
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
          email: 'm.rossi@rossiimpianti.it',
          avatar: '',
          role: 'Admin',
          roles: ['ADMIN'],
        },
      },
    };
    loginReq.flush(mockResponse);

    expect(loginResult).toEqual(mockResponse);
  });

  it('should call POST /auth/logout with credentials on logout()', () => {
    service.logout().subscribe();

    const req = httpTesting.expectOne('https://api.fatturafacile.eu/api/v1/auth/logout');
    expect(req.request.method).toBe('POST');
    expect(req.request.withCredentials).toBe(true);
    req.flush({ success: true, message: 'Logged out', data: null });
  });

  it('should call GET /auth/profile with credentials on me()', () => {
    service.me().subscribe();

    const req = httpTesting.expectOne('https://api.fatturafacile.eu/api/v1/auth/profile');
    expect(req.request.method).toBe('GET');
    expect(req.request.withCredentials).toBe(true);
    req.flush({
      success: true,
      message: 'Profile retrieved',
      data: {
        id: 'usr-001',
        name: 'Marco Rossi',
        email: 'm.rossi@rossiimpianti.it',
        avatar: '',
        role: 'Admin',
        roles: ['ADMIN'],
      },
    });
  });

  it('should call POST /auth/switch-tenant with credentials on switchTenant()', () => {
    service.switchTenant({ tenant_id: 't-ch-02' }).subscribe();

    const req = httpTesting.expectOne('https://api.fatturafacile.eu/api/v1/auth/switch-tenant');
    expect(req.request.method).toBe('POST');
    expect(req.request.withCredentials).toBe(true);
    expect(req.request.body).toEqual({ tenant_id: 't-ch-02' });
    req.flush({ success: true, message: 'Switched', data: null });
  });
});
