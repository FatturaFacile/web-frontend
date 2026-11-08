import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { environment } from '@env';
import {
  CreateBankAccountPayload,
  CreatePaymentBatchPayload,
  TreasuryApiService,
} from '@core';

describe('TreasuryApiService', () => {
  let service: TreasuryApiService;
  let httpTesting: HttpTestingController;
  const baseUrl = `${environment.apiBaseUrl}/treasury`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [TreasuryApiService, provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(TreasuryApiService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  it('manages bank accounts (get, create, update, delete)', () => {
    service.getBankAccounts().subscribe((res) => {
      expect(res.data).toHaveLength(1);
    });
    const reqGet = httpTesting.expectOne(`${baseUrl}/bank-accounts`);
    expect(reqGet.request.method).toBe('GET');
    reqGet.flush({ success: true, message: 'OK', data: [{ id: 'ba-1', bank_name: 'UBS' }] });

    const createPayload: CreateBankAccountPayload = {
      bank_name: 'Credit Suisse',
      iban: 'CH9300762011623852957',
      currency: 'CHF',
      is_active: true,
    };
    service.createBankAccount(createPayload).subscribe((res) => {
      expect(res.data.id).toBe('ba-2');
    });
    const reqPost = httpTesting.expectOne(`${baseUrl}/bank-accounts`);
    expect(reqPost.request.method).toBe('POST');
    reqPost.flush({ success: true, message: 'Created', data: { id: 'ba-2', ...createPayload } });

    service.deleteBankAccount('ba-2').subscribe();
    const reqDel = httpTesting.expectOne(`${baseUrl}/bank-accounts/ba-2`);
    expect(reqDel.request.method).toBe('DELETE');
    reqDel.flush({ success: true, message: 'Deleted', data: null });
  });

  it('handles bank transactions and auto-matching', () => {
    service.getBankTransactions({ page: 1, per_page: 20 }).subscribe((res) => {
      expect(res.data).toHaveLength(2);
    });
    const reqTx = httpTesting.expectOne((r) => r.url === `${baseUrl}/transactions` && r.params.get('page') === '1');
    expect(reqTx.request.method).toBe('GET');
    reqTx.flush({ success: true, message: 'OK', data: [{ id: 'tx-1' }, { id: 'tx-2' }], meta: { total: 2 } });

    service.reconcileTransactionsAutoMatch().subscribe((res) => {
      expect(res.data.matched_count).toBe(5);
    });
    const reqMatch = httpTesting.expectOne(`${baseUrl}/reconciliation/auto-match`);
    expect(reqMatch.request.method).toBe('POST');
    reqMatch.flush({ success: true, message: 'Matched', data: { matched_count: 5 } });
  });

  it('handles CAMT and CBI file imports', () => {
    const formData = new FormData();
    formData.append('file', new Blob(['camt']), 'camt053.xml');

    service.importCamtFile(formData).subscribe((res) => {
      expect(res.data.imported_count).toBe(12);
    });
    const reqCamt = httpTesting.expectOne(`${baseUrl}/import-camt`);
    expect(reqCamt.request.method).toBe('POST');
    reqCamt.flush({ success: true, message: 'Imported', data: { imported_count: 12 } });

    service.importCbiFile(formData).subscribe((res) => {
      expect(res.data.imported_count).toBe(8);
    });
    const reqCbi = httpTesting.expectOne(`${baseUrl}/import-cbi`);
    expect(reqCbi.request.method).toBe('POST');
    reqCbi.flush({ success: true, message: 'Imported', data: { imported_count: 8 } });
  });

  it('manages payment batches (create, submit, approve, export, downloadXml)', () => {
    const batchPayload: CreatePaymentBatchPayload = {
      bank_account_id: 'ba-1',
      batch_reference: 'BATCH-2026-001',
      payment_method: 'sepa_credit_transfer',
      lines: [
        {
          recipient_name: 'Supplier A',
          recipient_iban: 'IT60X0569601600000001234567',
          amount: 500,
        },
      ],
    };

    service.createPaymentBatch(batchPayload).subscribe((res) => {
      expect(res.data.id).toBe('pb-1');
    });
    const reqCreate = httpTesting.expectOne(`${baseUrl}/payment-batches`);
    expect(reqCreate.request.method).toBe('POST');
    reqCreate.flush({ success: true, message: 'Created', data: { id: 'pb-1', status: 'draft' } });

    service.submitPaymentBatchApproval('pb-1').subscribe();
    const reqSubmit = httpTesting.expectOne(`${baseUrl}/payment-batches/pb-1/submit-approval`);
    expect(reqSubmit.request.method).toBe('POST');
    reqSubmit.flush({ success: true, message: 'Submitted', data: { id: 'pb-1', status: 'pending_approval' } });

    service.approvePaymentBatch('pb-1').subscribe();
    const reqApprove = httpTesting.expectOne(`${baseUrl}/payment-batches/pb-1/approve`);
    expect(reqApprove.request.method).toBe('POST');
    reqApprove.flush({ success: true, message: 'Approved', data: { id: 'pb-1', status: 'approved' } });

    service.exportPaymentBatch('pb-1').subscribe();
    const reqExport = httpTesting.expectOne(`${baseUrl}/payment-batches/pb-1/export`);
    expect(reqExport.request.method).toBe('POST');
    reqExport.flush({ success: true, message: 'Exported', data: { file_content: '<xml/>' } });

    service.downloadPaymentBatchXml('pb-1').subscribe((blob) => {
      expect(blob).toBeTruthy();
    });
    const reqDownload = httpTesting.expectOne(`${baseUrl}/payment-batches/pb-1/download-xml`);
    expect(reqDownload.request.method).toBe('GET');
    reqDownload.flush(new Blob(['xml content'], { type: 'application/xml' }));
  });

  it('generates cash flow forecasts', () => {
    service.generateCashForecast(60).subscribe((res) => {
      expect(res.data.horizon_days).toBe(60);
      expect(res.data.projected_cash).toBe(150000);
    });

    const reqForecast = httpTesting.expectOne(`${baseUrl}/cash-forecasts/generate`);
    expect(reqForecast.request.method).toBe('POST');
    expect(reqForecast.request.body).toEqual({ horizon_days: 60 });
    reqForecast.flush({
      success: true,
      message: 'Generated',
      data: {
        id: 'cf-1',
        forecast_date: '2026-11-09',
        horizon_days: 60,
        opening_cash: 100000,
        expected_inflows: 80000,
        expected_outflows: 30000,
        projected_cash: 150000,
        deficit_identified: false,
        currency: 'EUR',
      },
    });
  });
});
