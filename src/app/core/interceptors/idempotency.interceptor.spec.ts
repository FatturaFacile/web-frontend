import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '@env';
import { IDEMPOTENCY_HEADER, idempotencyInterceptor } from '@core/interceptors/idempotency.interceptor';
import { TEST_API_BASE_URL } from '../../../testing/api';

describe('idempotencyInterceptor', () => {
  let http: HttpClient;
  let httpTesting: HttpTestingController;
  const originalApiBaseUrl = environment.apiBaseUrl;

  beforeEach(() => {
    environment.apiBaseUrl = TEST_API_BASE_URL;
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([idempotencyInterceptor])), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpClient);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
    environment.apiBaseUrl = originalApiBaseUrl;
  });

  it('adds a fresh key to every POST of the backend API', () => {
    http.post(`${TEST_API_BASE_URL}/crm/contacts`, {}).subscribe();
    http.post(`${TEST_API_BASE_URL}/crm/contacts`, {}).subscribe();

    const [first, second] = httpTesting.match(`${TEST_API_BASE_URL}/crm/contacts`);
    expect(first.request.headers.get(IDEMPOTENCY_HEADER)).toMatch(/^[0-9a-f-]{36}$/);
    expect(second.request.headers.get(IDEMPOTENCY_HEADER)).not.toBe(first.request.headers.get(IDEMPOTENCY_HEADER));
  });

  it('keeps the key a caller already set', () => {
    http.post(`${TEST_API_BASE_URL}/crm/contacts`, {}, { headers: { [IDEMPOTENCY_HEADER]: 'own-key' } }).subscribe();

    expect(httpTesting.expectOne(`${TEST_API_BASE_URL}/crm/contacts`).request.headers.get(IDEMPOTENCY_HEADER)).toBe('own-key');
  });

  it('leaves reads, other methods and third-party hosts alone', () => {
    http.get(`${TEST_API_BASE_URL}/crm/contacts`).subscribe();
    http.put(`${TEST_API_BASE_URL}/crm/contacts/1`, {}).subscribe();
    http.post('https://third-party.example.test/hook', {}).subscribe();

    expect(httpTesting.expectOne({ method: 'GET' }).request.headers.has(IDEMPOTENCY_HEADER)).toBe(false);
    expect(httpTesting.expectOne({ method: 'PUT' }).request.headers.has(IDEMPOTENCY_HEADER)).toBe(false);
    expect(httpTesting.expectOne('https://third-party.example.test/hook').request.headers.has(IDEMPOTENCY_HEADER)).toBe(false);
  });
});
