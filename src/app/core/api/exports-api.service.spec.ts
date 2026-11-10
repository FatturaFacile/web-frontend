import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '@env';
import { ExportsApiService } from '@core';

describe('ExportsApiService', () => {
  let service: ExportsApiService;
  let httpMock: HttpTestingController;
  const base = `${environment.apiBaseUrl}/exports`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ExportsApiService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ExportsApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('downloads the accountant archive of a period as a blob', () => {
    service.downloadAccountantArchive('2026-01-01', '2026-03-31').subscribe((blob) => expect(blob.size).toBe(3));
    const req = httpMock.expectOne((r) => r.url === `${base}/accountant-archive`);
    expect(req.request.params.get('from')).toBe('2026-01-01');
    expect(req.request.params.get('to')).toBe('2026-03-31');
    expect(req.request.responseType).toBe('blob');
    req.flush(new Blob(['zip']));
  });

  it('downloads a dataset CSV with and without a period', () => {
    service.downloadDatasetCsv('invoices', { from: '2026-01-01', to: null }).subscribe();
    const withPeriod = httpMock.expectOne((r) => r.url === `${base}/csv/invoices`);
    expect(withPeriod.request.params.get('from')).toBe('2026-01-01');
    expect(withPeriod.request.params.has('to')).toBe(false);
    withPeriod.flush(new Blob(['a;b']));

    service.downloadDatasetCsv('contacts').subscribe();
    const plain = httpMock.expectOne(`${base}/csv/contacts`);
    expect(plain.request.params.keys().length).toBe(0);
    expect(plain.request.responseType).toBe('blob');
    plain.flush(new Blob(['a']));
  });
});
