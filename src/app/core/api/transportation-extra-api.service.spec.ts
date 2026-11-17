import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { environment } from '@env';
import { TransportationExtraApiService } from './transportation-extra-api.service';

describe('TransportationExtraApiService', () => {
  let api: TransportationExtraApiService;
  let http: HttpTestingController;
  const base = `${environment.apiBaseUrl}/transportation`;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(TransportationExtraApiService);
    http = TestBed.inject(HttpTestingController);
  });

  function expectCall(method: string, path: string, body?: unknown): void {
    const req = http.expectOne((r) => r.url === `${base}${path}`);
    expect(req.request.method).toBe(method);
    if (body !== undefined) {
      expect(req.request.body).toEqual(body);
    }
    req.flush(req.request.responseType === 'blob' ? new Blob(['x']) : { data: {} });
  }

  it('calculates rates and manages carriers and tariffs', () => {
    api.calculateRate({ carrier_id: 'c', weight_kg: 10 }).subscribe();
    expectCall('POST', '/rates/calculate');
    api.getCarriers().subscribe();
    expectCall('GET', '/carriers');
    api.createCarrier({ code: 'C', name: 'N' }).subscribe();
    expectCall('POST', '/carriers');
    api.updateCarrier('c1', { name: 'M' }).subscribe();
    expectCall('PUT', '/carriers/c1', { name: 'M' });
    api.deleteCarrier('c1').subscribe();
    expectCall('DELETE', '/carriers/c1');
    api.createTariffTable({ carrier_id: 'c', name: 'T', valid_from: '2026-01-01' }).subscribe();
    expectCall('POST', '/tariff-tables');
    api.updateTariffTable('t1', { name: 'U' }).subscribe();
    expectCall('PUT', '/tariff-tables/t1', { name: 'U' });
    api.deleteTariffTable('t1').subscribe();
    expectCall('DELETE', '/tariff-tables/t1');
    api.getTariffBand('b1').subscribe();
    expectCall('GET', '/tariff-bands/b1');
  });

  it('manages trips and transport orders', () => {
    api.getTrips().subscribe();
    expectCall('GET', '/trips');
    api.createTrip({ notes: 'n' }).subscribe();
    expectCall('POST', '/trips', { notes: 'n' });
    api.updateTrip('t1', { notes: 'm' }).subscribe();
    expectCall('PUT', '/trips/t1', { notes: 'm' });
    api.deleteTrip('t1').subscribe();
    expectCall('DELETE', '/trips/t1');
    api.addTripOrders('t1', ['o1']).subscribe();
    expectCall('POST', '/trips/t1/orders', { order_ids: ['o1'] });
    api.removeTripOrder('t1', 'o1').subscribe();
    expectCall('DELETE', '/trips/t1/orders/o1');
    api.getTransportOrders().subscribe();
    expectCall('GET', '/transport-orders');
    api.createTransportOrder({ origin_name: 'a', origin_location: 'b', destination_name: 'c', destination_location: 'd', weight_kg: 5 }).subscribe();
    expectCall('POST', '/transport-orders');
    api.updateTransportOrder('o1', { notes: 'x' }).subscribe();
    expectCall('PUT', '/transport-orders/o1', { notes: 'x' });
    api.deleteTransportOrder('o1').subscribe();
    expectCall('DELETE', '/transport-orders/o1');
    api.assignCarrier('o1', 'c1', 12).subscribe();
    expectCall('POST', '/transport-orders/o1/assign-carrier', { carrier_id: 'c1', expected_cost: 12 });
  });

  it('manages quotes, tracking and freight invoices', () => {
    api.getQuotes().subscribe();
    expectCall('GET', '/quotes');
    api.getQuote('q1').subscribe();
    expectCall('GET', '/quotes/q1');
    api.createQuote({ weight_kg: 10 }).subscribe();
    expectCall('POST', '/quotes', { weight_kg: 10 });
    api.deleteQuote('q1').subscribe();
    expectCall('DELETE', '/quotes/q1');
    api.awardQuote('q1', 'c1').subscribe();
    expectCall('POST', '/quotes/q1/award', { carrier_id: 'c1' });
    api.getTrackingEvent('e1').subscribe();
    expectCall('GET', '/tracking-events/e1');
    api.getFreightInvoices().subscribe();
    expectCall('GET', '/freight-invoices');
    api.getFreightInvoice('f1').subscribe();
    expectCall('GET', '/freight-invoices/f1');
    api.createFreightInvoice({ carrier_id: 'c', invoice_number: '1', invoice_date: '2026-01-01' }).subscribe();
    expectCall('POST', '/freight-invoices');
    api.updateFreightInvoice('f1', { notes: 'n' }).subscribe();
    expectCall('PUT', '/freight-invoices/f1', { notes: 'n' });
    api.deleteFreightInvoice('f1').subscribe();
    expectCall('DELETE', '/freight-invoices/f1');
    api.auditFreightInvoice('f1', 5).subscribe();
    expectCall('POST', '/freight-invoices/f1/audit', { tolerance_percent: 5 });
    api.disputeFreightInvoice('f1', 'why').subscribe();
    expectCall('POST', '/freight-invoices/f1/dispute', { reason: 'why' });
    api.resolveFreightInvoiceDispute('f1', { resolution: 'accepted', note: 'ok' }).subscribe();
    expectCall('POST', '/freight-invoices/f1/resolve-dispute', { resolution: 'accepted', note: 'ok' });
  });
});
