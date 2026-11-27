import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { environment } from '@env';
import { BankingApiService } from './banking-api.service';

describe('BankingApiService ISO 20022', () => {
  let service: BankingApiService;
  let http: HttpTestingController;
  const base = `${environment.apiBaseUrl}/banking`;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [BankingApiService, provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(BankingApiService);
    http = TestBed.inject(HttpTestingController);
  });

  it('uploads the statement as multipart form data with the reconcile flag', () => {
    const file = new File(['<Document/>'], 'camt053.xml', { type: 'text/xml' });
    service.importIso20022(file, false).subscribe();

    const req = http.expectOne(`${base}/iso20022/import`);
    const body = req.request.body as FormData;
    expect(req.request.method).toBe('POST');
    expect(body.get('file')).toBeInstanceOf(File);
    expect(body.get('auto_reconcile')).toBe('0');
    req.flush({ success: true, data: {} });
  });

  it('lists the transactions with the filters as query parameters', () => {
    service.getReconciliationTransactions({ status: 'unmatched', direction: 'credit', search: 'müller', page: 2, per_page: 25 }).subscribe();

    const req = http.expectOne((r) => r.url === `${base}/reconciliation/transactions`);
    expect(req.request.params.get('status')).toBe('unmatched');
    expect(req.request.params.get('direction')).toBe('credit');
    expect(req.request.params.get('search')).toBe('müller');
    expect(req.request.params.get('page')).toBe('2');
    req.flush({ success: true, data: [], meta: {} });
  });

  it('matches a transaction with an invoice', () => {
    service.matchTransaction('line-1', { invoice_id: 'inv-1', difference_handling: 'partial' }).subscribe();

    const req = http.expectOne(`${base}/reconciliation/transactions/line-1/match`);
    expect(req.request.body).toEqual({ invoice_id: 'inv-1', difference_handling: 'partial' });
    req.flush({ success: true, data: {} });
  });

  it('exports the pain.001 file of the selected invoices', () => {
    service.exportPain001({ invoice_ids: ['a', 'b'], version: '09', scheme: 'ch', execution_date: '2026-03-20' }).subscribe();

    const req = http.expectOne(`${base}/iso20022/pain001/export`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ invoice_ids: ['a', 'b'], version: '09', scheme: 'ch', execution_date: '2026-03-20' });
    req.flush({ success: true, data: {} });
  });
  it('uploads any ISO 20022 message with the reconcile flag and the optional payment batch', () => {
    const file = new File(['<Document/>'], 'pain002.xml', { type: 'text/xml' });
    service.uploadIso20022(file, { autoReconcile: false, paymentBatchId: 'batch-1' }).subscribe();

    const req = http.expectOne(`${base}/iso20022/upload`);
    const body = req.request.body as FormData;
    expect(req.request.method).toBe('POST');
    expect(body.get('file')).toBeInstanceOf(File);
    expect(body.get('auto_reconcile')).toBe('0');
    expect(body.get('payment_batch_id')).toBe('batch-1');
    req.flush({ success: true, data: { type: 'pain.002', filename: 'pain002.xml' } });
  });

  it('reconciles by default and leaves the batch out when none is given', () => {
    service.uploadIso20022(new File(['<Document/>'], 'camt053.xml')).subscribe();

    const body = http.expectOne(`${base}/iso20022/upload`).request.body as FormData;
    expect(body.get('auto_reconcile')).toBe('1');
    expect(body.has('payment_batch_id')).toBe(false);
  });

  it('lists the reconciliation exceptions with the code and filters as query parameters', () => {
    service
      .getReconciliationExceptions({ code: 'AmountMismatch', direction: 'debit', search: 'müller', statement_id: 's-1', page: 3, per_page: 25 })
      .subscribe();

    const req = http.expectOne((r) => r.url === `${base}/reconciliation/exceptions`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('code')).toBe('AmountMismatch');
    expect(req.request.params.get('direction')).toBe('debit');
    expect(req.request.params.get('search')).toBe('müller');
    expect(req.request.params.get('statement_id')).toBe('s-1');
    expect(req.request.params.get('page')).toBe('3');
    expect(req.request.params.get('per_page')).toBe('25');
    req.flush({ success: true, data: [], meta: {} });
  });

  it('omits empty exception filters', () => {
    service.getReconciliationExceptions({ search: '' }).subscribe();

    const req = http.expectOne((r) => r.url === `${base}/reconciliation/exceptions`);
    expect(req.request.params.keys()).toEqual([]);
    req.flush({ success: true, data: [], meta: {} });
  });

  it('assigns a line to an invoice through the manual match endpoint', () => {
    service.assignLineToInvoice('line-1', { invoice_id: 'inv-1', difference_handling: 'write_off' }).subscribe();

    const req = http.expectOne(`${base}/statements/lines/line-1/manual-match`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ invoice_id: 'inv-1', difference_handling: 'write_off' });
    req.flush({ success: true, data: {} });
  });

  it('categorizes a line with the ledger account and notes', () => {
    service.categorizeLine('line-1', { category: 'bank_expense', ledger_account_code: '6940', notes: 'Fee' }).subscribe();

    const req = http.expectOne(`${base}/statements/lines/line-1/categorize`);
    expect(req.request.body).toEqual({ category: 'bank_expense', ledger_account_code: '6940', notes: 'Fee' });
    req.flush({ success: true, data: {} });
  });
});
