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

  describe('WMS workflow endpoints', () => {
    const wms = `${environment.apiBaseUrl}/wms`;

    it('approves and closes a transfer without a body', () => {
      api.approveTransfer('t1').subscribe();
      api.closeTransfer('t1').subscribe();

      const approve = http.expectOne(`${wms}/transfers/t1/approve`);
      expect(approve.request.method).toBe('POST');
      expect(approve.request.body).toEqual({});
      expect(http.expectOne(`${wms}/transfers/t1/close`).request.method).toBe('POST');
    });

    it('lists transfers filtered by several statuses, purpose and inter-company flag', () => {
      api
        .listTransfers({
          status: 'in_transit,partially_received',
          is_inter_company: 1,
          warehouse_id: 'w1',
          direction: 'inbound',
        })
        .subscribe();

      const req = http.expectOne((r) => r.url === `${base}/transfers`);
      expect(req.request.params.get('status')).toBe('in_transit,partially_received');
      expect(req.request.params.get('is_inter_company')).toBe('1');
      expect(req.request.params.get('warehouse_id')).toBe('w1');
      expect(req.request.params.get('direction')).toBe('inbound');
      expect(req.request.params.has('purpose')).toBe(false);
    });

    it('ships a transfer with the carrier data of the dispatch wizard', () => {
      api
        .shipTransfer('t1', {
          carrier_name: 'DHL',
          transport_by: 'carrier',
          carriage_terms: 'free',
          packages_count: 2,
          gross_weight_kg: 12.5,
        })
        .subscribe();

      const req = http.expectOne(`${base}/transfers/t1/ship`);
      expect(req.request.body).toMatchObject({ carrier_name: 'DHL', packages_count: 2 });
    });

    it('sends a partial receipt with the final flag and damaged units', () => {
      api
        .receiveTransfer(
          't1',
          [{ line_id: 'l1', received_qty: 4, damaged_qty: 1, discrepancy_reason: 'Cracked' }],
          false,
        )
        .subscribe();

      const req = http.expectOne(`${base}/transfers/t1/receive`);
      expect(req.request.body).toEqual({
        lines: [{ line_id: 'l1', received_qty: 4, damaged_qty: 1, discrepancy_reason: 'Cracked' }],
        final: false,
      });
    });

    it('scans a code against a transfer', () => {
      api.scanTransferLine('t1', '8000123').subscribe();

      const req = http.expectOne(`${wms}/transfers/t1/scan`);
      expect(req.request.body).toEqual({ code: '8000123' });
    });

    it('resolves a discrepancy through the transfer it belongs to', () => {
      api.resolveTransferDiscrepancy('t1', 'd1', 'approved_write_off').subscribe();

      const req = http.expectOne(`${wms}/transfers/t1/discrepancies/d1/resolve`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ resolution: 'approved_write_off' });
    });

    it('loads the third-party register with partner and period filters', () => {
      api
        .thirdPartyRegister({ partner_id: 'p1', from: '2026-01-01', to: '2026-01-31' })
        .subscribe();

      const req = http.expectOne((r) => r.url === `${wms}/reports/third-party-register`);
      expect(req.request.params.get('partner_id')).toBe('p1');
      expect(req.request.params.get('from')).toBe('2026-01-01');
      expect(req.request.params.get('to')).toBe('2026-01-31');
    });

    it('loads the fiscal inventory valuation', () => {
      api.fiscalValuation().subscribe();
      expect(http.expectOne(`${wms}/reports/inventory-valuation`).request.method).toBe('GET');
    });

    it('creates and lists consumption declarations', () => {
      api
        .createDeclaration({
          warehouse_id: 'w1',
          agreement_id: 'a1',
          period_start: '2026-01-01',
          period_end: '2026-01-31',
          lines: [{ product_id: 'p1', quantity: 3, unit_price: 10, tax_rate: 22 }],
        })
        .subscribe();
      api.listDeclarations('w1').subscribe();

      const create = http.expectOne(`${wms}/consignment/declarations`);
      expect(create.request.method).toBe('POST');
      expect(create.request.body.lines[0]).toEqual({
        product_id: 'p1',
        quantity: 3,
        unit_price: 10,
        tax_rate: 22,
      });
      const list = http.expectOne(
        (r) => r.url === `${wms}/consignment/declarations` && r.method === 'GET',
      );
      expect(list.request.params.get('warehouse_id')).toBe('w1');
    });

    it('manages consignment agreements and vendor receipts', () => {
      api.listAgreements({ status: 'active', direction: 'customer' }).subscribe();
      api.createAgreement({ warehouse_id: 'w1', valid_from: '2026-01-01' }).subscribe();
      api.terminateAgreement('a1').subscribe();
      api
        .receiveVendorConsignment({ warehouse_id: 'w2', lines: [{ product_id: 'p', quantity: 5 }] })
        .subscribe();

      const list = http.expectOne(
        (r) => r.url === `${wms}/consignment/agreements` && r.method === 'GET',
      );
      expect(list.request.params.get('status')).toBe('active');
      expect(list.request.params.get('direction')).toBe('customer');
      expect(
        http.expectOne((r) => r.url === `${wms}/consignment/agreements` && r.method === 'POST')
          .request.body,
      ).toEqual({ warehouse_id: 'w1', valid_from: '2026-01-01' });
      expect(http.expectOne(`${wms}/consignment/agreements/a1/terminate`).request.method).toBe(
        'POST',
      );
      expect(http.expectOne(`${wms}/consignment/vendor-receipts`).request.body).toEqual({
        warehouse_id: 'w2',
        lines: [{ product_id: 'p', quantity: 5 }],
      });
    });
  });
});
