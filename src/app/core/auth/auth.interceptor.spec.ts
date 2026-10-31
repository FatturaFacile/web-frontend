import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { authInterceptor } from './auth.interceptor';
import { environment } from '@env';

describe('authInterceptor (Laravel Sanctum SPA Cookie-Based Authentication)', () => {
  let http: HttpClient;
  let httpTesting: HttpTestingController;
  const originalApiBaseUrl = environment.apiBaseUrl;

  beforeEach(() => {
    environment.apiBaseUrl = 'https://api.fatturafacile.eu/api/v1';

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });

    http = TestBed.inject(HttpClient);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
    environment.apiBaseUrl = originalApiBaseUrl;
    document.cookie = 'XSRF-TOKEN=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
  });

  it('should include withCredentials: true on outgoing backend requests', () => {
    http.get('https://api.fatturafacile.eu/api/v1/sales/invoices').subscribe();

    const req = httpTesting.expectOne('https://api.fatturafacile.eu/api/v1/sales/invoices');
    expect(req.request.withCredentials).toBe(true);
    expect(req.request.headers.get('X-Requested-With')).toBe('XMLHttpRequest');
    expect(req.request.headers.get('Accept')).toBe('application/json');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush([]);
  });

  it('should include withCredentials: true on relative API requests', () => {
    http.get('/api/orders').subscribe();

    const req = httpTesting.expectOne('/api/orders');
    expect(req.request.withCredentials).toBe(true);
    expect(req.request.headers.get('X-Requested-With')).toBe('XMLHttpRequest');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush([]);
  });

  it('should attach X-XSRF-TOKEN header on mutating requests (POST) when CSRF cookie exists', () => {
    document.cookie = 'XSRF-TOKEN=sanctum-csrf-secret%3D123; path=/';

    http.post('https://api.fatturafacile.eu/api/v1/auth/login', { email: 'test@example.com' }).subscribe();

    const req = httpTesting.expectOne('https://api.fatturafacile.eu/api/v1/auth/login');
    expect(req.request.withCredentials).toBe(true);
    expect(req.request.headers.get('X-XSRF-TOKEN')).toBe('sanctum-csrf-secret=123');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({ data: { message: 'ok' } });
  });

  it('should attach X-XSRF-TOKEN header on PUT, PATCH, and DELETE requests', () => {
    document.cookie = 'XSRF-TOKEN=my-csrf-token; path=/';

    http.put('/api/users/1', {}).subscribe();
    const putReq = httpTesting.expectOne('/api/users/1');
    expect(putReq.request.headers.get('X-XSRF-TOKEN')).toBe('my-csrf-token');
    putReq.flush({});

    http.delete('/api/users/1').subscribe();
    const deleteReq = httpTesting.expectOne('/api/users/1');
    expect(deleteReq.request.headers.get('X-XSRF-TOKEN')).toBe('my-csrf-token');
    deleteReq.flush({});
  });

  it('should NOT attach X-XSRF-TOKEN header on GET requests', () => {
    document.cookie = 'XSRF-TOKEN=my-csrf-token; path=/';

    http.get('/api/users').subscribe();

    const req = httpTesting.expectOne('/api/users');
    expect(req.request.headers.has('X-XSRF-TOKEN')).toBe(false);
    req.flush([]);
  });

  it('should NOT alter non-backend external requests', () => {
    http.get('https://external-cdn.com/logo.png').subscribe();

    const req = httpTesting.expectOne('https://external-cdn.com/logo.png');
    expect(req.request.withCredentials).toBe(false);
    expect(req.request.headers.has('Authorization')).toBe(false);
    expect(req.request.headers.has('X-Requested-With')).toBe(false);
    req.flush('');
  });
});
