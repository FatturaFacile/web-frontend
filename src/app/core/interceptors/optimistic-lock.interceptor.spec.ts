import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '@env';
import { EntityTagStore, optimisticLockInterceptor, recordKey } from '@core/interceptors/optimistic-lock.interceptor';
import { TEST_API_BASE_URL } from '../../../testing/api';

describe('optimisticLockInterceptor', () => {
  const url = `${TEST_API_BASE_URL}/crm/contacts/1`;
  let http: HttpClient;
  let httpTesting: HttpTestingController;
  const originalApiBaseUrl = environment.apiBaseUrl;

  beforeEach(() => {
    environment.apiBaseUrl = TEST_API_BASE_URL;
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([optimisticLockInterceptor])), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpClient);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
    environment.apiBaseUrl = originalApiBaseUrl;
  });

  it('sends the ETag read with a GET as If-Match on the next PUT of the record', () => {
    http.get(url).subscribe();
    httpTesting.expectOne(url).flush({}, { headers: { ETag: 'W/"abc"' } });

    http.put(url, {}).subscribe();
    const put = httpTesting.expectOne({ method: 'PUT', url });
    expect(put.request.headers.get('If-Match')).toBe('W/"abc"');
    put.flush({}, { headers: { ETag: 'W/"def"' } });

    http.patch(url, {}).subscribe();
    expect(httpTesting.expectOne({ method: 'PATCH', url }).request.headers.get('If-Match')).toBe('W/"def"');
  });

  it('sends no If-Match for a record that was never read, and ignores the query string', () => {
    http.put(url, {}).subscribe();
    expect(httpTesting.expectOne({ method: 'PUT', url }).request.headers.has('If-Match')).toBe(false);

    http.get(`${url}?include=lines`).subscribe();
    httpTesting.expectOne(`${url}?include=lines`).flush({}, { headers: { ETag: 'W/"q"' } });
    expect(TestBed.inject(EntityTagStore).get(url)).toBe('W/"q"');
    expect(recordKey(`${url}?a=1#x`)).toBe(url);
  });

  it('drops the stored tag after a 412 so the next read fetches the current one', () => {
    http.get(url).subscribe();
    httpTesting.expectOne(url).flush({}, { headers: { ETag: 'W/"old"' } });

    http.put(url, {}).subscribe({ error: () => undefined });
    httpTesting.expectOne({ method: 'PUT', url }).flush({}, { status: 412, statusText: 'Precondition Failed' });

    expect(TestBed.inject(EntityTagStore).get(url)).toBeUndefined();
  });

  it('forgets the tag of a record when an action on it succeeds', () => {
    http.get(url).subscribe();
    httpTesting.expectOne(url).flush({}, { headers: { ETag: 'W/"old"' } });

    http.post(`${url}/archive`, {}).subscribe();
    httpTesting.expectOne({ method: 'POST', url: `${url}/archive` }).flush({});

    expect(TestBed.inject(EntityTagStore).get(url)).toBeUndefined();
  });
});
