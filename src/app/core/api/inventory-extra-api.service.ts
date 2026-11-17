import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { toHttpParams } from '../http/laravel-http.utils';
import { ApiResponse, PaginatedResponse } from '../models';

/** Loose row shape for inventory resources whose full typing lives in the UI layer. */
export interface InventoryRow {
  id: string;
  [key: string]: unknown;
}

export type InventoryListParams = Record<string, string | number | boolean | undefined | null>;

export type StockTrackingType = 'none' | 'lot' | 'serial';

export interface StockItemPayload {
  category_id: string;
  sku: string;
  name: string;
  uom: string;
  description?: string | null;
  barcode_custom?: string | null;
  tracking_type: StockTrackingType;
  standard_cost?: number | null;
  moving_average_cost?: number | null;
  weight_kg?: number | null;
  is_active?: boolean | null;
}

export interface StockReservationPayload {
  stock_item_id: string;
  warehouse_id?: string;
  quantity: number;
  lot_id?: string | null;
  [key: string]: unknown;
}

export interface StockLotPayload {
  stock_item_id?: string;
  lot_number?: string;
  expiry_date?: string | null;
  [key: string]: unknown;
}

export interface LotComponentPayload {
  component_lot_id: string;
  quantity?: number;
  [key: string]: unknown;
}

export interface ValuationCategoryPayload {
  valuation_method: string;
  inventory_account_id?: string | null;
  cogs_account_id?: string | null;
  ppv_account_id?: string | null;
  landed_cost_clearing_account_id?: string | null;
}

export interface ValuationItemPayload {
  valuation_method?: string | null;
  standard_cost?: number;
  weight_kg?: number | null;
  revalue_on_change?: boolean;
}

export interface LandedCostPayload {
  document_date: string;
  cost_type: string;
  allocation_key: string;
  currency: string;
  exchange_rate?: number;
  total_amount: number;
  supplier_invoice_id?: string | null;
  notes?: string | null;
  receipt_ids: string[];
}

export interface InventoryBookParams {
  year: number;
  as_of?: string;
  warehouse_id?: string;
  format?: 'json' | 'csv';
  require_closed?: boolean;
}

export interface PutawayRulePayload {
  [key: string]: unknown;
}

export interface ReorderRulePayload {
  stock_item_id?: string;
  warehouse_id?: string;
  min_quantity?: number;
  max_quantity?: number;
  [key: string]: unknown;
}

export interface CycleCountPlanPayload {
  name?: string;
  warehouse_id?: string;
  [key: string]: unknown;
}

export interface ProductChargePayload {
  [key: string]: unknown;
}

export interface BarcodeLabelPayload {
  target: 'item' | 'lot' | 'serial' | 'bin' | 'package';
  id: string;
  symbology: 'ean13' | 'code39';
  format?: 'svg' | 'png' | null;
}

export interface LegacyStockAdjustmentPayload {
  product_id?: string;
  warehouse_id?: string;
  quantity: number;
  reason?: string;
  [key: string]: unknown;
}

/**
 * Secondary inventory API: stock item master, quants, reservations, lots, valuation,
 * landed costs, inventory book, replenishment, putaway, cycle counting, product variants
 * and labels, product charges. Operational flows (picking, shipping, weighbridge, ...)
 * live in InventoryOpsApiService.
 */
