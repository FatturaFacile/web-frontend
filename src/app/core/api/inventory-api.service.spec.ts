import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { environment } from '@env';
import { InventoryApiService } from './inventory-api.service';
import { CreateProductPayload, StorePriceListPayload, StoreWarehousePayload } from '../models';

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
        warehouse: 'HQ',
        quantity: 50,
        unit_of_measure: 'PZ',
        price: 15.5,
        currency: 'EUR',
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
      service.updateProduct('p-1', { price: 20 }).subscribe((res) => {
        expect(res.data.price).toBe(20);
      });

      const req = httpTesting.expectOne(`${baseUrl}/inventory/products/p-1`);
      expect(req.request.method).toBe('PUT');
      req.flush({ success: true, data: { id: 'p-1', price: 20 } });
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

  describe('Price Lists', () => {
    it('fetches price lists', () => {
      service.getPriceLists().subscribe((res) => {
        expect(res.data.length).toBe(1);
      });

      const req = httpTesting.expectOne(`${baseUrl}/catalog/price-lists`);
      expect(req.request.method).toBe('GET');
      req.flush({ success: true, data: [{ id: 'pl-1', name: 'Standard 2026' }] });
    });

    it('creates a price list', () => {
      const payload: StorePriceListPayload = {
        name: 'Wholesale CH',
        currency: 'CHF',
        price_adjustment_percent: 10,
      };

      service.createPriceList(payload).subscribe((res) => {
        expect(res.data.name).toBe('Wholesale CH');
      });

      const req = httpTesting.expectOne(`${baseUrl}/catalog/price-lists`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(payload);
      req.flush({ success: true, data: { id: 'pl-2', ...payload } });
    });

    it('resolves price for a product', () => {
      service.resolvePrice('prod-1', 'client-2').subscribe((res) => {
        expect(res.data.price).toBe(45);
      });

      const req = httpTesting.expectOne(
        (r) =>
          r.url === `${baseUrl}/catalog/price-lists/resolve-price` &&
          r.params.get('product_id') === 'prod-1' &&
          r.params.get('contact_id') === 'client-2',
      );
      expect(req.request.method).toBe('GET');
      req.flush({ success: true, data: { price: 45, currency: 'EUR' } });
    });
  });
});
