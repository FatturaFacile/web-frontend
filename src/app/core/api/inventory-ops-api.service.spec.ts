import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { environment } from '@env';
import { InventoryOpsApiService } from './inventory-ops-api.service';

describe('InventoryOpsApiService', () => {
  let service: InventoryOpsApiService;
  let http: HttpTestingController;
  const base = `${environment.apiBaseUrl}/inventory`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [InventoryOpsApiService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(InventoryOpsApiService);
    http = TestBed.inject(HttpTestingController);
  });

  it('drives pick lists, waves and terminal', () => {
    service.createPickList({ warehouse_id: 'w', items: [{ stock_item_id: 's', quantity: 1 }] }).subscribe();
    expect(http.expectOne(`${base}/pick-lists`).request.method).toBe('POST');
    service.confirmPickListLine('p', 'l').subscribe();
    expect(http.expectOne(`${base}/pick-lists/p/lines/l/confirm`).request.method).toBe('POST');
    service.shipPickList('p').subscribe();
    expect(http.expectOne(`${base}/pick-lists/p/ship`).request.method).toBe('POST');
    service.cancelWave('w').subscribe();
    expect(http.expectOne(`${base}/waves/w/cancel`).request.method).toBe('POST');
    service.terminalAction('pick', { a: 1 }).subscribe();
    expect(http.expectOne(`${base}/terminal/pick`).request.body).toEqual({ a: 1 });
  });

  it('handles transfer orders and structure', () => {
    service.transitionTransferOrder('t', 'receive').subscribe();
    expect(http.expectOne(`${base}/transfer-orders/t/receive`).request.method).toBe('POST');
    service.updateBin('b', {}).subscribe();
    expect(http.expectOne(`${base}/bins/b`).request.method).toBe('PATCH');
    service.getWarehouseZones('w').subscribe();
    expect(http.expectOne(`${base}/warehouses/w/zones`).request.method).toBe('GET');
  });

  it('handles shipping, safety sheets and weighbridge', () => {
    service.getShipmentLabel('s').subscribe();
    expect(http.expectOne(`${base}/shipments/s/label`).request.responseType).toBe('blob');
    service.downloadSafetySheetVersion('v').subscribe();
    expect(http.expectOne(`${base}/safety-sheets/versions/v/file`).request.responseType).toBe('blob');
    service.recordSecondWeighing('t', { weight: 1 }).subscribe();
    expect(http.expectOne(`${base}/weighbridge/tickets/t/second-weighing`).request.method).toBe('POST');
    service.getLatestWeighbridgeReading({ scale: 'a' }).subscribe();
    expect(
      http.expectOne((r) => r.url === `${base}/weighbridge/readings/latest` && r.params.get('scale') === 'a').request.method,
    ).toBe('GET');
  });

  it('handles repair orders and portal requests', () => {
    service.advanceRepairOrder('r', { status: 'repaired' }).subscribe();
    expect(http.expectOne(`${base}/repair-orders/r/status`).request.method).toBe('POST');
    service.recordSerialWarranty('s', {}).subscribe();
    expect(http.expectOne(`${base}/serials/s/warranty`).request.method).toBe('PUT');
    service.rejectPortalRequest('q', { reason: 'x' }).subscribe();
    expect(http.expectOne(`${base}/portal-requests/q/reject`).request.body).toEqual({ reason: 'x' });
    http.verify();
  });
});
