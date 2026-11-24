import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '@env';
import { SupplierSelfServiceApiService } from './supplier-self-service-api.service';

describe('SupplierSelfServiceApiService', () => {
  let service: SupplierSelfServiceApiService;
  let httpMock: HttpTestingController;
  const base = `${environment.apiBaseUrl}/supplier-self-service`;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [SupplierSelfServiceApiService, provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(SupplierSelfServiceApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('sends the supplier token in the X-Supplier-Token header on reads', () => {
    const reads: [() => unknown, string][] = [
      [() => service.getMe('tok').subscribe(), '/me'],
      [() => service.getPurchaseOrders('tok').subscribe(), '/purchase-orders'],
      [() => service.getPurchaseOrder('tok', 'p1').subscribe(), '/purchase-orders/p1'],
      [() => service.getRfqs('tok').subscribe(), '/rfqs'],
      [() => service.getRfq('tok', 'r1').subscribe(), '/rfqs/r1'],
      [() => service.getInvoices('tok').subscribe(), '/invoices'],
      [() => service.getBankChanges('tok').subscribe(), '/bank-changes'],
    ];
    for (const [call, path] of reads) {
      call();
      const req = httpMock.expectOne(`${base}${path}`);
      expect(req.request.method).toBe('GET');
      expect(req.request.headers.get('X-Supplier-Token')).toBe('tok');
      req.flush({ data: [] });
    }
  });

  it('posts registration, review, quote, decline and bank change', () => {
    const registration = {
      legal_name: 'ACME',
      country: 'IT' as const,
      vat_number: '1',
      address_line: 'v',
      postal_code: '1',
      city: 'c',
      contact_name: 'n',
      contact_email: 'a@b.it',
    };
    const quote = { lines: [{ rfq_line_id: 'l1', unit_price: 3 }] };
    const bank = { account_holder: 'A', iban: 'IT60' };
    const posts: [() => unknown, string, unknown][] = [
      [() => service.submitRegistration('tok', registration).subscribe(), '/registration', registration],
      [() => service.submitForReview('tok').subscribe(), '/submit-for-review', {}],
      [() => service.submitQuote('tok', 'r1', quote).subscribe(), '/rfqs/r1/quote', quote],
      [() => service.declineRfq('tok', 'r1').subscribe(), '/rfqs/r1/decline', {}],
      [() => service.requestBankChange('tok', bank).subscribe(), '/bank-changes', bank],
    ];
    for (const [call, path, body] of posts) {
      call();
      const req = httpMock.expectOne(`${base}${path}`);
      expect(req.request.method).toBe('POST');
      expect(req.request.headers.get('X-Supplier-Token')).toBe('tok');
      expect(req.request.body).toEqual(body);
      req.flush({ data: {} });
    }
  });

  it('uploads a document as multipart form data', () => {
    const file = new File(['x'], 'doc.pdf', { type: 'application/pdf' });
    service.uploadDocument('tok', { requirement_id: 'q1', file, reference: 'R1', notes: null }).subscribe();
    const req = httpMock.expectOne(`${base}/documents`);
    const form = req.request.body as FormData;
    expect(req.request.method).toBe('POST');
    expect(form.get('requirement_id')).toBe('q1');
    expect(form.get('reference')).toBe('R1');
    expect(form.has('notes')).toBe(false);
    expect(form.get('file')).toBeInstanceOf(File);
    req.flush({ data: {} });
  });
});
