import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '@env';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TEST_API_BASE_URL } from '../../../testing/api';
import { PurchaseOrderFulfilmentApiService } from './purchase-order-fulfilment-api.service';

describe('PurchaseOrderFulfilmentApiService', () => {
  const base = `${TEST_API_BASE_URL}/procurement`;
  const originalApiBaseUrl = environment.apiBaseUrl;
  let api: PurchaseOrderFulfilmentApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    environment.apiBaseUrl = TEST_API_BASE_URL;
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(PurchaseOrderFulfilmentApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    environment.apiBaseUrl = originalApiBaseUrl;
  });

  it('dispatches an order through a channel', () => {
    let channel = '';
    api.dispatch('po-1', { channel: 'peppol', recipient: 'a@b.test' }).subscribe((d) => (channel = d.channel));
    const req = http.expectOne(`${base}/purchase-orders/po-1/dispatch`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ channel: 'peppol', recipient: 'a@b.test' });
    req.flush({ id: 'd-1', channel: 'peppol' });
    expect(channel).toBe('peppol');
  });

  it('unwraps the dispatch, confirmation and reminder collections', () => {
    const results: number[] = [];
    api.listDispatches('po-1').subscribe((r) => results.push(r.length));
    api.listConfirmations('po-1').subscribe((r) => results.push(r.length));
    api.listReminders('po-1').subscribe((r) => results.push(r.length));
    http.expectOne(`${base}/purchase-orders/po-1/dispatches`).flush({ data: [{ id: 'a' }] });
    http.expectOne(`${base}/purchase-orders/po-1/confirmations`).flush({ data: [{ id: 'a' }, { id: 'b' }] });
    http.expectOne(`${base}/purchase-orders/po-1/reminders`).flush({ data: [] });
    expect(results).toEqual([1, 2, 0]);
  });

  it('records a confirmation with line variances', () => {
    api
      .recordConfirmation('po-1', {
        confirmation_number: 'C-1',
        lines: [{ purchase_order_line_id: 'l-1', confirmed_quantity: 8, confirmed_unit_price: 5.5 }],
      })
      .subscribe();
    const req = http.expectOne(`${base}/purchase-orders/po-1/confirmations`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body.lines[0].confirmed_quantity).toBe(8);
    req.flush({ id: 'c-1' });
  });

  it('lists overdue orders, sends a reminder and runs the due reminders', () => {
    let rows = 0;
    let sent = -1;
    api.listOverdue().subscribe((r) => (rows = r.length));
    http.expectOne(`${base}/purchase-orders/overdue`).flush({ data: [{ order: { id: 'po-1' } }] });

    api.sendReminder('po-1').subscribe();
    const reminder = http.expectOne(`${base}/purchase-orders/po-1/reminders`);
    expect(reminder.request.method).toBe('POST');
    reminder.flush({ id: 'r-1' });

    api.runReminders().subscribe((n) => (sent = n));
    http.expectOne(`${base}/purchase-orders/reminders/run`).flush({ sent: 3 });
    expect(rows).toBe(1);
    expect(sent).toBe(3);
  });

  it('previews pricing and unwraps the data envelope', () => {
    let net = '';
    api.pricingPreview({ quantity: 10, unit_price: 100, discount_cascade: [10, 5] }).subscribe((p) => (net = p.line_net_amount));
    const req = http.expectOne(`${base}/purchase-orders/pricing-preview`);
    expect(req.request.body.discount_cascade).toEqual([10, 5]);
    req.flush({ data: { line_net_amount: '855.00' } });
    expect(net).toBe('855.00');
  });

  it('covers the dropshipment list, detail, creation and DDT endpoints', () => {
    api.listDropshipments({ status: 'pending', page: 2 }).subscribe();
    const list = http.expectOne((r) => r.url === `${base}/dropshipments`);
    expect(list.request.params.get('status')).toBe('pending');
    list.flush({ data: [], meta: { total: 0 } });

    api.getDropshipment('d-1').subscribe();
    http.expectOne(`${base}/dropshipments/d-1`).flush({ id: 'd-1' });

    api
      .createDropshipment({
        sales_order_id: 'so-1',
        supplier_id: 's-1',
        delivery_address: { street: 'Via Roma 1', postal_code: '20100', city: 'Milano', country_code: 'IT' },
      })
      .subscribe();
    const create = http.expectOne(`${base}/dropshipments`);
    expect(create.request.method).toBe('POST');
    expect(create.request.body.delivery_address.country_code).toBe('IT');
    create.flush({ id: 'd-2' });

    api.issueDdt('d-1', { carrier: 'DHL' }).subscribe();
    const ddt = http.expectOne(`${base}/dropshipments/d-1/ddt`);
    expect(ddt.request.method).toBe('POST');
    ddt.flush({ id: 'd-1' });
  });

  it('records a dropshipment delivery', () => {
    api.recordDelivery('d-1', { delivery_proof_reference: 'POD-9' }).subscribe();
    const req = http.expectOne(`${base}/dropshipments/d-1/deliveries`);
    expect(req.request.body.delivery_proof_reference).toBe('POD-9');
    req.flush({ id: 'd-1' });
  });
});
