import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import {
  ApiResponse,
  CreateInventoryCountPayload,
  CreateProductPayload,
  InventoryAdjustmentItem,
  InventoryCountSessionItem,
  PaginatedResponse,
  PriceListItem,
  ProductFilterParams,
  ProductItem,
  StockLevelItem,
  StockMovementItem,
  StockQuantItem,
  StockValuationAtDate,
  StockValuationMethod,
  StockValuationSnapshot,
  StoreInventoryAdjustmentPayload,
  StorePriceListPayload,
  StoreWarehousePayload,
  TransferStockPayload,
  WarehouseBinItem,
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

  getWarehouseBins(warehouseId: string): Observable<{ data: WarehouseBinItem[] }> {
    return this.http.get<{ data: WarehouseBinItem[] }>(`${this.base}/inventory/warehouses/${warehouseId}/bins`);
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

  // Stock Levels & Balances
  getStockLevels(warehouseId?: string): Observable<ApiResponse<StockLevelItem[]>> {
    return this.http.get<ApiResponse<StockLevelItem[]>>(`${this.base}/inventory/stock-levels`, {
      params: warehouseId ? toHttpParams({ warehouse_id: warehouseId }) : undefined,
    });
  }

  // Movements (Single/Double ledger with signed_quantity)
  getMovements(params?: {
    stock_item_id?: string;
    warehouse_id?: string;
    movement_type?: string;
    page?: number;
    per_page?: number;
  }): Observable<PaginatedResponse<StockMovementItem>> {
    return this.http.get<PaginatedResponse<StockMovementItem>>(`${this.base}/inventory/movements`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  transferStock(payload: TransferStockPayload): Observable<ApiResponse<StockMovementItem>> {
    return this.http.post<ApiResponse<StockMovementItem>>(`${this.base}/inventory/movements/transfer`, payload);
  }

  // Stock Adjustments
  getAdjustments(params?: {
    warehouse_id?: string;
    status?: string;
    page?: number;
    per_page?: number;
  }): Observable<PaginatedResponse<InventoryAdjustmentItem>> {
    return this.http.get<PaginatedResponse<InventoryAdjustmentItem>>(`${this.base}/inventory/adjustments`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  getAdjustment(id: string): Observable<ApiResponse<InventoryAdjustmentItem>> {
    return this.http.get<ApiResponse<InventoryAdjustmentItem>>(`${this.base}/inventory/adjustments/${id}`);
  }

  createAdjustment(payload: StoreInventoryAdjustmentPayload): Observable<ApiResponse<InventoryAdjustmentItem>> {
    return this.http.post<ApiResponse<InventoryAdjustmentItem>>(`${this.base}/inventory/adjustments`, payload);
  }

  approveAdjustment(id: string, notes?: string): Observable<ApiResponse<InventoryAdjustmentItem>> {
    return this.http.post<ApiResponse<InventoryAdjustmentItem>>(`${this.base}/inventory/adjustments/${id}/approve`, {
      notes,
    });
  }

  rejectAdjustment(id: string, rejectionReason: string): Observable<ApiResponse<InventoryAdjustmentItem>> {
    return this.http.post<ApiResponse<InventoryAdjustmentItem>>(`${this.base}/inventory/adjustments/${id}/reject`, {
      rejection_reason: rejectionReason,
    });
  }

  // Physical Inventory & ABC Cycle Counts
  getCounts(params?: { page?: number; per_page?: number }): Observable<PaginatedResponse<InventoryCountSessionItem>> {
    return this.http.get<PaginatedResponse<InventoryCountSessionItem>>(`${this.base}/inventory/counts`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  getCount(id: string): Observable<ApiResponse<InventoryCountSessionItem>> {
    return this.http.get<ApiResponse<InventoryCountSessionItem>>(`${this.base}/inventory/counts/${id}`);
  }

  createCount(payload: CreateInventoryCountPayload): Observable<ApiResponse<InventoryCountSessionItem>> {
    return this.http.post<ApiResponse<InventoryCountSessionItem>>(`${this.base}/inventory/counts`, payload);
  }

  recordCount(
    id: string,
    counts: { line_id: string; counted_quantity: number }[],
  ): Observable<ApiResponse<InventoryCountSessionItem>> {
    return this.http.post<ApiResponse<InventoryCountSessionItem>>(`${this.base}/inventory/counts/${id}/record-count`, {
      counts,
    });
  }

  reconcileCount(id: string): Observable<ApiResponse<InventoryCountSessionItem>> {
    return this.http.post<ApiResponse<InventoryCountSessionItem>>(`${this.base}/inventory/counts/${id}/reconcile`, {});
  }

  // Stock Quants
  getQuants(params?: { page?: number; per_page?: number }): Observable<PaginatedResponse<StockQuantItem>> {
    return this.http.get<PaginatedResponse<StockQuantItem>>(`${this.base}/inventory/quants`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  // Valuation
  /** Stock value at the end of `date` (YYYY-MM-DD, not in the future). The body is not wrapped in `data`. */
  getValuationAtDate(
    date: string,
    warehouseId?: string,
    valuationMethod?: StockValuationMethod,
  ): Observable<StockValuationAtDate> {
    return this.http.get<StockValuationAtDate>(`${this.base}/inventory/valuation/at-date`, {
      params: toHttpParams({ date, warehouse_id: warehouseId, valuation_method: valuationMethod }),
    });
  }

  captureValuationSnapshot(stockItemId: string, warehouseId: string): Observable<ApiResponse<StockValuationSnapshot>> {
    return this.http.post<ApiResponse<StockValuationSnapshot>>(`${this.base}/inventory/valuation/snapshot`, {
      stock_item_id: stockItemId,
      warehouse_id: warehouseId,
    });
  }
}
