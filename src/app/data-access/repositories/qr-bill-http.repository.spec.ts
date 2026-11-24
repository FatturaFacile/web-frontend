import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '@env';
import { SalesInvoiceApiDto } from '@data-access/dtos/sales-invoice.dto';
import { QrBillHttpRepository } from '@data-access/repositories/qr-bill-http.repository';

describe('QrBillHttpRepository', () => {
  let repository: QrBillHttpRepository;
  let httpMock: HttpTestingController;

  const invoice = (overrides: Partial<SalesInvoiceApiDto>): SalesInvoiceApiDto => ({
    id: 'inv-1',
    invoice_number: 'FA-2026-001',
    date: '2026-03-01',
    due_date: '2026-03-31',
    currency: 'CHF',
    jurisdiction: 'CH',
    status: 'issued',
    payment_status: 'unpaid',
    amount_due: 1450.85,
    notes: 'Fornitura',
    contact: { id: 'c-1', name: 'Bernasconi SA', country: 'CH' },
    qr_bill_data: { qr_iban: 'CH4431999123000889012', scor_reference: 'RF18000000000539007547034' },
    ...overrides,
  });

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), QrBillHttpRepository],
    });
    repository = TestBed.inject(QrBillHttpRepository);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('lists the Swiss invoices that carry QR-bill data from /sales/invoices', () => {
    repository.getBills().subscribe((bills) => {
      expect(bills.length).toBe(2);
      expect(bills[0]).toEqual(
        expect.objectContaining({
          id: 'inv-1',
          billNumber: 'FA-2026-001',
          currency: 'CHF',
          amount: 1450.85,
          reference: 'RF18000000000539007547034',
          status: 'PENDING',
        }),
      );
      expect(bills[0].creditor.qrIban).toBe('CH4431999123000889012');
      expect(bills[0].debtor.name).toBe('Bernasconi SA');
      expect(bills[1].status).toBe('PAID');
    });

    const req = httpMock.expectOne((r) => r.url === `${environment.apiBaseUrl}/sales/invoices`);
    expect(req.request.method).toBe('GET');
    req.flush({
      data: [
        invoice({}),
        invoice({ id: 'inv-2', payment_status: 'paid' }),
        invoice({ id: 'inv-3', jurisdiction: 'IT' }),
        invoice({ id: 'inv-4', qr_bill_data: null }),
      ],
    });
  });
});
