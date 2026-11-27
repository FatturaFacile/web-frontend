import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { environment } from '@env';
import { SubcontractingApiService } from './subcontracting-api.service';

describe('SubcontractingApiService', () => {
  let api: SubcontractingApiService;
  let http: HttpTestingController;
  const base = `${environment.apiBaseUrl}/subcontracting`;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(SubcontractingApiService);
    http = TestBed.inject(HttpTestingController);
  });

  it('reads the dashboard and the register with the filters as query parameters, dropping the empty ones', () => {
    api.getDashboard({ direction: 'active', deadline_status: 'expired', lot_id: '' }).subscribe();
    const dashboard = http.expectOne((req) => req.url === `${base}/dashboard`);
    expect(dashboard.request.method).toBe('GET');
    expect(dashboard.request.params.get('direction')).toBe('active');
    expect(dashboard.request.params.get('deadline_status')).toBe('expired');
    expect(dashboard.request.params.has('lot_id')).toBe(false);
    dashboard.flush({ success: true, message: '', data: {} });

    api.getRegister({ movement_type: 'outbound_dispatch', from: '2026-01-01', page: 2 }).subscribe();
    const register = http.expectOne((req) => req.url === `${base}/register`);
    expect(register.request.params.get('movement_type')).toBe('outbound_dispatch');
    expect(register.request.params.get('from')).toBe('2026-01-01');
    expect(register.request.params.get('page')).toBe('2');
    register.flush({ success: true, message: '', data: [] });
  });

  it('downloads the register as a blob in the chosen format', () => {
    api.exportRegister('xlsx', { direction: 'passive' }).subscribe();

    const request = http.expectOne((req) => req.url === `${base}/register/export/xlsx`);
    expect(request.request.responseType).toBe('blob');
    expect(request.request.params.get('direction')).toBe('passive');
    request.flush(new Blob(['x']));
  });

  it('reads the TPP / TPA summary, filtered by regime when given', () => {
    api.getCrossBorder('tpp_outward_processing').subscribe();
    const filtered = http.expectOne((req) => req.url === `${base}/cross-border`);
    expect(filtered.request.params.get('customs_regime')).toBe('tpp_outward_processing');
    filtered.flush({ success: true, message: '', data: { regimes: [], orders: [] } });

    api.getCrossBorder().subscribe();
    const all = http.expectOne((req) => req.url === `${base}/cross-border`);
    expect(all.request.params.has('customs_regime')).toBe(false);
    all.flush({ success: true, message: '', data: { regimes: [], orders: [] } });
  });

  it('lists, reads, creates, confirms and cancels the orders', () => {
    api.listOrders({ direction: 'passive', per_page: 25 }).subscribe();
    const list = http.expectOne((req) => req.url === `${base}/orders`);
    expect(list.request.params.get('direction')).toBe('passive');
    list.flush({ success: true, message: '', data: [] });

    api.getOrder('o1').subscribe();
    expect(http.expectOne(`${base}/orders/o1`).request.method).toBe('GET');

    const payload = {
      direction: 'passive' as const,
      subcontracting_type: 'full_bom' as const,
      partner_id: 'v1',
      output_product_id: 'p1',
      planned_quantity: '10',
    };
    api.createOrder(payload).subscribe();
    const created = http.expectOne(`${base}/orders`);
    expect(created.request.method).toBe('POST');
    expect(created.request.body).toEqual(payload);

    api.confirmOrder('o1').subscribe();
    expect(http.expectOne(`${base}/orders/o1/confirm`).request.method).toBe('POST');
    api.cancelOrder('o1').subscribe();
    expect(http.expectOne(`${base}/orders/o1/cancel`).request.method).toBe('POST');
  });

  it('posts the passive flow: dispatch, receipt preview, receipt and return of the unused material', () => {
    api.dispatchMaterials('o1', { lines: [{ component_id: 'c1', quantity: '12' }] }).subscribe();
    const dispatch = http.expectOne(`${base}/orders/o1/dispatch`);
    expect(dispatch.request.body).toEqual({ lines: [{ component_id: 'c1', quantity: '12' }] });

    const receipt = { good_quantity: '8', scrap_quantity: '2', components: [{ component_id: 'c1', consumed_qty: '16' }] };
    api.previewReceipt('o1', receipt).subscribe();
    expect(http.expectOne(`${base}/orders/o1/receive-preview`).request.body).toEqual(receipt);
    api.receiveGoods('o1', receipt).subscribe();
    expect(http.expectOne(`${base}/orders/o1/receive`).request.body).toEqual(receipt);

    api.returnUnused('o1').subscribe();
    const returned = http.expectOne(`${base}/orders/o1/return-unused`);
    expect(returned.request.method).toBe('POST');
    expect(returned.request.body).toEqual({});
  });

  it('posts the active flow: customer material, production and delivery', () => {
    api.receiveCustomerMaterials('o1', { customer_ddt_number: 'CL-901' }).subscribe();
    expect(http.expectOne(`${base}/orders/o1/receive-customer-materials`).request.body).toEqual({
      customer_ddt_number: 'CL-901',
    });

    api.recordProduction('o1', { good_quantity: '9', production_order_id: 'mo1' }).subscribe();
    expect(http.expectOne(`${base}/orders/o1/production`).request.body).toEqual({
      good_quantity: '9',
      production_order_id: 'mo1',
    });

    api.deliverGoods('o1', { quantity: '9', return_unused_materials: true }).subscribe();
    expect(http.expectOne(`${base}/orders/o1/deliver`).request.body).toEqual({
      quantity: '9',
      return_unused_materials: true,
    });
  });

  it('reads the lookups', () => {
    api.getLookups().subscribe();
    expect(http.expectOne(`${base}/lookups`).request.method).toBe('GET');
  });
});
