import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '@env';
import { ExpenseManagementApiService } from './expense-management-api.service';

describe('ExpenseManagementApiService', () => {
  const base = `${environment.apiBaseUrl}/expense-management`;
  let service: ExpenseManagementApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), ExpenseManagementApiService],
    });
    service = TestBed.inject(ExpenseManagementApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lists the reports with the filters as query parameters', () => {
    service.listReports({ status: 'draft', page: 2, q: 'rossi' }).subscribe();

    const request = http.expectOne((req) => req.url === `${base}/reports`);
    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('status')).toBe('draft');
    expect(request.request.params.get('page')).toBe('2');
    expect(request.request.params.get('q')).toBe('rossi');
    request.flush({ success: true, message: 'ok', data: [], meta: {} });
  });

  it('sends the cash flag with a line', () => {
    service
      .addLine('r-1', {
        expense_date: '2028-01-10',
        category_id: 'c',
        merchant_name: 'Bar',
        original_amount: 5,
        original_currency: 'EUR',
        payment_method: 'employee_out_of_pocket',
        is_traceable_payment: false,
      })
      .subscribe();

    const request = http.expectOne(`${base}/reports/r-1/lines`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body.is_traceable_payment).toBe(false);
    request.flush({ success: true, message: 'ok', data: {} });
  });

  it('quotes a mileage claim and previews a per diem', () => {
    service
      .quoteMileage({ vehicle_class_code: 'A', distance_km: 10, is_round_trip: true })
      .subscribe();
    http
      .expectOne(`${base}/mileage-claims/quote`)
      .flush({ success: true, message: 'ok', data: {} });

    service
      .previewPerDiem({
        country_code: 'IT',
        destination_type: 'domestic',
        allowance_method: 'flat_rate',
        trip_start_at: '2028-01-10T08:00',
        trip_end_at: '2028-01-11T20:00',
      })
      .subscribe();
    http.expectOne(`${base}/per-diems/preview`).flush({ success: true, message: 'ok', data: {} });
  });

  it('uploads a receipt as multipart with the optional OCR text and report', () => {
    const file = new File(['x'], 'receipt.png', { type: 'image/png' });
    service.scanReceipt(file, 'TOTALE 10,00', 'r-1').subscribe();

    const request = http.expectOne(`${base}/receipts/scan`);
    const body = request.request.body as FormData;
    expect(body.get('file')).toBeInstanceOf(File);
    expect(body.get('ocr_text')).toBe('TOTALE 10,00');
    expect(body.get('expense_report_id')).toBe('r-1');
    request.flush({ success: true, message: 'ok', data: {} });
  });

  it('downloads files as blobs', () => {
    service.receiptFile('rc-1').subscribe();
    const receipt = http.expectOne(`${base}/receipts/rc-1/file`);
    expect(receipt.request.responseType).toBe('blob');
    receipt.flush(new Blob(['x']));

    service.downloadPayout('r-1', 'p-1').subscribe();
    const payout = http.expectOne(`${base}/reports/r-1/payouts/p-1/file`);
    expect(payout.request.responseType).toBe('blob');
    payout.flush(new Blob(['x']));
  });

  it('reconciles a card transaction', () => {
    service
      .reconcileCardTransaction('tx-1', {
        action: 'match',
        matches: [{ expense_line_id: 'l-1', amount: 10 }],
      })
      .subscribe();

    const request = http.expectOne(`${base}/card-transactions/tx-1/reconcile`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body.action).toBe('match');
    request.flush({ success: true, message: 'ok', data: {} });
  });

  it('posts the workflow actions', () => {
    service.submit('r-1').subscribe();
    http.expectOne(`${base}/reports/r-1/submit`).flush({ success: true, message: 'ok', data: {} });
    service.reject('r-1', 'Missing receipts').subscribe();
    const reject = http.expectOne(`${base}/reports/r-1/reject`);
    expect(reject.request.body).toEqual({ reason: 'Missing receipts' });
    reject.flush({ success: true, message: 'ok', data: {} });
    service.exportPayout('r-1', { channel: 'payroll' }).subscribe();
    http
      .expectOne(`${base}/reports/r-1/export-payout`)
      .flush({ success: true, message: 'ok', data: {} });
  });
});