@Service()
export class InventoryExtraApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/inventory`;
  private readonly invoicingBase = `${environment.apiBaseUrl}/invoicing`;

  private params(p?: object): HttpParams | undefined {
    return p ? toHttpParams(p) : undefined;
  }

  // Legacy
  getDeliveryNotes(filters?: InventoryListParams): Observable<PaginatedResponse<InventoryRow>> {
    return this.http.get<PaginatedResponse<InventoryRow>>(`${this.base}/delivery-notes`, { params: this.params(filters) });
  }

  /** Deprecated on the backend: prefer the adjustment flow in InventoryApiService. */
  createLegacyStockAdjustment(payload: LegacyStockAdjustmentPayload): Observable<ApiResponse<InventoryRow>> {
    return this.http.post<ApiResponse<InventoryRow>>(`${this.base}/stock-adjustments`, payload);
  }

  // Stock items (item master)
  getItems(filters?: InventoryListParams): Observable<PaginatedResponse<InventoryRow>> {
    return this.http.get<PaginatedResponse<InventoryRow>>(`${this.base}/items`, { params: this.params(filters) });
  }

  getItem(id: string): Observable<ApiResponse<InventoryRow>> {
    return this.http.get<ApiResponse<InventoryRow>>(`${this.base}/items/${id}`);
  }

  createItem(payload: StockItemPayload): Observable<ApiResponse<InventoryRow>> {
    return this.http.post<ApiResponse<InventoryRow>>(`${this.base}/items`, payload);
  }

  updateItem(id: string, payload: Partial<StockItemPayload>): Observable<ApiResponse<InventoryRow>> {
    return this.http.put<ApiResponse<InventoryRow>>(`${this.base}/items/${id}`, payload);
  }

  deleteItem(id: string): Observable<ApiResponse<unknown>> {
    return this.http.delete<ApiResponse<unknown>>(`${this.base}/items/${id}`);
  }

  // Product variants
  getProductVariants(parentId: string): Observable<ApiResponse<InventoryRow[]>> {
    return this.http.get<ApiResponse<InventoryRow[]>>(`${this.base}/products/${parentId}/variants`);
  }

  createProductVariant(parentId: string, payload: Record<string, unknown>): Observable<ApiResponse<InventoryRow>> {
    return this.http.post<ApiResponse<InventoryRow>>(`${this.base}/products/${parentId}/variants`, payload);
  }

  generateProductVariants(parentId: string, payload: Record<string, unknown>): Observable<ApiResponse<InventoryRow[]>> {
    return this.http.post<ApiResponse<InventoryRow[]>>(`${this.base}/products/${parentId}/variants/generate`, payload);
  }

  getProductVariant(variantId: string): Observable<ApiResponse<InventoryRow>> {
    return this.http.get<ApiResponse<InventoryRow>>(`${this.base}/products/variants/${variantId}`);
  }

  updateProductVariant(variantId: string, payload: Record<string, unknown>): Observable<ApiResponse<InventoryRow>> {
    return this.http.put<ApiResponse<InventoryRow>>(`${this.base}/products/variants/${variantId}`, payload);
  }

  deleteProductVariant(variantId: string): Observable<ApiResponse<unknown>> {
    return this.http.delete<ApiResponse<unknown>>(`${this.base}/products/variants/${variantId}`);
  }

  // Barcodes & labels
  getProductBarcode(productId: string): Observable<ApiResponse<InventoryRow>> {
    return this.http.get<ApiResponse<InventoryRow>>(`${this.base}/products/${productId}/barcode`);
  }

  getLabelPresets(): Observable<ApiResponse<InventoryRow[]>> {
    return this.http.get<ApiResponse<InventoryRow[]>>(`${this.base}/labels/presets`);
  }

  printLabels(payload: Record<string, unknown>): Observable<Blob> {
    return this.http.post(`${this.base}/labels/print`, payload, { responseType: 'blob' });
  }

  renderBarcodeLabel(payload: BarcodeLabelPayload): Observable<ApiResponse<InventoryRow>> {
    return this.http.post<ApiResponse<InventoryRow>>(`${this.base}/labels/barcode`, payload);
  }

  scanBarcode(payload: { code: string; [key: string]: unknown }): Observable<ApiResponse<InventoryRow>> {
    return this.http.post<ApiResponse<InventoryRow>>(`${this.base}/barcode/scan`, payload);
  }

  lookupBarcode(code: string): Observable<ApiResponse<InventoryRow>> {
    return this.http.get<ApiResponse<InventoryRow>>(`${this.base}/barcode/lookup`, { params: this.params({ code }) });
  }

  // Quants
  getQuantsAsOf(filters: InventoryListParams): Observable<ApiResponse<InventoryRow[]>> {
    return this.http.get<ApiResponse<InventoryRow[]>>(`${this.base}/quants/as-of`, { params: this.params(filters) });
  }

  getQuant(id: string): Observable<ApiResponse<InventoryRow>> {
    return this.http.get<ApiResponse<InventoryRow>>(`${this.base}/quants/${id}`);
  }

  // Reservations
  getReservations(filters?: InventoryListParams): Observable<PaginatedResponse<InventoryRow>> {
    return this.http.get<PaginatedResponse<InventoryRow>>(`${this.base}/reservations`, { params: this.params(filters) });
  }

  createReservation(payload: StockReservationPayload): Observable<ApiResponse<InventoryRow>> {
    return this.http.post<ApiResponse<InventoryRow>>(`${this.base}/reservations`, payload);
  }

  releaseReservation(id: string): Observable<ApiResponse<InventoryRow>> {
    return this.http.post<ApiResponse<InventoryRow>>(`${this.base}/reservations/${id}/release`, {});
  }

  reserveSalesOrder(orderId: string, payload: Record<string, unknown> = {}): Observable<ApiResponse<InventoryRow>> {
    return this.http.post<ApiResponse<InventoryRow>>(`${this.base}/sales-orders/${orderId}/reserve`, payload);
  }

  releaseSalesOrderReservations(orderId: string): Observable<ApiResponse<InventoryRow>> {
    return this.http.post<ApiResponse<InventoryRow>>(`${this.base}/sales-orders/${orderId}/release-reservations`, {});
  }

  // Lots
  getLots(filters?: InventoryListParams): Observable<PaginatedResponse<InventoryRow>> {
    return this.http.get<PaginatedResponse<InventoryRow>>(`${this.base}/lots`, { params: this.params(filters) });
  }

  createLot(payload: StockLotPayload): Observable<ApiResponse<InventoryRow>> {
    return this.http.post<ApiResponse<InventoryRow>>(`${this.base}/lots`, payload);
  }

  getLotStock(filters?: InventoryListParams): Observable<ApiResponse<InventoryRow[]>> {
    return this.http.get<ApiResponse<InventoryRow[]>>(`${this.base}/lots/stock`, { params: this.params(filters) });
  }

  getLot(id: string): Observable<ApiResponse<InventoryRow>> {
    return this.http.get<ApiResponse<InventoryRow>>(`${this.base}/lots/${id}`);
  }

  updateLot(id: string, payload: Partial<StockLotPayload>): Observable<ApiResponse<InventoryRow>> {
    return this.http.patch<ApiResponse<InventoryRow>>(`${this.base}/lots/${id}`, payload);
  }

  addLotComponent(id: string, payload: LotComponentPayload): Observable<ApiResponse<InventoryRow>> {
    return this.http.post<ApiResponse<InventoryRow>>(`${this.base}/lots/${id}/components`, payload);
  }

  getLotTraceability(id: string): Observable<ApiResponse<InventoryRow>> {
    return this.http.get<ApiResponse<InventoryRow>>(`${this.base}/lots/${id}/traceability`);
  }

  quarantineLot(id: string, payload: { reason?: string } = {}): Observable<ApiResponse<InventoryRow>> {
    return this.http.post<ApiResponse<InventoryRow>>(`${this.base}/lots/${id}/quarantine`, payload);
  }

  releaseLot(id: string): Observable<ApiResponse<InventoryRow>> {
    return this.http.post<ApiResponse<InventoryRow>>(`${this.base}/lots/${id}/release`, {});
  }

  getLotRecallReport(id: string): Observable<ApiResponse<InventoryRow>> {
    return this.http.get<ApiResponse<InventoryRow>>(`${this.base}/lots/${id}/recall`);
  }

  recallLot(id: string, payload: Record<string, unknown> = {}): Observable<ApiResponse<InventoryRow>> {
    return this.http.post<ApiResponse<InventoryRow>>(`${this.base}/lots/${id}/recall`, payload);
  }

  getAvailability(filters?: InventoryListParams): Observable<ApiResponse<InventoryRow[]>> {
    return this.http.get<ApiResponse<InventoryRow[]>>(`${this.base}/availability`, { params: this.params(filters) });
  }

  // Valuation & KPIs
  getValuationSummary(filters?: { warehouse_id?: string; valuation_method?: string }): Observable<ApiResponse<InventoryRow>> {
    return this.http.get<ApiResponse<InventoryRow>>(`${this.base}/valuation/summary`, { params: this.params(filters) });
  }

  getKpis(filters?: InventoryListParams): Observable<ApiResponse<InventoryRow>> {
    return this.http.get<ApiResponse<InventoryRow>>(`${this.base}/kpis`, { params: this.params(filters) });
  }

  getValuationConfig(filters?: { item_id?: string; category_id?: string; per_page?: number }): Observable<ApiResponse<InventoryRow>> {
    return this.http.get<ApiResponse<InventoryRow>>(`${this.base}/valuation/config`, { params: this.params(filters) });
  }

  updateValuationCategory(id: string, payload: ValuationCategoryPayload): Observable<ApiResponse<InventoryRow>> {
    return this.http.put<ApiResponse<InventoryRow>>(`${this.base}/valuation/categories/${id}`, payload);
  }

  updateValuationItem(id: string, payload: ValuationItemPayload): Observable<ApiResponse<InventoryRow>> {
    return this.http.put<ApiResponse<InventoryRow>>(`${this.base}/valuation/items/${id}`, payload);
  }

  getCostLayers(filters?: {
    item_id?: string;
    warehouse_id?: string;
    lot_id?: string;
    open_only?: boolean;
    per_page?: number;
  }): Observable<PaginatedResponse<InventoryRow>> {
    return this.http.get<PaginatedResponse<InventoryRow>>(`${this.base}/valuation/cost-layers`, { params: this.params(filters) });
  }

  // Landed costs
  getLandedCosts(filters?: {
    status?: string;
    receipt_id?: string;
    from?: string;
    to?: string;
    per_page?: number;
  }): Observable<PaginatedResponse<InventoryRow>> {
    return this.http.get<PaginatedResponse<InventoryRow>>(`${this.base}/landed-costs`, { params: this.params(filters) });
  }

  createLandedCost(payload: LandedCostPayload): Observable<ApiResponse<InventoryRow>> {
    return this.http.post<ApiResponse<InventoryRow>>(`${this.base}/landed-costs`, payload);
  }

  previewLandedCost(payload: LandedCostPayload): Observable<ApiResponse<InventoryRow>> {
    return this.http.post<ApiResponse<InventoryRow>>(`${this.base}/landed-costs/preview`, payload);
  }

  getLandedCost(id: string): Observable<ApiResponse<InventoryRow>> {
    return this.http.get<ApiResponse<InventoryRow>>(`${this.base}/landed-costs/${id}`);
  }

  applyLandedCost(id: string): Observable<ApiResponse<InventoryRow>> {
    return this.http.post<ApiResponse<InventoryRow>>(`${this.base}/landed-costs/${id}/apply`, {});
  }

  reverseLandedCost(id: string, reason: string): Observable<ApiResponse<InventoryRow>> {
    return this.http.post<ApiResponse<InventoryRow>>(`${this.base}/landed-costs/${id}/reverse`, { reason });
  }

  // Inventory book (libro inventari)
  getInventoryBook(params: InventoryBookParams): Observable<ApiResponse<InventoryRow>> {
    return this.http.get<ApiResponse<InventoryRow>>(`${this.base}/book`, { params: this.params(params) });
  }

  getInventoryBookExports(filters?: { year?: number; per_page?: number }): Observable<PaginatedResponse<InventoryRow>> {
    return this.http.get<PaginatedResponse<InventoryRow>>(`${this.base}/book/exports`, { params: this.params(filters) });
  }

  createInventoryBookExport(params: InventoryBookParams): Observable<ApiResponse<InventoryRow>> {
    return this.http.post<ApiResponse<InventoryRow>>(`${this.base}/book/exports`, params);
  }

  downloadInventoryBookExport(id: string): Observable<Blob> {
    return this.http.get(`${this.base}/book/exports/${id}/download`, { responseType: 'blob' });
  }

  // Putaway
  getPutawayRules(filters?: InventoryListParams): Observable<ApiResponse<InventoryRow[]>> {
    return this.http.get<ApiResponse<InventoryRow[]>>(`${this.base}/putaway-rules`, { params: this.params(filters) });
  }

  createPutawayRule(payload: PutawayRulePayload): Observable<ApiResponse<InventoryRow>> {
    return this.http.post<ApiResponse<InventoryRow>>(`${this.base}/putaway-rules`, payload);
  }

  updatePutawayRule(id: string, payload: PutawayRulePayload): Observable<ApiResponse<InventoryRow>> {
    return this.http.put<ApiResponse<InventoryRow>>(`${this.base}/putaway-rules/${id}`, payload);
  }

  deletePutawayRule(id: string): Observable<ApiResponse<unknown>> {
    return this.http.delete<ApiResponse<unknown>>(`${this.base}/putaway-rules/${id}`);
  }

  suggestPutaway(payload: Record<string, unknown>): Observable<ApiResponse<InventoryRow>> {
    return this.http.post<ApiResponse<InventoryRow>>(`${this.base}/putaway/suggest`, payload);
  }

  putAway(payload: Record<string, unknown>): Observable<ApiResponse<InventoryRow>> {
    return this.http.post<ApiResponse<InventoryRow>>(`${this.base}/putaway`, payload);
  }

  // Cycle counting
  runAbcClassification(payload: Record<string, unknown> = {}): Observable<ApiResponse<InventoryRow>> {
    return this.http.post<ApiResponse<InventoryRow>>(`${this.base}/abc-classification/run`, payload);
  }

  getCycleCountPlans(filters?: InventoryListParams): Observable<ApiResponse<InventoryRow[]>> {
    return this.http.get<ApiResponse<InventoryRow[]>>(`${this.base}/cycle-count-plans`, { params: this.params(filters) });
  }

  createCycleCountPlan(payload: CycleCountPlanPayload): Observable<ApiResponse<InventoryRow>> {
    return this.http.post<ApiResponse<InventoryRow>>(`${this.base}/cycle-count-plans`, payload);
  }

  updateCycleCountPlan(id: string, payload: CycleCountPlanPayload): Observable<ApiResponse<InventoryRow>> {
    return this.http.put<ApiResponse<InventoryRow>>(`${this.base}/cycle-count-plans/${id}`, payload);
  }

  deleteCycleCountPlan(id: string): Observable<ApiResponse<unknown>> {
    return this.http.delete<ApiResponse<unknown>>(`${this.base}/cycle-count-plans/${id}`);
  }

  runCycleCountPlan(id: string): Observable<ApiResponse<InventoryRow>> {
    return this.http.post<ApiResponse<InventoryRow>>(`${this.base}/cycle-count-plans/${id}/run`, {});
  }

  runDueCycleCountPlans(): Observable<ApiResponse<InventoryRow>> {
    return this.http.post<ApiResponse<InventoryRow>>(`${this.base}/cycle-count-plans/run-due`, {});
  }

  recountInventoryCount(id: string, payload: Record<string, unknown> = {}): Observable<ApiResponse<InventoryRow>> {
    return this.http.post<ApiResponse<InventoryRow>>(`${this.base}/counts/${id}/recount`, payload);
  }

  cancelInventoryCount(id: string): Observable<ApiResponse<InventoryRow>> {
    return this.http.post<ApiResponse<InventoryRow>>(`${this.base}/counts/${id}/cancel`, {});
  }

  // Replenishment
  getReorderRules(filters?: InventoryListParams): Observable<ApiResponse<InventoryRow[]>> {
    return this.http.get<ApiResponse<InventoryRow[]>>(`${this.base}/reorder-rules`, { params: this.params(filters) });
  }

  createReorderRule(payload: ReorderRulePayload): Observable<ApiResponse<InventoryRow>> {
    return this.http.post<ApiResponse<InventoryRow>>(`${this.base}/reorder-rules`, payload);
  }

  updateReorderRule(id: string, payload: ReorderRulePayload): Observable<ApiResponse<InventoryRow>> {
    return this.http.put<ApiResponse<InventoryRow>>(`${this.base}/reorder-rules/${id}`, payload);
  }

  deleteReorderRule(id: string): Observable<ApiResponse<unknown>> {
    return this.http.delete<ApiResponse<unknown>>(`${this.base}/reorder-rules/${id}`);
  }

  getReplenishmentSuggestions(filters?: InventoryListParams): Observable<ApiResponse<InventoryRow[]>> {
    return this.http.get<ApiResponse<InventoryRow[]>>(`${this.base}/replenishment/suggestions`, { params: this.params(filters) });
  }

  handOffReplenishment(payload: Record<string, unknown>): Observable<ApiResponse<InventoryRow>> {
    return this.http.post<ApiResponse<InventoryRow>>(`${this.base}/replenishment/hand-off`, payload);
  }

  // Product charges (eco-contributions, invoicing module)
  getProductCharges(filters?: InventoryListParams): Observable<PaginatedResponse<InventoryRow>> {
    return this.http.get<PaginatedResponse<InventoryRow>>(`${this.invoicingBase}/product-charges`, { params: this.params(filters) });
  }

  createProductCharge(payload: ProductChargePayload): Observable<ApiResponse<InventoryRow>> {
    return this.http.post<ApiResponse<InventoryRow>>(`${this.invoicingBase}/product-charges`, payload);
  }

  previewProductCharge(payload: ProductChargePayload): Observable<ApiResponse<InventoryRow>> {
    return this.http.post<ApiResponse<InventoryRow>>(`${this.invoicingBase}/product-charges/preview`, payload);
  }

  addProductChargeRate(id: string, payload: ProductChargePayload): Observable<ApiResponse<InventoryRow>> {
    return this.http.post<ApiResponse<InventoryRow>>(`${this.invoicingBase}/product-charges/${id}/rates`, payload);
  }

  assignProductChargeProducts(id: string, payload: ProductChargePayload): Observable<ApiResponse<InventoryRow>> {
    return this.http.post<ApiResponse<InventoryRow>>(`${this.invoicingBase}/product-charges/${id}/products`, payload);
  }
}
