import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '@env';
import { SwissVatApiService } from './swiss-vat-api.service';

describe('SwissVatApiService', () => {
  const base = `${environment.apiBaseUrl}/swiss-vat`;
  let api: SwissVatApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(SwissVatApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('fetches and updates Swiss VAT config', () => {
    api.getConfig().subscribe();
    http.expectOne(`${base}/config`).flush({ success: true, message: '', data: {} });

    api
      .updateConfig({
        uid_mwst: 'CHE-116.281.710 MWST',
        accounting_method: 'effective',
        consideration_basis: 'agreed',
        reporting_frequency: 'quarterly',
      })
      .subscribe();
    const putReq = http.expectOne(`${base}/config`);
    expect(putReq.request.method).toBe('PUT');
    putReq.flush({ success: true, message: '', data: {} });
  });

  it('auto-detects and confirms Bezugsteuer entries', () => {
    api.detectBezugsteuer('2026-01-01', '2026-03-31').subscribe();
    const detectReq = http.expectOne(`${base}/bezugsteuer/detect`);
    expect(detectReq.request.method).toBe('POST');
    expect(detectReq.request.body).toEqual({
      period_from: '2026-01-01',
      period_to: '2026-03-31',
    });
    detectReq.flush({ success: true, message: '', data: [] });

    api.confirmBezugsteuer('b1').subscribe();
    expect(http.expectOne(`${base}/bezugsteuer/b1/confirm`).request.method).toBe('POST');
  });

  it('calculates, reconciles, validates XSD, and exports SuisseTax XML', () => {
    api.calculateReturn({ fiscal_year: 2026, period_type: 'quarterly', period_number: 1 }).subscribe();
    http.expectOne(`${base}/returns/calculate`).flush({ success: true, message: '', data: { id: 'r1' } });

    api.getReconciliation('r1').subscribe();
    http.expectOne(`${base}/returns/r1/reconciliation`).flush({ success: true, message: '', data: {} });

    api.validateReturnXml('r1').subscribe();
    http.expectOne(`${base}/returns/r1/validate`).flush({ success: true, message: '', data: { valid: true } });

    api.exportReturnXml('r1').subscribe();
    http.expectOne(`${base}/returns/r1/export-xml`).flush({ success: true, message: '', data: { id: 'e1' } });

    api.downloadExportXml('e1').subscribe();
    const dl = http.expectOne(`${base}/exports/e1/download`);
    expect(dl.request.responseType).toBe('blob');
    dl.flush(new Blob(['<vatDeclaration/>'], { type: 'application/xml' }));
  });
});
