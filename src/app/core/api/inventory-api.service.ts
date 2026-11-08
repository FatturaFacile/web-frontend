import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import {
  ApiResponse,
  CreateProductPayload,
  PaginatedResponse,
  PriceListItem,
  ProductFilterParams,
  ProductItem,
  StorePriceListPayload,
  StoreWarehousePayload,
  WarehouseItem,
} from '../models';
import { toHttpParams } from '../http/laravel-http.utils';

@Service()
export class InventoryApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  // Products
  getProducts(filters?: ProductFilterParams): Observable<PaginatedResponse<ProductItem>> {
    return this.http.get<PaginatedResponse<ProductItem>>(`${this.base}/inventory/products`, {
      params: filters ? toHttpParams(filters) : undefined,
    });
  }

  getProduct(id: string): Observable<ApiResponse<ProductItem>> {
    return this.http.get<ApiResponse<ProductItem>>(`${this.base}/inventory/products/${id}`);
  }

  createProduct(payload: CreateProductPayload): Observable<ApiResponse<ProductItem>> {
    return this.http.post<ApiResponse<ProductItem>>(`${this.base}/inventory/products`, payload);
  }

  updateProduct(id: string, payload: Partial<CreateProductPayload>): Observable<ApiResponse<ProductItem>> {
    return this.http.put<ApiResponse<ProductItem>>(`${this.base}/inventory/products/${id}`, payload);
  }

  deleteProduct(id: string): Observable<ApiResponse<unknown>> {
    return this.http.delete<ApiResponse<unknown>>(`${this.base}/inventory/products/${id}`);
  }

  // Warehouses
  getWarehouses(params?: { type?: string; is_active?: boolean }): Observable<ApiResponse<WarehouseItem[]>> {
    return this.http.get<ApiResponse<WarehouseItem[]>>(`${this.base}/inventory/warehouses`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  getWarehouse(id: string): Observable<ApiResponse<WarehouseItem>> {
    return this.http.get<ApiResponse<WarehouseItem>>(`${this.base}/inventory/warehouses/${id}`);
  }

  createWarehouse(payload: StoreWarehousePayload): Observable<ApiResponse<WarehouseItem>> {
    return this.http.post<ApiResponse<WarehouseItem>>(`${this.base}/inventory/warehouses`, payload);
  }

  updateWarehouse(id: string, payload: Partial<StoreWarehousePayload>): Observable<ApiResponse<WarehouseItem>> {
    return this.http.put<ApiResponse<WarehouseItem>>(`${this.base}/inventory/warehouses/${id}`, payload);
  }

  deleteWarehouse(id: string): Observable<ApiResponse<unknown>> {
    return this.http.delete<ApiResponse<unknown>>(`${this.base}/inventory/warehouses/${id}`);
  }

  // Price Lists
  getPriceLists(): Observable<ApiResponse<PriceListItem[]>> {
    return this.http.get<ApiResponse<PriceListItem[]>>(`${this.base}/catalog/price-lists`);
  }

  getPriceList(id: string): Observable<ApiResponse<PriceListItem>> {
    return this.http.get<ApiResponse<PriceListItem>>(`${this.base}/catalog/price-lists/${id}`);
  }

  createPriceList(payload: StorePriceListPayload): Observable<ApiResponse<PriceListItem>> {
    return this.http.post<ApiResponse<PriceListItem>>(`${this.base}/catalog/price-lists`, payload);
  }

  updatePriceList(id: string, payload: Partial<StorePriceListPayload>): Observable<ApiResponse<PriceListItem>> {
    return this.http.put<ApiResponse<PriceListItem>>(`${this.base}/catalog/price-lists/${id}`, payload);
  }

  deletePriceList(id: string): Observable<ApiResponse<unknown>> {
    return this.http.delete<ApiResponse<unknown>>(`${this.base}/catalog/price-lists/${id}`);
  }

  resolvePrice(productId: string, contactId?: string): Observable<ApiResponse<{ price: number; currency: string }>> {
    return this.http.get<ApiResponse<{ price: number; currency: string }>>(
      `${this.base}/catalog/price-lists/resolve-price`,
      {
        params: toHttpParams({ product_id: productId, contact_id: contactId }),
      },
    );
  }
}
