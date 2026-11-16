import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { environment } from '@env';
import { LogisticsApiService } from './logistics-api.service';

describe('LogisticsApiService', () => {
  let api: LogisticsApiService;
  let http: HttpTestingController;
  const base = `${environment.apiBaseUrl}/logistics`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(LogisticsApiService);
    http = TestBed.inject(HttpTestingController);
  });

  it('lists delivery notes with filters and drops empty values', () => {
    api
      .listDeliveryNotes({ status: 'issued', type: undefined, date_from: '2026-01-01', page: 2 })
      .subscribe();

    const req = http.expectOne((r) => r.url === `${base}/delivery-notes`);
    expect(req.request.params.get('status')).toBe('issued');
    expect(req.request.params.get('date_from')).toBe('2026-01-01');
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.has('type')).toBe(false);
    req.flush({ success: true, message: '', data: [], meta: {} });
  });

  it('drives the status machine through the dedicated endpoints', () => {
    api.issue('a').subscribe();
    api.dispatch('a').subscribe();
    api.deliver('a', 'Mario Rossi').subscribe();
    api.cancel('a').subscribe();

    expect(http.expectOne(`${base}/delivery-notes/a/issue`).request.method).toBe('POST');
    expect(http.expectOne(`${base}/delivery-notes/a/dispatch`).request.method).toBe('POST');
    const deliver = http.expectOne(`${base}/delivery-notes/a/deliver`);
    expect(deliver.request.body).toEqual({ recipient_signature_name: 'Mario Rossi' });
    expect(http.expectOne(`${base}/delivery-notes/a/cancel`).request.method).toBe('POST');
  });

  it('requests the PDF as a blob with the hide-prices flag and language', () => {
    api.downloadPdf('a', { hide_prices: true, lang: 'de' }).subscribe();

    const req = http.expectOne((r) => r.url === `${base}/delivery-notes/a/pdf`);
    expect(req.request.responseType).toBe('blob');
    expect(req.request.params.get('hide_prices')).toBe('1');
    expect(req.request.params.get('lang')).toBe('de');
  });

  it('omits hide_prices when prices are shown', () => {
    api.downloadPdf('a').subscribe();

    const req = http.expectOne((r) => r.url === `${base}/delivery-notes/a/pdf`);
    expect(req.request.params.has('hide_prices')).toBe(false);
  });

  it('sends the selected delivery notes for the cumulative deferred invoice', () => {
    api.deferredInvoice(['a', 'b'], false).subscribe();

    const req = http.expectOne(`${base}/delivery-notes/deferred-invoice`);
    expect(req.request.body).toEqual({ delivery_note_ids: ['a', 'b'], enforce_same_month: false });
  });

  it('receives a transfer with per-line quantities and discrepancy reasons', () => {
    api
      .receiveTransfer('t1', [{ line_id: 'l1', received_qty: 35, discrepancy_reason: 'Damaged' }])
      .subscribe();

    const req = http.expectOne(`${base}/transfers/t1/receive`);
    expect(req.request.body).toEqual({
      lines: [{ line_id: 'l1', received_qty: 35, discrepancy_reason: 'Damaged' }],
    });
  });

  it('resolves a discrepancy and declares consumption', () => {
    api.resolveDiscrepancy('d1', 'carrier_claim').subscribe();
    expect(http.expectOne(`${base}/transfer-discrepancies/d1/resolve`).request.body).toEqual({
      resolution: 'carrier_claim',
    });

    api
      .declareConsumption({
        warehouse_id: 'w',
        period_start: '2026-01-01',
        period_end: '2026-01-31',
        lines: [{ product_id: 'p', quantity: 3 }],
      })
      .subscribe();
    expect(http.expectOne(`${base}/consignment/consumption-reports`).request.method).toBe('POST');
  });
});
