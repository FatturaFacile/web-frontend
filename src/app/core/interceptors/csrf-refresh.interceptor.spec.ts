import { TestBed } from '@angular/core/testing';
import { HttpClient, HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { csrfRefreshInterceptor } from './csrf-refresh.interceptor';

describe('csrfRefreshInterceptor', () => {
  let http: HttpClient;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([csrfRefreshInterceptor])),
        provideHttpClientTesting(),
      ],
    });

    http = TestBed.inject(HttpClient);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('should intercept HTTP 419, fetch /sanctum/csrf-cookie from remote domain, and replay the original request', () => {
    let response: unknown = null;

    http.post('https://api.fatturafacile.eu/api/v1/invoices', { title: 'Invoice #1' }).subscribe({
      next: (res) => {
        response = res;
      },
    });

    // 1. Initial request fails with 419 CSRF Token Mismatch
    const initialReq = httpTesting.expectOne('https://api.fatturafacile.eu/api/v1/invoices');
    initialReq.flush({ message: 'CSRF token mismatch.' }, { status: 419, statusText: 'unknown status' });

    // 2. Interceptor fetches GET /sanctum/csrf-cookie
    const csrfReq = httpTesting.expectOne('https://api.fatturafacile.eu/sanctum/csrf-cookie');
    expect(csrfReq.request.method).toBe('GET');
    expect(csrfReq.request.withCredentials).toBe(true);
    csrfReq.flush('', { status: 204, statusText: 'No Content' });

    // 3. Original request is retried with credentials
    const retryReq = httpTesting.expectOne('https://api.fatturafacile.eu/api/v1/invoices');
    expect(retryReq.request.method).toBe('POST');
    expect(retryReq.request.withCredentials).toBe(true);
    expect(retryReq.request.body).toEqual({ title: 'Invoice #1' });
    retryReq.flush({ id: 101, title: 'Invoice #1' });

    expect(response).toEqual({ id: 101, title: 'Invoice #1' });
  });

  it('should resolve relative requests to https://api.fatturafacile.eu/sanctum/csrf-cookie on 419', () => {
    http.post('/api/invoices', { title: 'Invoice #2' }).subscribe();

    const initialReq = httpTesting.expectOne('/api/invoices');
    initialReq.flush({ message: 'CSRF token mismatch.' }, { status: 419, statusText: 'unknown status' });

    const csrfReq = httpTesting.expectOne('https://api.fatturafacile.eu/sanctum/csrf-cookie');
    expect(csrfReq.request.withCredentials).toBe(true);
    csrfReq.flush('', { status: 204, statusText: 'No Content' });

    const retryReq = httpTesting.expectOne('/api/invoices');
    expect(retryReq.request.withCredentials).toBe(true);
    retryReq.flush({ ok: true });
  });

  it('should not intercept non-419 errors (e.g. 401 Unauthorized)', () => {
    let capturedError: unknown = null;

    http.get('https://api.fatturafacile.eu/api/v1/user').subscribe({
      error: (err: unknown) => {
        capturedError = err;
      },
    });

    const req = httpTesting.expectOne('https://api.fatturafacile.eu/api/v1/user');
    req.flush({ message: 'Unauthenticated.' }, { status: 401, statusText: 'Unauthorized' });

    expect(capturedError).toBeInstanceOf(HttpErrorResponse);
    expect((capturedError as HttpErrorResponse).status).toBe(401);
  });

  it('should not intercept 419 on the /sanctum/csrf-cookie endpoint itself to prevent infinite loops', () => {
    let capturedError: unknown = null;

    http.get('https://api.fatturafacile.eu/sanctum/csrf-cookie').subscribe({
      error: (err: unknown) => {
        capturedError = err;
      },
    });

    const req = httpTesting.expectOne('https://api.fatturafacile.eu/sanctum/csrf-cookie');
    req.flush({ message: 'CSRF token error.' }, { status: 419, statusText: 'unknown status' });

    expect(capturedError).toBeInstanceOf(HttpErrorResponse);
    expect((capturedError as HttpErrorResponse).status).toBe(419);
  });
});
