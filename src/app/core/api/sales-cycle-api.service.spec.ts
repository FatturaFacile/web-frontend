import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SalesCycleApiService } from './sales-cycle-api.service';

interface Case {
  name: string;
  call: (s: SalesCycleApiService) => Observable<unknown>;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  body?: unknown;
  params?: Record<string, string>;
}

const quotePayload = {
  contact_id: 'c1',
  date: '2026-11-09',
  currency: 'EUR',
  items: [{ description: 'Item', quantity: '2', unit_price: '10.50', tax_rate: '22' }],
};

const cases: Case[] = [
  { name: 'getQuotes', call: (s) => s.getQuotes({ status: 'draft' }), method: 'GET', path: '/sales/quotes', params: { status: 'draft' } },
  { name: 'getQuote', call: (s) => s.getQuote('q1'), method: 'GET', path: '/sales/quotes/q1' },
  { name: 'createQuote', call: (s) => s.createQuote(quotePayload), method: 'POST', path: '/sales/quotes', body: quotePayload },
  { name: 'updateQuote', call: (s) => s.updateQuote('q1', quotePayload), method: 'PUT', path: '/sales/quotes/q1', body: quotePayload },
  { name: 'deleteQuote', call: (s) => s.deleteQuote('q1'), method: 'DELETE', path: '/sales/quotes/q1' },
  { name: 'convertQuoteToOrder', call: (s) => s.convertQuoteToOrder('q1'), method: 'POST', path: '/sales/quotes/q1/convert-to-order', body: {} },
  { name: 'invoiceQuote', call: (s) => s.invoiceQuote('q1'), method: 'POST', path: '/sales/quotes/q1/invoice', body: {} },
  {
    name: 'createDeliveryNoteFromQuote',
    call: (s) => s.createDeliveryNoteFromQuote('q1', { transport_by: 'carrier', tracking_number: 'T1' }),
    method: 'POST',
    path: '/sales/quotes/q1/delivery-note',
    body: { transport_by: 'carrier', tracking_number: 'T1' },
  },
  {
    name: 'signQuote',
    call: (s) => s.signQuote('q1', { signed_by: 'Mario', signature_base64: 'abc' }),
    method: 'POST',
    path: '/sales/quotes/q1/signature',
    body: { signed_by: 'Mario', signature_base64: 'abc' },
  },
  { name: 'expireQuotes', call: (s) => s.expireQuotes(), method: 'POST', path: '/sales/quotes/expire', body: {} },
  { name: 'reviseQuote', call: (s) => s.reviseQuote('q1', { notes: 'v2' }), method: 'POST', path: '/sales/quotes/q1/revise', body: { notes: 'v2' } },
  { name: 'getOrders', call: (s) => s.getOrders({ status: 'on_hold' }), method: 'GET', path: '/sales/orders', params: { status: 'on_hold' } },
  { name: 'getOrder', call: (s) => s.getOrder('o1'), method: 'GET', path: '/sales/orders/o1' },
  { name: 'createOrder', call: (s) => s.createOrder(quotePayload), method: 'POST', path: '/sales/orders', body: quotePayload },
  { name: 'updateOrder', call: (s) => s.updateOrder('o1', quotePayload), method: 'PUT', path: '/sales/orders/o1', body: quotePayload },
  { name: 'deleteOrder', call: (s) => s.deleteOrder('o1'), method: 'DELETE', path: '/sales/orders/o1' },
  { name: 'confirmOrder', call: (s) => s.confirmOrder('o1'), method: 'POST', path: '/sales/orders/o1/confirm', body: {} },
  { name: 'cancelOrder', call: (s) => s.cancelOrder('o1', 'No stock'), method: 'POST', path: '/sales/orders/o1/cancel', body: { reason: 'No stock' } },
  { name: 'getOrderAvailability', call: (s) => s.getOrderAvailability('o1', 'w1'), method: 'GET', path: '/sales/orders/o1/availability', params: { warehouse_id: 'w1' } },
  { name: 'reserveOrder', call: (s) => s.reserveOrder('o1', 'w1'), method: 'POST', path: '/sales/orders/o1/reserve', body: { warehouse_id: 'w1' } },
  {
    name: 'createDeliveryNoteFromOrder',
    call: (s) => s.createDeliveryNoteFromOrder('o1', { lines: [{ sales_order_item_id: 'i1', quantity: '3' }] }),
    method: 'POST',
    path: '/sales/orders/o1/delivery-notes',
    body: { lines: [{ sales_order_item_id: 'i1', quantity: '3' }] },
  },
  { name: 'invoiceOrder', call: (s) => s.invoiceOrder('o1'), method: 'POST', path: '/sales/orders/o1/invoice', body: {} },
  { name: 'createOrderDepositInvoice', call: (s) => s.createOrderDepositInvoice('o1', '30'), method: 'POST', path: '/sales/orders/o1/deposit-invoice', body: { percentage: '30' } },
  { name: 'getBackorders', call: (s) => s.getBackorders({ product_id: 'p1' }), method: 'GET', path: '/sales/backorders', params: { product_id: 'p1' } },
  { name: 'getOrderLines', call: (s) => s.getOrderLines({ open: true }), method: 'GET', path: '/sales/order-lines', params: { open: 'true' } },
  { name: 'getKpis', call: (s) => s.getKpis({ from: '2026-01-01', to: '2026-12-31' }), method: 'GET', path: '/sales/kpis', params: { from: '2026-01-01', to: '2026-12-31' } },
  { name: 'getDeliveryNotes', call: (s) => s.getDeliveryNotes({ page: 2 }), method: 'GET', path: '/sales/delivery-notes', params: { page: '2' } },
  { name: 'getDeliveryNote', call: (s) => s.getDeliveryNote('d1'), method: 'GET', path: '/sales/delivery-notes/d1' },
  { name: 'deleteDeliveryNote', call: (s) => s.deleteDeliveryNote('d1'), method: 'DELETE', path: '/sales/delivery-notes/d1' },
  { name: 'invoiceDeliveryNote', call: (s) => s.invoiceDeliveryNote('d1'), method: 'POST', path: '/sales/delivery-notes/d1/invoice', body: {} },
  { name: 'getReturns', call: (s) => s.getReturns({ status: 'requested' }), method: 'GET', path: '/sales/returns', params: { status: 'requested' } },
  { name: 'getReturn', call: (s) => s.getReturn('r1'), method: 'GET', path: '/sales/returns/r1' },
  {
    name: 'createReturn',
    call: (s) => s.createReturn({ reason: 'Broken', items: [{ quantity: '1' }] }),
    method: 'POST',
    path: '/sales/returns',
    body: { reason: 'Broken', items: [{ quantity: '1' }] },
  },
  { name: 'approveReturn', call: (s) => s.approveReturn('r1'), method: 'POST', path: '/sales/returns/r1/approve', body: {} },
  { name: 'rejectReturn', call: (s) => s.rejectReturn('r1', 'Out of terms'), method: 'POST', path: '/sales/returns/r1/reject', body: { reason: 'Out of terms' } },
  { name: 'cancelReturn', call: (s) => s.cancelReturn('r1'), method: 'POST', path: '/sales/returns/r1/cancel', body: {} },
  {
    name: 'receiveReturn',
    call: (s) => s.receiveReturn('r1', { items: [{ id: 'ri1', quantity_received: '1', condition: 'damaged', restock: false }] }),
    method: 'POST',
    path: '/sales/returns/r1/receive',
    body: { items: [{ id: 'ri1', quantity_received: '1', condition: 'damaged', restock: false }] },
  },
  { name: 'creditReturn', call: (s) => s.creditReturn('r1'), method: 'POST', path: '/sales/returns/r1/credit-note', body: {} },
  { name: 'getPrice', call: (s) => s.getPrice({ product_id: 'p1', quantity: '5' }), method: 'GET', path: '/sales/pricing/price', params: { product_id: 'p1', quantity: '5' } },
  { name: 'getDiscountPolicies', call: (s) => s.getDiscountPolicies(), method: 'GET', path: '/sales/discount-policies' },
  { name: 'getDiscountPolicy', call: (s) => s.getDiscountPolicy('dp1'), method: 'GET', path: '/sales/discount-policies/dp1' },
  {
    name: 'createDiscountPolicy',
    call: (s) => s.createDiscountPolicy({ code: 'VIP', name: 'VIP', discount_type: 'percentage', value: '5', priority: 10, is_stackable: false, auto_apply: true }),
    method: 'POST',
    path: '/sales/discount-policies',
    body: { code: 'VIP', name: 'VIP', discount_type: 'percentage', value: '5', priority: 10, is_stackable: false, auto_apply: true },
  },
  {
    name: 'updateDiscountPolicy',
    call: (s) => s.updateDiscountPolicy('dp1', { code: 'VIP', name: 'VIP', discount_type: 'fixed_amount', value: '5' }),
    method: 'PUT',
    path: '/sales/discount-policies/dp1',
    body: { code: 'VIP', name: 'VIP', discount_type: 'fixed_amount', value: '5' },
  },
  { name: 'deleteDiscountPolicy', call: (s) => s.deleteDiscountPolicy('dp1'), method: 'DELETE', path: '/sales/discount-policies/dp1' },
];

