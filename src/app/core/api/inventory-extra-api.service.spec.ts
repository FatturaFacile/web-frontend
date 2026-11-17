import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { environment } from '@env';
import { InventoryExtraApiService } from './inventory-extra-api.service';

describe('InventoryExtraApiService', () => {
  let service: InventoryExtraApiService;
  let http: HttpTestingController;
  const base = `${environment.apiBaseUrl}/inventory`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [InventoryExtraApiService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(InventoryExtraApiService);
    http = TestBed.inject(HttpTestingController);
  });

  it('manages stock items', () => {
    service.getItems({ search: 'a' }).subscribe();
    expect(http.expectOne((r) => r.url === `${base}/items` && r.params.get('search') === 'a').request.method).toBe('GET');
    service.getItem('1').subscribe();
    expect(http.expectOne(`${base}/items/1`).request.method).toBe('GET');
    service.createItem({ category_id: 'c', sku: 's', name: 'n', uom: 'PZ', tracking_type: 'none' }).subscribe();
    expect(http.expectOne(`${base}/items`).request.method).toBe('POST');
    service.updateItem('1', { name: 'x' }).subscribe();
    expect(http.expectOne(`${base}/items/1`).request.method).toBe('PUT');
    service.deleteItem('1').subscribe();
    expect(http.expectOne(`${base}/items/1`).request.method).toBe('DELETE');
  });

  it('manages product variants and labels', () => {
    service.getProductVariants('p').subscribe();
    expect(http.expectOne(`${base}/products/p/variants`).request.method).toBe('GET');
    service.generateProductVariants('p', {}).subscribe();
    expect(http.expectOne(`${base}/products/p/variants/generate`).request.method).toBe('POST');
    service.updateProductVariant('v', {}).subscribe();
    expect(http.expectOne(`${base}/products/variants/v`).request.method).toBe('PUT');
    service.printLabels({}).subscribe();
    expect(http.expectOne(`${base}/labels/print`).request.responseType).toBe('blob');
    service.lookupBarcode('123').subscribe();
    expect(
      http.expectOne((r) => r.url === `${base}/barcode/lookup` && r.params.get('code') === '123').request.method,
    ).toBe('GET');
  });

  it('handles lots and reservations', () => {
    service.quarantineLot('l', { reason: 'r' }).subscribe();
    expect(http.expectOne(`${base}/lots/l/quarantine`).request.body).toEqual({ reason: 'r' });
    service.updateLot('l', {}).subscribe();
    expect(http.expectOne(`${base}/lots/l`).request.method).toBe('PATCH');
    service.recallLot('l').subscribe();
    expect(http.expectOne(`${base}/lots/l/recall`).request.method).toBe('POST');
    service.releaseReservation('r').subscribe();
    expect(http.expectOne(`${base}/reservations/r/release`).request.method).toBe('POST');
    service.reserveSalesOrder('o').subscribe();
    expect(http.expectOne(`${base}/sales-orders/o/reserve`).request.method).toBe('POST');
  });

  it('covers valuation, landed costs and book', () => {
    service.updateValuationItem('i', { standard_cost: 1 }).subscribe();
    expect(http.expectOne(`${base}/valuation/items/i`).request.method).toBe('PUT');
    service.reverseLandedCost('d', 'errore').subscribe();
    expect(http.expectOne(`${base}/landed-costs/d/reverse`).request.body).toEqual({ reason: 'errore' });
    service.getInventoryBook({ year: 2025, format: 'json' }).subscribe();
    expect(http.expectOne((r) => r.url === `${base}/book` && r.params.get('year') === '2025').request.method).toBe('GET');
    service.downloadInventoryBookExport('e').subscribe();
    expect(http.expectOne(`${base}/book/exports/e/download`).request.responseType).toBe('blob');
  });

  it('covers putaway, cycle count, replenishment and product charges', () => {
    service.deletePutawayRule('p').subscribe();
    expect(http.expectOne(`${base}/putaway-rules/p`).request.method).toBe('DELETE');
    service.runDueCycleCountPlans().subscribe();
    expect(http.expectOne(`${base}/cycle-count-plans/run-due`).request.method).toBe('POST');
    service.updateReorderRule('r', {}).subscribe();
    expect(http.expectOne(`${base}/reorder-rules/r`).request.method).toBe('PUT');
    service.previewProductCharge({}).subscribe();
    expect(http.expectOne(`${environment.apiBaseUrl}/invoicing/product-charges/preview`).request.method).toBe('POST');
    http.verify();
  });
});
