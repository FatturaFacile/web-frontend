import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AuditLedgerApiService } from '@core/api/audit-ledger-api.service';
import { environment } from '@env';
import { TEST_API_BASE_URL, TEST_API_ORIGIN } from '../../../testing/api';

describe('AuditLedgerApiService', () => {
  let service: AuditLedgerApiService;
  let http: HttpTestingController;
  const originalApiBaseUrl = environment.apiBaseUrl;
  const base = `${TEST_API_ORIGIN}/api/v1/settings/audit-logs`;

  beforeEach(() => {
    environment.apiBaseUrl = TEST_API_BASE_URL;
    TestBed.configureTestingModule({
      providers: [AuditLedgerApiService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AuditLedgerApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    environment.apiBaseUrl = originalApiBaseUrl;
  });

  it('searches with the filters, the cursor and the limit, dropping the empty ones', () => {
    service.search({ category: 'security', actor: '', from: '2026-11-01' }, 'c2', 25).subscribe();

    const req = http.expectOne((r) => r.url === base);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('category')).toBe('security');
    expect(req.request.params.get('from')).toBe('2026-11-01');
    expect(req.request.params.get('cursor')).toBe('c2');
    expect(req.request.params.get('limit')).toBe('25');
    expect(req.request.params.has('actor')).toBe(false);
    req.flush({ success: true, message: '', data: [], meta: { next_cursor: null, limit: 25 } });
  });

  it('sends no cursor for the first page', () => {
    service.search({}, null).subscribe();

    const req = http.expectOne((r) => r.url === base);
    expect(req.request.params.has('cursor')).toBe(false);
    req.flush({ success: true, message: '', data: [] });
  });

  it('reads the history of a record from /audit/history', () => {
    service.history('Invoice', 'a/b').subscribe();

    const req = http.expectOne(`${TEST_API_ORIGIN}/api/v1/audit/history/Invoice/a%2Fb`);
    expect(req.request.method).toBe('GET');
    req.flush({ success: true, message: '', data: [] });
  });

  it('reads the integrity status and queues a verification with a POST', () => {
    service.integrity().subscribe();
    http.expectOne(`${base}/integrity`).flush({ success: true, message: '', data: {} });

    service.verify().subscribe();
    const req = http.expectOne(`${base}/integrity/verify`);
    expect(req.request.method).toBe('POST');
    req.flush({ success: true, message: '', data: {} }, { status: 202, statusText: 'Accepted' });
  });

  it('requests an export with the Idempotency-Key header', () => {
    service.requestExport({ from: '2026-01-01', to: '2026-06-30' }, 'key-1').subscribe();

    const req = http.expectOne(`${base}/exports`);
    expect(req.request.method).toBe('POST');
    expect(req.request.headers.get('Idempotency-Key')).toBe('key-1');
    expect(req.request.body).toEqual({ from: '2026-01-01', to: '2026-06-30' });
    req.flush({ success: true, message: '', data: {} }, { status: 202, statusText: 'Accepted' });
  });

  it('reads an export and downloads its package as a blob', () => {
    service.getExport('x1').subscribe();
    http.expectOne(`${base}/exports/x1`).flush({ success: true, message: '', data: {} });

    service.downloadExport('x1').subscribe();
    const req = http.expectOne(`${base}/exports/x1/download`);
    expect(req.request.responseType).toBe('blob');
    req.flush(new Blob(['zip']));
  });

  it('has no method that edits or deletes an entry', () => {
    const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(service));

    expect(methods.filter((m) => /update|delete|remove|patch/i.test(m))).toEqual([]);
  });
});
