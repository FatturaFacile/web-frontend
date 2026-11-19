import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '@env';
import { AuditTrailApiService } from '@core';
import { diffAuditValues } from './audit-diff';
import { eventColor, formatMicroTimestamp, isSecurityEvent, shortHash } from './audit-presentation';

describe('diffAuditValues', () => {
  it('marks added, removed, modified and unchanged fields in alphabetical order', () => {
    const rows = diffAuditValues(
      { status: 'unpaid', iban: 'CH93 **** **** 2957', gone: 1, same: 'x' },
      { status: 'paid', iban: 'CH93 **** **** 2957', fresh: { a: 1 }, same: 'x' },
    );

    expect(rows.map((row) => [row.field, row.kind])).toEqual([
      ['fresh', 'added'],
      ['gone', 'removed'],
      ['iban', 'unchanged'],
      ['same', 'unchanged'],
      ['status', 'modified'],
    ]);
    expect(rows.find((row) => row.field === 'fresh')?.after).toBe('{"a":1}');
    expect(rows.find((row) => row.field === 'status')).toMatchObject({
      before: 'unpaid',
      after: 'paid',
    });
  });

  it('handles records without values', () => {
    expect(diffAuditValues(null, null)).toEqual([]);
    expect(diffAuditValues(null, { a: 1 })).toEqual([
      { field: 'a', before: null, after: '1', kind: 'added' },
    ]);
  });
});

describe('audit presentation', () => {
  it('groups authentication, permission and upkeep events as security', () => {
    expect(isSecurityEvent('LOGIN_FAILED')).toBe(true);
    expect(isSecurityEvent('PERMISSION_CHANGED')).toBe(true);
    expect(isSecurityEvent('UPDATED')).toBe(false);
  });

  it('colors events and keeps the microseconds of a timestamp', () => {
    expect(eventColor('CREATED')).toBe('green');
    expect(eventColor('DELETED')).toBe('red');
    expect(formatMicroTimestamp('2027-12-11T09:30:12.123456Z')).toBe('2027-12-11 09:30:12.123456');
  });

  it('shortens a hash for table cells only when it is long', () => {
    const hash = 'a'.repeat(32) + 'b'.repeat(32);
    expect(shortHash(hash)).toBe('aaaaaaaa…bbbbbbbb');
    expect(shortHash('abc')).toBe('abc');
    expect(shortHash(null)).toBe('');
  });
});

describe('AuditTrailApiService', () => {
  let service: AuditTrailApiService;
  let http: HttpTestingController;
  const base = `${environment.apiBaseUrl}/audit-logs`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [AuditTrailApiService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AuditTrailApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lists with filters, event types as an array and paging', () => {
    service
      .list({ event_type: ['CREATED', 'UPDATED'], auditable_type: 'Invoice', actor_id: '' }, 2, 25)
      .subscribe();

    const request = http.expectOne((req) => req.url === base);
    expect(request.request.method).toBe('GET');
    expect(request.request.params.getAll('event_type[]')).toEqual(['CREATED', 'UPDATED']);
    expect(request.request.params.get('auditable_type')).toBe('Invoice');
    expect(request.request.params.has('actor_id')).toBe(false);
    expect(request.request.params.get('page')).toBe('2');
    expect(request.request.params.get('per_page')).toBe('25');
    request.flush({ success: true, message: '', data: [], meta: {} });
  });

  it('reads one record and the timeline of an entity', () => {
    service.get('abc').subscribe();
    http.expectOne(`${base}/abc`).flush({ success: true, message: '', data: {} });

    service.entityTimeline('Invoice', 'i 1').subscribe();
    http.expectOne(`${base}/entity/Invoice/i%201`).flush({ success: true, message: '', data: [] });
  });

  it('verifies the chain and manages the WORM archive without any edit or delete call', () => {
    service.verifyIntegrity().subscribe();
    const verify = http.expectOne(`${base}/verify-integrity`);
    expect(verify.request.method).toBe('POST');
    verify.flush({ success: true, message: '', data: {} });

    service.wormBatches().subscribe();
    http.expectOne(`${base}/worm-batches`).flush({ success: true, message: '', data: [] });

    service.sealWormBatches().subscribe();
    const seal = http.expectOne(`${base}/worm-batches/seal`);
    expect(seal.request.method).toBe('POST');
    seal.flush({ success: true, message: '', data: [] });
  });

  it('exports the forensic bundle with its digest and signature', () => {
    let result: { filename: string; sha256: string | null; signature: string | null } | undefined;
    service.exportBundle({ auditable_type: 'Invoice' }).subscribe((bundle) => (result = bundle));

    const request = http.expectOne((req) => req.url === `${base}/export`);
    expect(request.request.responseType).toBe('blob');
    request.flush(new Blob(['{}\n']), {
      headers: {
        'Content-Disposition': 'attachment; filename="audit-bundle-1.jsonl"',
        'X-Audit-Bundle-SHA256': 'abc',
        'X-Audit-Bundle-Signature': 'def',
      },
    });

    expect(result).toMatchObject({
      filename: 'audit-bundle-1.jsonl',
      sha256: 'abc',
      signature: 'def',
    });
  });
});