describe('SalesCycleApiService', () => {
  let service: SalesCycleApiService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [SalesCycleApiService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(SalesCycleApiService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it.each(cases)('$name calls $method $path', ({ call, method, path, body, params }) => {
    let result: unknown;
    call(service).subscribe((res) => (result = res));

    const req = httpTesting.expectOne((r) => r.url === `${environment.apiBaseUrl}${path}`);
    expect(req.request.method).toBe(method);
    for (const [key, value] of Object.entries(params ?? {})) {
      expect(req.request.params.get(key)).toBe(value);
    }
    if (body !== undefined) {
      expect(req.request.body).toEqual(body);
    }
    req.flush({ success: true, message: 'ok', data: { id: 'x' } });
    expect(result).toEqual({ success: true, message: 'ok', data: { id: 'x' } });
  });

  it('omits params when none are given', () => {
    service.getQuotes().subscribe();
    const req = httpTesting.expectOne(`${environment.apiBaseUrl}/sales/quotes`);
    expect(req.request.params.keys()).toEqual([]);
    req.flush({});
  });

  it('sends an empty body when reserving without a warehouse', () => {
    service.reserveOrder('o1').subscribe();
    const req = httpTesting.expectOne(`${environment.apiBaseUrl}/sales/orders/o1/reserve`);
    expect(req.request.body).toEqual({});
    req.flush({});
  });
});
