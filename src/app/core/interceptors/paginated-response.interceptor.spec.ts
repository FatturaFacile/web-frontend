import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { paginatedResponseInterceptor } from './paginated-response.interceptor';

describe('paginatedResponseInterceptor', () => {
  let http: HttpClient;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([paginatedResponseInterceptor])), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpClient);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('moves the items of a Laravel paginator to data and its counters to meta', () => {
    let body: unknown;
    http.get('/api/v1/crm/contacts').subscribe((b) => (body = b));

    httpTesting.expectOne('/api/v1/crm/contacts').flush({
      success: true,
      message: 'OK',
      data: { current_page: 2, data: [{ id: 'a' }], from: 26, last_page: 3, per_page: 25, to: 26, total: 51, path: 'x' },
    });

    expect(body).toEqual({
      success: true,
      message: 'OK',
      data: [{ id: 'a' }],
      meta: { current_page: 2, from: 26, last_page: 3, per_page: 25, to: 26, total: 51 },
    });
  });

  it('leaves array and single resource responses untouched', () => {
    const bodies: unknown[] = [];
    http.get('/api/v1/a').subscribe((b) => bodies.push(b));
    http.get('/api/v1/b').subscribe((b) => bodies.push(b));

    httpTesting.expectOne('/api/v1/a').flush({ success: true, data: [{ id: 1 }], meta: { total: 1 } });
    httpTesting.expectOne('/api/v1/b').flush({ success: true, data: { id: 'x', data: 'nested' } });

    expect(bodies).toEqual([
      { success: true, data: [{ id: 1 }], meta: { total: 1 } },
      { success: true, data: { id: 'x', data: 'nested' } },
    ]);
  });
});
