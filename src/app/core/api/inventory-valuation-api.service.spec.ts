import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '@env';
import { DownloadedFile, LandedCostPayload } from '../models';
import {
  filenameFromDisposition,
  InventoryValuationApiService,
  toInventoryPage,
  unwrapInventoryData,
} from './inventory-valuation-api.service';

describe('InventoryValuationApiService', () => {
  const base = 'https://api.example.test/api/v1';
  const originalApiBaseUrl = environment.apiBaseUrl;
  let api: InventoryValuationApiService;
  let http: HttpTestingController;

  const payload: LandedCostPayload = {
    document_date: '2026-11-15',
    cost_type: 'freight',
    allocation_key: 'value',
    currency: 'EUR',
    total_amount: '300.00',
    receipt_ids: ['r-1', 'r-2'],
  };

  beforeEach(() => {
    environment.apiBaseUrl = base;
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(InventoryValuationApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    environment.apiBaseUrl = originalApiBaseUrl;
  });

  describe('valuation config', () => {
    it('GETs valuation/config with filters and returns the rows', () => {
      let rows: unknown;
      api.getValuationConfig({ item_id: 'i-1' }).subscribe((r) => (rows = r));
      const req = http.expectOne((r) => r.url === `${base}/inventory/valuation/config`);
      expect(req.request.method).toBe('GET');
      expect(req.request.params.get('item_id')).toBe('i-1');
      req.flush({ data: [{ item_id: 'i-1', effective_method: 'fifo', source: 'item' }] });
      expect(rows).toEqual([{ item_id: 'i-1', effective_method: 'fifo', source: 'item' }]);
    });

    it('PUTs the item valuation and unwraps a {data} envelope keeping the revaluation', () => {
      let item: unknown;
      api
        .updateItemValuation('i-1', { valuation_method: 'weighted_average', revalue_on_change: true })
        .subscribe((r) => (item = r));
      const req = http.expectOne(`${base}/inventory/valuation/items/i-1`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({ valuation_method: 'weighted_average', revalue_on_change: true });
      req.flush({ data: { id: 'i-1', valuation_method: 'weighted_average' }, revaluation: { id: 'rv-1' } });
      expect(item).toEqual({ id: 'i-1', valuation_method: 'weighted_average', revaluation: { id: 'rv-1' } });
    });

    it('PUTs the category valuation', () => {
      api.updateCategoryValuation('c-1', { valuation_method: 'fifo' }).subscribe();
      const req = http.expectOne(`${base}/inventory/valuation/categories/c-1`);
      expect(req.request.method).toBe('PUT');
      req.flush({ id: 'c-1', valuation_method: 'fifo' });
    });

    it('GETs the valuation summary and POSTs a snapshot', () => {
      api.getValuationSummary({ warehouse_id: 'w-1', valuation_method: 'fifo' }).subscribe();
      const summary = http.expectOne((r) => r.url === `${base}/inventory/valuation/summary`);
      expect(summary.request.params.get('warehouse_id')).toBe('w-1');
      expect(summary.request.params.get('valuation_method')).toBe('fifo');
      summary.flush({ valuation_method: 'fifo', total_valuation: 0, items_count: 0, items: [] });

      api.captureValuationSnapshot({ stock_item_id: 'i-1', warehouse_id: 'w-1' }).subscribe();
      const snap = http.expectOne(`${base}/inventory/valuation/snapshot`);
      expect(snap.request.method).toBe('POST');
      snap.flush({});
    });
  });

  it('GETs cost layers with filters and normalises a non-paginated list', () => {
    let total = -1;
    api.getCostLayers({ item_id: 'i-1', open_only: true, warehouse_id: undefined }).subscribe((r) => (total = r.meta.total));
    const req = http.expectOne((r) => r.url === `${base}/inventory/valuation/cost-layers`);
    expect(req.request.params.get('item_id')).toBe('i-1');
    expect(req.request.params.get('open_only')).toBe('true');
    expect(req.request.params.has('warehouse_id')).toBe(false);
    req.flush({ data: [{ id: 'l-1' }, { id: 'l-2' }] });
    expect(total).toBe(2);
  });

  describe('landed costs', () => {
    it('lists documents with filters and keeps server pagination', () => {
      let total = -1;
      api.listLandedCosts({ status: 'draft', from: '2026-01-01', page: 2 }).subscribe((r) => (total = r.meta.total));
      const req = http.expectOne((r) => r.url === `${base}/inventory/landed-costs`);
      expect(req.request.method).toBe('GET');
      expect(req.request.params.get('status')).toBe('draft');
      expect(req.request.params.get('from')).toBe('2026-01-01');
      expect(req.request.params.get('page')).toBe('2');
      req.flush({ data: [], links: {}, meta: { total: 42, current_page: 2, per_page: 10, last_page: 5 } });
      expect(total).toBe(42);
    });

    it('gets, creates and previews documents', () => {
      api.getLandedCost('lc-1').subscribe();
      http.expectOne(`${base}/inventory/landed-costs/lc-1`).flush({ id: 'lc-1' });

      api.createLandedCost(payload).subscribe();
      const create = http.expectOne(`${base}/inventory/landed-costs`);
      expect(create.request.method).toBe('POST');
      expect(create.request.body).toEqual(payload);
      create.flush({ id: 'lc-2', status: 'draft' }, { status: 201, statusText: 'Created' });

      let preview: unknown;
      api.previewLandedCost(payload).subscribe((r) => (preview = r));
      const prev = http.expectOne(`${base}/inventory/landed-costs/preview`);
      expect(prev.request.method).toBe('POST');
      prev.flush({ allocations: [], totals: { allocated: '300.00', difference: '0.00' } });
      expect(preview).toEqual({ allocations: [], totals: { allocated: '300.00', difference: '0.00' } });
    });

    it('applies and reverses documents', () => {
      api.applyLandedCost('lc-1').subscribe();
      const apply = http.expectOne(`${base}/inventory/landed-costs/lc-1/apply`);
      expect(apply.request.method).toBe('POST');
      apply.flush({ id: 'lc-1', status: 'applied' });

      api.reverseLandedCost('lc-1', { reason: 'Wrong freight invoice' }).subscribe();
      const reverse = http.expectOne(`${base}/inventory/landed-costs/lc-1/reverse`);
      expect(reverse.request.method).toBe('POST');
      expect(reverse.request.body).toEqual({ reason: 'Wrong freight invoice' });
      reverse.flush({ id: 'lc-3', status: 'applied', reversal_of_id: 'lc-1' });
    });
  });

  describe('inventory book', () => {
    it('GETs the book as JSON with year / as_of / warehouse', () => {
      api.getBook({ year: 2026, as_of: '2026-12-31', warehouse_id: 'w-1' }).subscribe();
      const req = http.expectOne((r) => r.url === `${base}/inventory/book`);
      expect(req.request.params.get('year')).toBe('2026');
      expect(req.request.params.get('as_of')).toBe('2026-12-31');
      expect(req.request.params.get('warehouse_id')).toBe('w-1');
      expect(req.request.params.get('format')).toBe('json');
      req.flush({ meta: {}, rows: [], totals: {}, reconciliation: {} });
    });

    it('downloads the CSV as a blob using the Content-Disposition filename', () => {
      let file: DownloadedFile | undefined;
      api.downloadBookCsv({ year: 2026 }).subscribe((f) => (file = f));
      const req = http.expectOne((r) => r.url === `${base}/inventory/book`);
      expect(req.request.params.get('format')).toBe('csv');
      expect(req.request.responseType).toBe('blob');
      req.flush(new Blob(['sku;name'], { type: 'text/csv' }), {
        headers: { 'Content-Disposition': 'attachment; filename="book-2026-final.csv"' },
      });
      expect(file?.filename).toBe('book-2026-final.csv');
      expect(file?.blob).toBeInstanceOf(Blob);
    });

    it('falls back to inventory-book-{year}.csv without Content-Disposition', () => {
      let file: DownloadedFile | undefined;
      api.downloadBookCsv({ year: 2025 }).subscribe((f) => (file = f));
      http.expectOne((r) => r.url === `${base}/inventory/book`).flush(new Blob(['x']));
      expect(file?.filename).toBe('inventory-book-2025.csv');
    });

    it('creates, lists and downloads exports', () => {
      api.createBookExport(2026).subscribe();
      const create = http.expectOne(`${base}/inventory/book/exports`);
      expect(create.request.method).toBe('POST');
      expect(create.request.body).toEqual({ year: 2026 });
      create.flush({ data: { id: 'x-1', year: 2026, status: 'completed' } });

      api.listBookExports({ page: 1 }).subscribe();
      const list = http.expectOne((r) => r.url === `${base}/inventory/book/exports`);
      expect(list.request.method).toBe('GET');
      list.flush({ data: [] });

      api.downloadBookExport({ id: 'x-1', year: 2026 }).subscribe();
      const dl = http.expectOne(`${base}/inventory/book/exports/x-1/download`);
      expect(dl.request.responseType).toBe('blob');
      dl.flush(new Blob(['x']));
    });
  });

  it('looks up goods receipts on the procurement endpoint', () => {
    api.listGoodsReceipts({ per_page: 100 }).subscribe();
    const req = http.expectOne((r) => r.url === `${base}/procurement/goods-receipts`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('per_page')).toBe('100');
    req.flush({ data: [{ id: 'r-1', receipt_number: 'GR-1' }], meta: { total: 1 } });
  });

  it('looks up warehouses and items', () => {
    api.listWarehouses().subscribe();
    http.expectOne((r) => r.url === `${base}/inventory/warehouses`).flush({ data: [] });
    api.searchItems('bolt').subscribe();
    const items = http.expectOne((r) => r.url === `${base}/inventory/items`);
    expect(items.request.params.get('search')).toBe('bolt');
    items.flush({ data: [] });
  });
});

describe('inventory response helpers', () => {
  it('unwrapInventoryData accepts bare resources, {data} and {success,message,data}', () => {
    expect(unwrapInventoryData({ id: 'a' })).toEqual({ id: 'a' });
    expect(unwrapInventoryData({ data: { id: 'a' } })).toEqual({ id: 'a' });
    expect(unwrapInventoryData({ success: true, message: 'ok', data: { id: 'a' } })).toEqual({ id: 'a' });
    expect(unwrapInventoryData({ meta: { year: 2026 }, rows: [] })).toEqual({ meta: { year: 2026 }, rows: [] });
  });

  it('toInventoryPage normalises arrays and envelopes', () => {
    expect(toInventoryPage([{ id: 1 }]).meta.total).toBe(1);
    expect(toInventoryPage({ data: [], meta: { total: 7 } }).meta.total).toBe(7);
    expect(toInventoryPage(null).data).toEqual([]);
  });

  it('filenameFromDisposition parses plain and RFC 5987 filenames', () => {
    expect(filenameFromDisposition('attachment; filename=a.csv', 'x')).toBe('a.csv');
    expect(filenameFromDisposition("attachment; filename*=UTF-8''inventario%202026.csv", 'x')).toBe(
      'inventario 2026.csv',
    );
    expect(filenameFromDisposition(null, 'fallback.csv')).toBe('fallback.csv');
  });
});
