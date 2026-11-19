import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '@env';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FPA_STATUSES, FpaDocumentsApiService } from './fpa-documents-api.service';

describe('FpaDocumentsApiService', () => {
  let service: FpaDocumentsApiService;
  let httpMock: HttpTestingController;
  const base = environment.apiBaseUrl;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [FpaDocumentsApiService, provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(FpaDocumentsApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('lists envelopes with the filters as params', () => {
    service.list({ status: 'rejected', direction: 'outbound', page: 2 }).subscribe();
    const req = httpMock.expectOne((r) => r.url === `${base}/fpa-documents`);
    expect(req.request.params.get('status')).toBe('rejected');
    expect(req.request.params.get('direction')).toBe('outbound');
    expect(req.request.params.get('page')).toBe('2');
    req.flush({ data: [], meta: {} });
  });

  it('resubmits a rejected envelope', () => {
    service.resubmit('doc-1').subscribe();
    const req = httpMock.expectOne(`${base}/fpa-documents/doc-1/resubmit`);
    expect(req.request.method).toBe('POST');
    req.flush({ data: {} });
  });

  it('runs the pre-flight of an invoice', () => {
    service.preflight('inv-1').subscribe();
    const req = httpMock.expectOne(`${base}/sdi/invoices/inv-1/preflight`);
    expect(req.request.method).toBe('POST');
    req.flush({ data: { valid: true } });
  });

  it('knows the 15 envelope statuses', () => {
    expect(FPA_STATUSES).toHaveLength(15);
  });
});
