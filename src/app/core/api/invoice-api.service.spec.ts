import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { environment } from '@env';
import { InvoiceApiService } from './invoice-api.service';
import { CreateCreditNotePayload, CreateInvoicePayload } from '../models';

describe('InvoiceApiService', () => {
  let service: InvoiceApiService;
  let httpTesting: HttpTestingController;
  const baseUrl = environment.apiBaseUrl;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [InvoiceApiService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(InvoiceApiService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  it('fetches paginated invoices', () => {
    service.list({ payment_status: 'unpaid' }).subscribe((res) => {
      expect(res.data.length).toBe(1);
    });

    const req = httpTesting.expectOne(
      (r) => r.url === `${baseUrl}/sales/invoices` && r.params.get('payment_status') === 'unpaid',
    );
    expect(req.request.method).toBe('GET');
    req.flush({ success: true, data: [{ id: 'inv-1', invoice_number: 'INV-001' }] });
  });

  it('creates invoice', () => {
    const payload: CreateInvoicePayload = {
      contact_id: 'c-1',
      invoice_type: 'sdi_electronic',
      date: '2026-11-09',
      currency: 'EUR',
      jurisdiction: 'IT',
      items: [{ description: 'Software license', quantity: 1, unit_price: 500, tax_rate: 22 }],
    };

    service.create(payload).subscribe((res) => {
      expect(res.data.id).toBe('inv-2');
    });

    const req = httpTesting.expectOne(`${baseUrl}/sales/invoices`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush({ success: true, data: { id: 'inv-2', ...payload } });
  });

  it('generates SDI XML and sends single invoice to SDI', () => {
    service.generateSdiXml('inv-1').subscribe((res) => {
      expect(res.data.status).toBe('generated');
    });

    const req1 = httpTesting.expectOne(`${baseUrl}/sales/invoices/inv-1/generate-sdi-xml`);
    expect(req1.request.method).toBe('POST');
    req1.flush({ success: true, data: { status: 'generated', xml_url: '/storage/xml/inv-1.xml' } });

    service.sendToSdi('inv-1').subscribe((res) => {
      expect(res.success).toBe(true);
    });

    const req2 = httpTesting.expectOne(`${baseUrl}/sales/invoices/inv-1/send-sdi`);
    expect(req2.request.method).toBe('POST');
    req2.flush({ success: true, data: null });
  });

  it('transmits bulk invoices to SDI', () => {
    service.sendSdiBulk(['inv-1', 'inv-2']).subscribe((res) => {
      expect(res.data.sent).toBe(2);
      expect(res.data.failed).toBe(0);
    });

    const req = httpTesting.expectOne(`${baseUrl}/sales/invoices/send-sdi-bulk`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ invoice_ids: ['inv-1', 'inv-2'] });
    req.flush({
      success: true,
      data: { sent: 2, failed: 0, results: [{ id: 'inv-1', success: true }, { id: 'inv-2', success: true }] },
    });
  });

  it('fetches SDI logs', () => {
    service.getSdiLogs('inv-1').subscribe((res) => {
      expect(res.data.outbound.length).toBe(1);
    });

    const req = httpTesting.expectOne(`${baseUrl}/sales/invoices/inv-1/sdi-logs`);
    expect(req.request.method).toBe('GET');
    req.flush({
      success: true,
      data: {
        outbound: [{ action: 'SDI_TRANSMIT', status: 'delivered' }],
        inbound: [{ action: 'SDI_RECEIPT', status: 'RC_CONSEGNATA' }],
      },
    });
  });

  it('fetches Swiss QR-Bill payload', () => {
    service.getQrBill('inv-ch-1').subscribe((res) => {
      expect(res.data.payload.startsWith('SPC')).toBe(true);
      expect(res.data.reference_type).toBe('QRR');
    });

    const req = httpTesting.expectOne(`${baseUrl}/sales/invoices/inv-ch-1/qr-bill`);
    expect(req.request.method).toBe('GET');
    req.flush({
      success: true,
      data: {
        payload: 'SPC\n0200\n1\nCH4431999123000889012',
        reference_type: 'QRR',
        reference: '210000000003139471430009017',
        iban: 'CH4431999123000889012',
        currency: 'CHF',
        amount: 1500,
      },
    });
  });

  it('creates and applies credit note', () => {
    const payload: CreateCreditNotePayload = {
      original_invoice_id: 'inv-1',
      notes: 'Customer returned goods',
      items: [{ description: 'Defective unit', quantity: 1, unit_price: 100, tax_rate: 22 }],
    };

    service.createCreditNote(payload).subscribe((res) => {
      expect(res.data.credit_note_number).toBe('NC-001');
    });

    const req1 = httpTesting.expectOne(`${baseUrl}/invoicing/credit-notes`);
    expect(req1.request.method).toBe('POST');
    req1.flush({
      success: true,
      data: { id: 'cn-1', credit_note_number: 'NC-001', ...payload, total_gross: 122 },
    });

    service.applyCreditNote('cn-1', 'inv-1', 122).subscribe((res) => {
      expect(res.success).toBe(true);
    });

    const req2 = httpTesting.expectOne(`${baseUrl}/invoicing/credit-notes/cn-1/apply`);
    expect(req2.request.method).toBe('POST');
    expect(req2.request.body).toEqual({ target_invoice_id: 'inv-1', amount: 122 });
    req2.flush({ success: true, data: null });
  });

  it('retrieves installments schedule', () => {
    service.getInstallments('inv-1').subscribe((res) => {
      expect(res.data.length).toBe(2);
    });

    const req = httpTesting.expectOne(`${baseUrl}/invoicing/invoices/inv-1/installments`);
    expect(req.request.method).toBe('GET');
    req.flush({
      success: true,
      data: [
        { installment_number: 1, due_date: '2026-11-30', amount: 500, status: 'paid' },
        { installment_number: 2, due_date: '2026-12-31', amount: 500, status: 'unpaid' },
      ],
    });
  });
});
