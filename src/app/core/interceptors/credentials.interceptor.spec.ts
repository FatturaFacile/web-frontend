import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { credentialsInterceptor } from '@core/interceptors/credentials.interceptor';

describe('credentialsInterceptor', () => {
  let http: HttpClient;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([credentialsInterceptor])),
        provideHttpClientTesting(),
      ],
    });

    http = TestBed.inject(HttpClient);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('should set withCredentials: true on outgoing GET requests to backend API', () => {
    http.get('/api/test').subscribe();

    const req = httpTesting.expectOne('/api/test');
    expect(req.request.withCredentials).toBe(true);
    req.flush({});
  });

  it('should set withCredentials: true on outgoing POST requests to backend', () => {
    http.post('/login', { email: 'user@example.com' }).subscribe();

    const req = httpTesting.expectOne('/login');
    expect(req.request.withCredentials).toBe(true);
    req.flush({});
  });

  it('should preserve other request properties and headers', () => {
    http.get('/api/resource', { headers: { 'Custom-Header': 'val' } }).subscribe();

    const req = httpTesting.expectOne('/api/resource');
    expect(req.request.withCredentials).toBe(true);
    expect(req.request.headers.get('Custom-Header')).toBe('val');
    req.flush({});
  });

  it('should NOT alter non-backend external requests', () => {
    http.get('https://external-cdn.com/logo.png').subscribe();

    const req = httpTesting.expectOne('https://external-cdn.com/logo.png');
    expect(req.request.withCredentials).toBe(false);
    req.flush('');
  });
});
