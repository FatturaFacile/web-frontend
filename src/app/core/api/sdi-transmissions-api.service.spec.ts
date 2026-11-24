import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '@env';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SDI_TRANSMISSION_STATUSES, SdiTransmissionsApiService } from './sdi-transmissions-api.service';

describe('SdiTransmissionsApiService', () => {
  let service: SdiTransmissionsApiService;
  let httpMock: HttpTestingController;
  const base = `${environment.apiBaseUrl}/sdi`;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [SdiTransmissionsApiService, provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(SdiTransmissionsApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('lists transmissions with the query as HTTP params', () => {
    service.list({ status: 'failed', search: 'INV', page: 2, per_page: 25 }).subscribe();
    const req = httpMock.expectOne((r) => r.url === `${base}/transmissions`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('status')).toBe('failed');
    expect(req.request.params.get('search')).toBe('INV');
    expect(req.request.params.get('page')).toBe('2');
    req.flush({ data: [] });
  });

  it('lists without params when no query is given', () => {
    service.list().subscribe();
    const req = httpMock.expectOne(`${base}/transmissions`);
    expect(req.request.params.keys()).toEqual([]);
    req.flush({ data: [] });
  });

  it('fetches the HTML preview of an invoice as a blob', () => {
    service.previewHtml('inv-1').subscribe();
    const req = httpMock.expectOne(`${base}/invoices/inv-1/preview-html`);
    expect(req.request.method).toBe('GET');
    expect(req.request.responseType).toBe('blob');
    req.flush(new Blob(['<html></html>']));
  });

  it('fetches the SDI notifications of an invoice', () => {
    let outbound = 0;
    service.notifications('inv-1').subscribe((res) => (outbound = res.data.outbound.length));
    const req = httpMock.expectOne(`${base}/invoices/inv-1/notifications`);
    expect(req.request.method).toBe('GET');
    req.flush({ success: true, message: '', data: { outbound: [{ id: 'o1' }], inbound: [] } });
    expect(outbound).toBe(1);
  });

  it('uploads a supplier FatturaPA as multipart with the preview flag', () => {
    const file = new File(['<xml/>'], 'IT1_1.xml', { type: 'text/xml' });
    service.importPassive(file, true).subscribe();
    const req = httpMock.expectOne(`${base}/passive/import`);
    expect(req.request.method).toBe('POST');
    const body = req.request.body as FormData;
    expect((body.get('file') as File).name).toBe('IT1_1.xml');
    expect(body.get('preview_only')).toBe('1');
    req.flush({ data: {} });
  });

  it('sends a failed invoice to SDI again through the invoice endpoint', () => {
    service.retry('inv-1').subscribe();
    const req = httpMock.expectOne(`${environment.apiBaseUrl}/sales/invoices/inv-1/send-sdi`);
    expect(req.request.method).toBe('POST');
    req.flush({ data: {} });
  });

  it('exposes every transmission status once', () => {
    expect(SDI_TRANSMISSION_STATUSES).toContain('failed');
    expect(new Set(SDI_TRANSMISSION_STATUSES).size).toBe(SDI_TRANSMISSION_STATUSES.length);
  });
});
