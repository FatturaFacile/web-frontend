import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '@env';
import { normalizeListResponse, ResourceApiService, unwrapResponse } from './resource-api.service';

describe('normalizeListResponse', () => {
  it('reads a bare array', () => {
    expect(normalizeListResponse([{ id: '1' }])).toEqual({ rows: [{ id: '1' }], total: null, raw: [{ id: '1' }] });
  });

  it('reads a resource collection with meta.total', () => {
    const result = normalizeListResponse({ data: [{ id: '1' }], meta: { total: 7 } });
    expect(result.rows).toHaveLength(1);
    expect(result.total).toBe(7);
  });

  it('reads a Laravel paginator wrapped in the envelope', () => {
    const result = normalizeListResponse({ success: true, data: { data: [{ id: '1' }, { id: '2' }], total: 2 } });
    expect(result.rows).toHaveLength(2);
    expect(result.total).toBe(2);
  });

  it('returns no rows for an unknown shape', () => {
    expect(normalizeListResponse({ data: 'x' }).rows).toEqual([]);
    expect(normalizeListResponse(null).rows).toEqual([]);
  });

  it('unwraps the data envelope only when present', () => {
    expect(unwrapResponse({ data: { id: '1' } })).toEqual({ id: '1' });
    expect(unwrapResponse({ id: '1' })).toEqual({ id: '1' });
  });
});

describe('ResourceApiService', () => {
  let service: ResourceApiService;
  let httpMock: HttpTestingController;
  const base = environment.apiBaseUrl;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ResourceApiService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ResourceApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('lists with query params and maps the rows', () => {
    let rows = 0;
    service.list('/inventory/waves', { status: 'open', page: 2, empty: '' }).subscribe((r) => (rows = r.rows.length));
    const req = httpMock.expectOne((r) => r.url === `${base}/inventory/waves`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('status')).toBe('open');
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.has('empty')).toBe(false);
    req.flush({ data: [{ id: 'w1' }] });
    expect(rows).toBe(1);
  });

  it('sends a body and unwraps the data envelope', () => {
    let out: unknown;
    service.request('POST', '/inventory/waves', { warehouse_id: 'w' }).subscribe((r) => (out = r));
    const req = httpMock.expectOne(`${base}/inventory/waves`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ warehouse_id: 'w' });
    req.flush({ data: { id: 'w1' } });
    expect(out).toEqual({ id: 'w1' });
  });

  it('sends a body that carries a file as multipart form data', () => {
    const file = new File(['a,b'], 'soci.csv', { type: 'text/csv' });
    service.request('POST', '/associations/registry-imports', { file, tags: ['x', 'y'], flag: true }).subscribe();
    const req = httpMock.expectOne(`${base}/associations/registry-imports`);
    const data = req.request.body as FormData;
    expect(data).toBeInstanceOf(FormData);
    expect((data.get('file') as File).name).toBe('soci.csv');
    expect(data.getAll('tags[]')).toEqual(['x', 'y']);
    expect(data.get('flag')).toBe('1');
    req.flush({ data: { id: 'i1' } });
  });

  it('supports PATCH, PUT and DELETE verbs', () => {
    for (const method of ['PATCH', 'PUT', 'DELETE'] as const) {
      service.request(method, '/inventory/bins/1', method === 'DELETE' ? undefined : { is_locked: true }).subscribe();
      const req = httpMock.expectOne(`${base}/inventory/bins/1`);
      expect(req.request.method).toBe(method);
      req.flush({});
    }
  });

  it('downloads a blob', () => {
    let size = 0;
    service.blob('GET', '/inventory/shipments/1/label').subscribe((b) => (size = b.size));
    const req = httpMock.expectOne(`${base}/inventory/shipments/1/label`);
    expect(req.request.responseType).toBe('blob');
    req.flush(new Blob(['pdf']));
    expect(size).toBe(3);
  });
});
