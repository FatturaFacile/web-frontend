import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { environment } from '@env';
import { FieldServiceApiService } from './field-service-api.service';

describe('FieldServiceApiService', () => {
  let service: FieldServiceApiService;
  let httpTesting: HttpTestingController;
  const base = `${environment.apiBaseUrl}/field-service`;
  const reports = `${environment.apiBaseUrl}/service-reports`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [FieldServiceApiService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(FieldServiceApiService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  const payload = {
    client_id: 'c1',
    date: '2026-01-02T08:00:00+01:00',
    lines: [{ description: 'Labour', quantity: 2, unit_price: 50, tax_rate: 22 }],
  };

  it('lists work orders with paging', () => {
    service.getWorkOrders({ page: 2, per_page: 10 }).subscribe((res) => expect(res.data.total).toBe(1));
    const req = httpTesting.expectOne(
      (r) => r.url === `${base}/work-orders` && r.params.get('page') === '2' && r.params.get('per_page') === '10',
    );
    expect(req.request.method).toBe('GET');
    req.flush({ success: true, message: '', data: { current_page: 2, data: [], last_page: 2, per_page: 10, total: 1 } });
  });

  it('creates, reads and updates a work order', () => {
    service.createWorkOrder(payload).subscribe();
    const create = httpTesting.expectOne(`${base}/work-orders`);
    expect(create.request.method).toBe('POST');
    expect(create.request.body).toEqual(payload);
    create.flush({ data: { id: 'w1' } });

    service.getWorkOrder('w1').subscribe();
    const show = httpTesting.expectOne(`${base}/work-orders/w1`);
    expect(show.request.method).toBe('GET');
    show.flush({ data: { id: 'w1' } });

    service.updateWorkOrder('w1', payload).subscribe();
    const update = httpTesting.expectOne(`${base}/work-orders/w1`);
    expect(update.request.method).toBe('PUT');
    expect(update.request.body).toEqual(payload);
    update.flush({ data: { id: 'w1' } });
  });

  it('completes, signs and invoices a work order', () => {
    service.completeWorkOrder('w1').subscribe();
    const complete = httpTesting.expectOne(`${base}/work-orders/w1/complete`);
    expect(complete.request.method).toBe('POST');
    complete.flush({ data: { id: 'w1' } });

    service.signWorkOrder('w1', { signed_by: 'Rossi', signature_base64: 'data' }).subscribe();
    const sign = httpTesting.expectOne(`${base}/work-orders/w1/signature`);
    expect(sign.request.body).toEqual({ signed_by: 'Rossi', signature_base64: 'data' });
    sign.flush({ data: { id: 'w1' } });

    service.invoiceWorkOrder('w1').subscribe((res) => expect(res.data.invoice_number).toBe('F1'));
    const invoice = httpTesting.expectOne(`${base}/work-orders/w1/invoice`);
    expect(invoice.request.method).toBe('POST');
    invoice.flush({ data: { id: 'i1', invoice_number: 'F1' } });
  });

  it('lists service reports with filters', () => {
    service.getServiceReports({ status: 'signed', from_date: '2026-01-01' }).subscribe();
    const req = httpTesting.expectOne(
      (r) => r.url === reports && r.params.get('status') === 'signed' && r.params.get('from_date') === '2026-01-01',
    );
    expect(req.request.method).toBe('GET');
    req.flush({ data: [], meta: { current_page: 1, total: 0 } });
  });

  it('signs a service report and drafts invoices', () => {
    const sign = { signature_base64: 'data', signer_name: 'Rossi' };
    service.signServiceReport('r1', sign).subscribe();
    const signReq = httpTesting.expectOne(`${reports}/r1/sign`);
    expect(signReq.request.body).toEqual(sign);
    signReq.flush({ data: { id: 'r1' } });

    service.generateServiceReportInvoice('r1').subscribe();
    const invoice = httpTesting.expectOne(`${reports}/r1/generate-invoice`);
    expect(invoice.request.method).toBe('POST');
    invoice.flush({ data: { id: 'i' } });

    service.generateConsolidatedInvoice(['r1', 'r2']).subscribe();
    const consolidated = httpTesting.expectOne(`${reports}/generate-consolidated-invoice`);
    expect(consolidated.request.body).toEqual({ report_ids: ['r1', 'r2'] });
    consolidated.flush({ data: { id: 'i2' } });
  });

  it('uploads a photo as multipart and downloads the PDF', () => {
    const file = new File(['x'], 'p.png', { type: 'image/png' });
    service.uploadServiceReportPhoto('r1', file, 'before', 'Caption').subscribe();
    const upload = httpTesting.expectOne(`${reports}/r1/upload-photo`);
    expect(upload.request.method).toBe('POST');
    const body = upload.request.body as FormData;
    expect((body.get('photo') as File).name).toBe('p.png');
    expect(body.get('stage')).toBe('before');
    expect(body.get('caption')).toBe('Caption');
    upload.flush({ data: { id: 'ph' } });

    service.downloadServiceReportPdf('r1').subscribe((blob) => expect(blob.size).toBe(3));
    const pdf = httpTesting.expectOne(`${reports}/r1/pdf`);
    expect(pdf.request.responseType).toBe('blob');
    pdf.flush(new Blob(['pdf']));
  });
});
