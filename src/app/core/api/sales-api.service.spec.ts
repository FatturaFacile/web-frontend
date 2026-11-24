import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { environment } from '@env';
import { SalesApiService } from './sales-api.service';
import { CreateDeliveryNotePayload, CreateSalesOrderPayload, CreateSalesQuotePayload } from '../models';

describe('SalesApiService', () => {
  let service: SalesApiService;
  let httpTesting: HttpTestingController;
  const baseUrl = environment.apiBaseUrl;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [SalesApiService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(SalesApiService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  describe('Sales Quotes', () => {
    it('fetches quotes list with status filter', () => {
      service.getQuotes({ status: 'approved' }).subscribe((res) => {
        expect(res.data.length).toBe(1);
        expect(res.data[0].quote_number).toBe('QUO-2026-001');
      });

      const req = httpTesting.expectOne(
        (r) => r.url === `${baseUrl}/invoicing/quotes` && r.params.get('status') === 'approved',
      );
      expect(req.request.method).toBe('GET');
      req.flush({ success: true, data: [{ id: 'q-1', quote_number: 'QUO-2026-001' }] });
    });

    it('creates quote', () => {
      const payload: CreateSalesQuotePayload = {
        contact_id: 'c-1',
        currency: 'EUR',
        items: [{ description: 'Dev Service', quantity: 10, unit_price: 80, tax_rate: 22 }],
      };

      service.createQuote(payload).subscribe((res) => {
        expect(res.data.id).toBe('q-2');
      });

      const req = httpTesting.expectOne(`${baseUrl}/invoicing/quotes`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(payload);
      req.flush({ success: true, data: { id: 'q-2', ...payload } });
    });

    it('submits quote for approval, approves and converts to order', () => {
      service.submitQuoteForApproval('q-1').subscribe((res) => {
        expect(res.data.status).toBe('pending_approval');
      });
      const req1 = httpTesting.expectOne(`${baseUrl}/invoicing/quotes/q-1/submit-for-approval`);
      expect(req1.request.method).toBe('POST');
      req1.flush({ success: true, data: { id: 'q-1', status: 'pending_approval' } });

      service.approveQuote('q-1').subscribe((res) => {
        expect(res.data.status).toBe('approved');
      });
      const req2 = httpTesting.expectOne(`${baseUrl}/invoicing/quotes/q-1/approve`);
      expect(req2.request.method).toBe('POST');
      req2.flush({ success: true, data: { id: 'q-1', status: 'approved' } });

      service.convertQuoteToOrder('q-1').subscribe((res) => {
        expect(res.data.order_number).toBe('ORD-001');
      });
      const req3 = httpTesting.expectOne(`${baseUrl}/invoicing/quotes/q-1/convert`);
      expect(req3.request.method).toBe('POST');
      req3.flush({ success: true, data: { id: 'ord-1', order_number: 'ORD-001' } });
    });
  });

  describe('Sales Orders', () => {
    it('fetches orders and reserves stock', () => {
      service.getOrders({ status: 'confirmed' }).subscribe((res) => {
        expect(res.data.length).toBe(1);
      });

      const req1 = httpTesting.expectOne(
        (r) => r.url === `${baseUrl}/invoicing/orders` && r.params.get('status') === 'confirmed',
      );
      expect(req1.request.method).toBe('GET');
      req1.flush({ success: true, data: [{ id: 'ord-1', order_number: 'ORD-001' }] });

      service.reserveOrderStock('ord-1').subscribe((res) => {
        expect(res.data.is_stock_reserved).toBe(true);
      });

      const req2 = httpTesting.expectOne(`${baseUrl}/invoicing/orders/ord-1/reserve`);
      expect(req2.request.method).toBe('POST');
      req2.flush({ success: true, data: { id: 'ord-1', is_stock_reserved: true } });
    });

    it('creates sales order and triggers invoice generation', () => {
      const payload: CreateSalesOrderPayload = {
        contact_id: 'c-1',
        date: '2026-11-09',
        currency: 'CHF',
        items: [{ description: 'Swiss Consultation', quantity: 2, unit_price: 150, tax_rate: 8.1 }],
      };

      service.createOrder(payload).subscribe((res) => {
        expect(res.data.id).toBe('ord-2');
      });

      const req1 = httpTesting.expectOne(`${baseUrl}/invoicing/orders`);
      expect(req1.request.method).toBe('POST');
      req1.flush({ success: true, data: { id: 'ord-2', order_number: 'ORD-002', ...payload } });

      service.invoiceOrder('ord-2').subscribe((res) => {
        expect(res.success).toBe(true);
      });

      const req2 = httpTesting.expectOne(`${baseUrl}/invoicing/invoices/from-order/ord-2`);
      expect(req2.request.method).toBe('POST');
      req2.flush({ success: true, data: { invoice_id: 'inv-100' } });
    });
  });

  describe('Delivery Notes (DDT)', () => {
    it('fetches delivery notes, dispatches and invoices', () => {
      service.getDeliveryNotes().subscribe((res) => {
        expect(res.data.length).toBe(1);
      });

      const req1 = httpTesting.expectOne(`${baseUrl}/invoicing/delivery-notes`);
      expect(req1.request.method).toBe('GET');
      req1.flush({ success: true, data: [{ id: 'ddt-1', ddt_number: 'DDT-2026-001' }] });

      service.dispatchDeliveryNote('ddt-1').subscribe((res) => {
        expect(res.data.status).toBe('dispatched');
      });

      const req2 = httpTesting.expectOne(`${baseUrl}/invoicing/delivery-notes/ddt-1/dispatch`);
      expect(req2.request.method).toBe('POST');
      req2.flush({ success: true, data: { id: 'ddt-1', status: 'dispatched' } });

      service.invoiceDeliveryNote('ddt-1').subscribe((res) => {
        expect(res.success).toBe(true);
      });

      const req3 = httpTesting.expectOne(`${baseUrl}/invoicing/invoices/from-delivery/ddt-1`);
      expect(req3.request.method).toBe('POST');
      req3.flush({ success: true, data: { invoice_id: 'inv-101' } });
    });

    it('creates delivery note', () => {
      const payload: CreateDeliveryNotePayload = {
        sales_order_id: 'ord-1',
        transport_reason: 'Vendita',
        packages_count: 2,
        gross_weight_kg: 15.5,
        carrier_name: 'DHL Express',
        items: [{ sales_order_item_id: 'so-line-1', quantity: 5 }],
      };

      service.createDeliveryNote(payload).subscribe((res) => {
        expect(res.data.ddt_number).toBe('DDT-2026-002');
      });

      const req = httpTesting.expectOne(`${baseUrl}/invoicing/delivery-notes`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(payload);
      req.flush({ success: true, data: { id: 'ddt-2', ddt_number: 'DDT-2026-002', ...payload } });
    });
  });
});
