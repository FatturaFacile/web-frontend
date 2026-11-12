import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { environment } from '@env';
import { InventoryApiService } from './inventory-api.service';
import {
  CreateProductPayload,
  StoreInventoryAdjustmentPayload,
  StoreWarehousePayload,
  TransferStockPayload,
} from '../models';

describe('InventoryApiService', () => {
  let service: InventoryApiService;
  let httpTesting: HttpTestingController;
  const baseUrl = environment.apiBaseUrl;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [InventoryApiService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(InventoryApiService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  describe('Products', () => {
    it('fetches products list with filters', () => {
      service.getProducts({ page: 1, search: 'widget' }).subscribe((res) => {
        expect(res.data.length).toBe(1);
      });

      const req = httpTesting.expectOne(
        (r) => r.url === `${baseUrl}/inventory/products` && r.params.get('search') === 'widget',
      );
      expect(req.request.method).toBe('GET');
      req.flush({ success: true, data: [{ id: 'p-1', name: 'Widget' }] });
    });

    it('creates a product', () => {
      const payload: CreateProductPayload = {
        sku: 'WDG-01',
        name: 'Super Widget',
        unit_measure: 'PZ',
        cost_price: 9,
        sale_price: 15.5,
        tax_rate: 22,
      };

      service.createProduct(payload).subscribe((res) => {
        expect(res.data.sku).toBe('WDG-01');
      });

      const req = httpTesting.expectOne(`${baseUrl}/inventory/products`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(payload);
      req.flush({ success: true, data: { id: 'p-2', ...payload } });
    });

    it('updates a product', () => {
      service.updateProduct('p-1', { sale_price: 20 }).subscribe((res) => {
        expect(res.data.sale_price).toBe(20);
      });

      const req = httpTesting.expectOne(`${baseUrl}/inventory/products/p-1`);
      expect(req.request.method).toBe('PUT');
      req.flush({ success: true, data: { id: 'p-1', sale_price: 20 } });
    });

    it('deletes a product', () => {
      service.deleteProduct('p-1').subscribe((res) => {
        expect(res.success).toBe(true);
      });

      const req = httpTesting.expectOne(`${baseUrl}/inventory/products/p-1`);
      expect(req.request.method).toBe('DELETE');
      req.flush({ success: true, data: null });
    });
  });

  describe('Warehouses', () => {
    it('fetches warehouses', () => {
      service.getWarehouses({ is_active: true }).subscribe((res) => {
        expect(res.data.length).toBe(1);
      });

      const req = httpTesting.expectOne(
        (r) => r.url === `${baseUrl}/inventory/warehouses` && r.params.get('is_active') === 'true',
      );
      expect(req.request.method).toBe('GET');
      req.flush({ success: true, data: [{ id: 'w-1', name: 'Main Warehouse' }] });
    });

    it('creates a warehouse', () => {
      const payload: StoreWarehousePayload = {
        code: 'WH-02',
        name: 'Secondary Warehouse',
        type: 'standard',
        city: 'Lugano',
        country: 'CH',
      };

      service.createWarehouse(payload).subscribe((res) => {
        expect(res.data.code).toBe('WH-02');
      });

      const req = httpTesting.expectOne(`${baseUrl}/inventory/warehouses`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(payload);
      req.flush({ success: true, data: { id: 'w-2', ...payload } });
    });

    it('deletes a warehouse', () => {
      service.deleteWarehouse('w-1').subscribe((res) => {
        expect(res.success).toBe(true);
      });

      const req = httpTesting.expectOne(`${baseUrl}/inventory/warehouses/w-1`);
      expect(req.request.method).toBe('DELETE');
      req.flush({ success: true, data: null });
    });
  });

  describe('Stock Levels & Movements', () => {
    it('fetches stock levels', () => {
      service.getStockLevels('wh-1').subscribe((res) => {
        expect(res.data.length).toBe(1);
        expect(res.data[0].available).toBe(15);
      });

      const req = httpTesting.expectOne(
        (r) => r.url === `${baseUrl}/inventory/stock-levels` && r.params.get('warehouse_id') === 'wh-1',
      );
      expect(req.request.method).toBe('GET');
      req.flush({
        success: true,
        data: [{ product_id: 'p-1', sku: 'SKU-01', name: 'Item', quantity: 20, on_hand: 20, reserved: 5, available: 15, shortfall: 0 }],
      });
    });

    it('fetches stock movements with signed quantities', () => {
      service.getMovements({ warehouse_id: 'wh-1' }).subscribe((res) => {
        expect(res.data.length).toBe(1);
        expect(res.data[0].signed_quantity).toBe(-5);
      });

      const req = httpTesting.expectOne(
        (r) => r.url === `${baseUrl}/inventory/movements` && r.params.get('warehouse_id') === 'wh-1',
      );
      expect(req.request.method).toBe('GET');
      req.flush({
        success: true,
        data: [{ id: 'm-1', movement_type: 'SALES_DELIVERY', quantity: 5, signed_quantity: -5, unit_cost: 10 }],
      });
    });

    it('executes stock transfer', () => {
      const payload: TransferStockPayload = {
        stock_item_id: 'item-1',
        warehouse_id: 'wh-1',
        quantity: 10,
        movement_type: 'INTERNAL_TRANSFER',
        source_bin_id: 'bin-a',
        destination_bin_id: 'bin-b',
      };

      service.transferStock(payload).subscribe((res) => {
        expect(res.data.id).toBe('m-2');
      });

      const req = httpTesting.expectOne(`${baseUrl}/inventory/movements/transfer`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(payload);
      req.flush({ success: true, data: { id: 'm-2', ...payload } });
    });
  });

  describe('Adjustments & Counts', () => {
    it('fetches inventory adjustments and approves', () => {
      service.getAdjustments().subscribe((res) => {
        expect(res.data.length).toBe(1);
      });

      const req1 = httpTesting.expectOne(`${baseUrl}/inventory/adjustments`);
      expect(req1.request.method).toBe('GET');
      req1.flush({ success: true, data: [{ id: 'adj-1', adjustment_number: 'ADJ-001', status: 'pending_approval' }] });

      service.approveAdjustment('adj-1', 'Approved by manager').subscribe((res) => {
        expect(res.data.status).toBe('approved');
      });

      const req2 = httpTesting.expectOne(`${baseUrl}/inventory/adjustments/adj-1/approve`);
      expect(req2.request.method).toBe('POST');
      expect(req2.request.body).toEqual({ notes: 'Approved by manager' });
      req2.flush({ success: true, data: { id: 'adj-1', status: 'approved' } });
    });

    it('creates adjustment', () => {
      const payload: StoreInventoryAdjustmentPayload = {
        warehouse_id: 'wh-1',
        reason: 'damage_loss',
        lines: [{ stock_item_id: 'item-1', quantity_delta: -2, unit_cost: 15 }],
      };

      service.createAdjustment(payload).subscribe((res) => {
        expect(res.data.adjustment_number).toBe('ADJ-002');
      });

      const req = httpTesting.expectOne(`${baseUrl}/inventory/adjustments`);
      expect(req.request.method).toBe('POST');
      req.flush({ success: true, data: { id: 'adj-2', adjustment_number: 'ADJ-002', ...payload } });
    });

    it('reconciles inventory count session', () => {
      service.reconcileCount('cnt-1').subscribe((res) => {
        expect(res.data.status).toBe('reconciled');
      });

      const req = httpTesting.expectOne(`${baseUrl}/inventory/counts/cnt-1/reconcile`);
      expect(req.request.method).toBe('POST');
      req.flush({ success: true, data: { id: 'cnt-1', status: 'reconciled' } });
    });
  });

  describe('Valuation', () => {
    it('retrieves the valuation at a date (body not wrapped in data)', () => {
      service.getValuationAtDate('2026-11-01', 'wh-1', 'fifo').subscribe((res) => {
        expect(res.total_value).toBe('5000.0000');
      });

      const req = httpTesting.expectOne(
        (r) =>
          r.url === `${baseUrl}/inventory/valuation/at-date` &&
          r.params.get('date') === '2026-11-01' &&
          r.params.get('warehouse_id') === 'wh-1' &&
          r.params.get('valuation_method') === 'fifo',
      );
      expect(req.request.method).toBe('GET');
      req.flush({
        as_of: '2026-11-01T23:59:59Z',
        warehouse_id: 'wh-1',
        total_value: '5000.0000',
        warehouses: [],
        items: [],
      });
    });

    it('captures a valuation snapshot of one item in one warehouse', () => {
      service.captureValuationSnapshot('item-1', 'wh-1').subscribe((res) => {
        expect(res.data.id).toBe('snap-1');
      });

      const req = httpTesting.expectOne(`${baseUrl}/inventory/valuation/snapshot`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ stock_item_id: 'item-1', warehouse_id: 'wh-1' });
      req.flush({ success: true, data: { id: 'snap-1' } });
    });

    it('lists the bins of a warehouse', () => {
      service.getWarehouseBins('wh-1').subscribe((res) => {
        expect(res.data[0].code).toBe('A-01');
      });

      const req = httpTesting.expectOne(`${baseUrl}/inventory/warehouses/wh-1/bins`);
      expect(req.request.method).toBe('GET');
      req.flush({ data: [{ id: 'bin-1', code: 'A-01' }] });
    });

    it('filters adjustments by status', () => {
      service.getAdjustments({ status: 'pending_approval', page: 2 }).subscribe();

      const req = httpTesting.expectOne(
        (r) => r.url === `${baseUrl}/inventory/adjustments` && r.params.get('status') === 'pending_approval',
      );
      expect(req.request.params.get('page')).toBe('2');
      req.flush({ success: true, data: [] });
    });
  });
});
