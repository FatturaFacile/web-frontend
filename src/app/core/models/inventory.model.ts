import { QueryFilterParams } from './api.models';
import { CustomsOriginType } from './customs-codes.model';

/** A catalog product as the API returns it (Product model: the money fields arrive as decimal strings). */
import { LaravelPaginationMeta } from './api.models';

export interface ProductItem {
  id: string;
  sku: string;
  barcode?: string | null;
  name: string;
  description?: string | null;
  unit_measure: string;
  cost_price: number | string;
  sale_price: number | string;
  tax_rate: number | string;
  hs_code?: string | null;
  min_stock?: number | string | null;
  is_active?: boolean;
  customs_taric_code_id?: string | null;
  /** 6, 8 or 10 digit HS / CN / TARIC code. */
  taric_code?: string | null;
  /** ISO 3166-1 alpha-2 country of origin. */
  country_of_origin?: string | null;
  origin_type?: CustomsOriginType | null;
  made_in_label?: string | null;
  preferential_agreement_id?: string | null;
  eur1_required?: boolean;
  origin_rule_notes?: string | null;
  /** Swiss 8 digit tariff number. */
  swiss_hs_code?: string | null;
  supplementary_unit?: string | null;
  customs_duty_rate?: number | string | null;
  net_weight_kg?: number | string | null;
  gross_weight_kg?: number | string | null;
  packages_count?: number | null;
  preferential_origin_eligible?: boolean;
  created_at?: string;
  updated_at?: string;
}

/** Query of GET /inventory/movements (grid parameters travel in the same object). */
export interface StockMovementFilterParams extends QueryFilterParams {
  stock_item_id?: string;
  warehouse_id?: string;
  movement_type?: string;
}

/** Query of GET /inventory/adjustments. */
export interface InventoryAdjustmentFilterParams extends QueryFilterParams {
  warehouse_id?: string;
  status?: string;
}

/** Query of GET /inventory/counts. */
export interface InventoryCountFilterParams extends QueryFilterParams {
  warehouse_id?: string;
  status?: string;
}

export interface ProductFilterParams {
  page?: number;
  per_page?: number;
  search?: string;
  warehouse?: string;
  status?: string;
}

/** Body of POST /inventory/products (StoreProductRequest): unit_measure, cost_price, sale_price and tax_rate are required. */
export interface CreateProductPayload {
  sku: string;
  name: string;
  barcode?: string | null;
  description?: string | null;
  unit_measure: string;
  cost_price: number;
  sale_price: number;
  tax_rate: number;
  hs_code?: string | null;
  min_stock?: number | null;
  customs_taric_code_id?: string | null;
  taric_code?: string | null;
  country_of_origin?: string | null;
  origin_type?: CustomsOriginType | null;
  /** The server derives it from the country when omitted. */
  made_in_label?: string | null;
  preferential_agreement_id?: string | null;
  eur1_required?: boolean;
  origin_rule_notes?: string | null;
  swiss_hs_code?: string | null;
  supplementary_unit?: string | null;
  customs_duty_rate?: number | null;
  net_weight_kg?: number | null;
  gross_weight_kg?: number | null;
  packages_count?: number | null;
  preferential_origin_eligible?: boolean;
}

export interface WarehouseItem {
  id: string;
  code: string;
  name: string;
  type: 'standard' | 'van' | 'transit' | 'quarantine' | 'consignment' | 'virtual' | string;
  picking_strategy?: string | null;
  is_virtual?: boolean;
  owner_contact_id?: string | null;
  address?: string | null;
  city?: string | null;
  postal_code?: string | null;
  country?: string | null;
  is_active?: boolean;
  bins_count?: number;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface StoreWarehousePayload {
  code: string;
  name: string;
  type: 'standard' | 'van' | 'transit' | 'quarantine' | 'consignment' | 'virtual';
  is_virtual?: boolean | null;
  owner_contact_id?: string | null;
  address?: string | null;
  city?: string | null;
  postal_code?: string | null;
  country?: string | null;
  is_active?: boolean | null;
}

export interface PriceListItem {
  id: string;
  name: string;
  currency: string;
  is_default?: boolean | null;
  is_active?: boolean | null;
  valid_from?: string | null;
  valid_to?: string | null;
  parent_price_list_id?: string | null;
  price_adjustment_percent?: number | null;
  code?: string | null;
  channel?: string | null;
  rounding_mode?: string | null;
  priority?: number | null;
  items?: {
    product_id: string;
    price: number;
    min_quantity?: number | null;
    valid_from?: string | null;
    valid_to?: string | null;
  }[];
  created_at?: string | null;
  updated_at?: string | null;
}

export interface StorePriceListPayload {
  name: string;
  currency: string;
  is_default?: boolean | null;
  is_active?: boolean | null;
  valid_from?: string | null;
  valid_to?: string | null;
  parent_price_list_id?: string | null;
  price_adjustment_percent?: number | null;
  code?: string | null;
  channel?: string | null;
  rounding_mode?: string | null;
  priority?: number | null;
  items?: {
    product_id: string;
    price: number;
    min_quantity?: number | null;
    valid_from?: string | null;
    valid_to?: string | null;
  }[];
}

// Module 09: Inventory & Logistics
export interface StockLevelItem {
  product_id: string;
  sku: string | null;
  name: string | null;
  quantity: number;
  on_hand: number;
  reserved: number;
  available: number;
  shortfall: number;
}

export interface StockMovementItem {
  id: string;
  movement_number?: string;
  warehouse_id?: string | null;
  stock_item_id?: string | null;
  product_id?: string | null;
  source_bin_id?: string | null;
  destination_bin_id?: string | null;
  movement_type: string;
  quantity: number;
  signed_quantity?: number;
  unit_cost: number;
  total_valuation?: number;
  stock_lot_id?: string | null;
  stock_serial_number_id?: string | null;
  reference_type?: string | null;
  reference_id?: string | null;
  created_by?: string | null;
  notes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  product?: { id: string; name: string; sku: string } | null;
  item?: { id: string; name: string; sku: string } | null;
  warehouse?: { id: string; name: string; code?: string } | null;
  source_bin?: { id: string; code: string } | null;
  destination_bin?: { id: string; code: string } | null;
}

/** A bin of a warehouse as listed by `GET /inventory/warehouses/{id}/bins`. */
export interface WarehouseBinItem {
  id: string;
  warehouse_id: string;
  zone_id: string;
  zone_code: string;
  zone_type: string;
  aisle_code: string;
  rack_code: string;
  code: string;
  barcode: string;
  bin_type: string;
  pick_sequence: number | null;
  is_locked: boolean;
  max_quantity: string | null;
  max_weight_kg: string | null;
  max_volume_cbm: string | null;
  occupancy: { quantity: string; weight_kg: string; volume_m3: string; items: number };
}

/** Relocation between two bins of one warehouse: the only movement the manual endpoint accepts (unit_cost is ignored). */
export interface TransferStockPayload {
  stock_item_id: string;
  warehouse_id: string;
  quantity: number;
  movement_type?: 'INTERNAL_TRANSFER';
  source_bin_id: string;
  destination_bin_id: string;
  stock_lot_id?: string | null;
  stock_serial_number_id?: string | null;
  reference_type?: string | null;
  reference_id?: string | null;
  notes?: string | null;
}

export interface InventoryAdjustmentItem {
  id: string;
  warehouse_id: string;
  adjustment_number: string;
  reason: string;
  status: 'draft' | 'pending_approval' | 'approved' | 'rejected' | string;
  net_valuation_change?: number;
  rejection_reason?: string | null;
  is_locked?: boolean;
  created_by?: string;
  approved_by?: string | null;
  approved_at?: string | null;
  notes?: string | null;
  warehouse?: WarehouseItem | null;
  created_at?: string | null;
  lines?: {
    id?: string;
    stock_item_id: string;
    warehouse_bin_id?: string | null;
    quantity_delta: number;
    unit_cost?: number;
    reason?: string | null;
  }[];
}

export interface StoreInventoryAdjustmentPayload {
  warehouse_id: string;
  reason: 'cycle_count_variance' | 'damage_loss' | 'obsolete_write_off' | 'found_stock' | 'scrap' | string;
  notes?: string | null;
  lines: {
    stock_item_id: string;
    warehouse_bin_id?: string | null;
    quantity_delta: number;
    unit_cost?: number;
    reason?: string | null;
  }[];
}

export interface InventoryCountLine {
  id: string;
  inventory_count_session_id?: string;
  warehouse_bin_id?: string;
  stock_item_id: string;
  lot_id?: string | null;
  system_quantity: string | number;
  counted_quantity?: string | number | null;
  discrepancy_quantity?: string | number;
  discrepancy_valuation?: string | number;
  counted_by_user_id?: string | null;
  counted_at?: string | null;
}

export interface InventoryCountSessionItem {
  id: string;
  session_number: string;
  warehouse_id: string;
  warehouse_zone_id?: string | null;
  count_type: 'full_physical' | 'cycle_count_abc' | 'spot_check' | 'zone_sweep' | string;
  status: 'scheduled' | 'in_progress' | 'reconciled' | 'cancelled' | string;
  scheduled_date: string;
  effective_at?: string | null;
  completed_at?: string | null;
  is_locked?: boolean;
  notes?: string | null;
  warehouse?: WarehouseItem | null;
  lines?: InventoryCountLine[];
  created_at?: string | null;
}

export interface CreateInventoryCountPayload {
  warehouse_id: string;
  count_type: 'full_physical' | 'cycle_count_abc' | 'spot_check' | 'zone_sweep';
  scheduled_date: string;
  warehouse_zone_id?: string | null;
  notes?: string | null;
  effective_at?: string | null;
}

export type StockValuationCostSource =
  | 'current_moving_average'
  | 'movements'
  | 'fifo_layers'
  | 'fifo_layers_and_moving_average'
  | 'standard_cost';

export interface StockValuationItem {
  stock_item_id: string;
  sku: string;
  name: string;
  warehouse_id: string;
  quantity: string;
  unit_cost: string;
  value: string;
  valuation_method: string | null;
  cost_source: StockValuationCostSource;
}

/** Stock value at the end of a day (`GET /inventory/valuation/at-date`, the body is not wrapped in `data`). */
export interface StockValuationAtDate {
  as_of: string;
  warehouse_id: string | null;
  total_value: string;
  warehouses: { warehouse_id: string; warehouse_code: string; total_value: string }[];
  items: StockValuationItem[];
}

export type StockValuationMethod = 'fifo' | 'moving_average' | 'standard_cost';

/** Result of `POST /inventory/valuation/snapshot`. */
export interface StockValuationSnapshot {
  id: string;
  warehouse_id: string;
  stock_item_id: string;
  snapshot_date: string;
  valuation_method: string;
  quantity_on_hand: string;
  unit_cost: string;
  total_valuation: string;
}

export interface StockQuantItem {
  id: string;
  warehouse_bin_id: string;
  stock_item_id: string;
  lot_id?: string | null;
  quantity: number;
  reserved_quantity: number;
  available_quantity: number;
  created_at?: string | null;
}

// ---------------------------------------------------------------------------
// Inventory valuation, cost layers, landed costs and inventory book (#144).
// Money and quantities are serialised by the API as fixed-decimal strings and
// are kept as strings: the client never performs arithmetic on them.
// ---------------------------------------------------------------------------

/** Supported valuation methods (LIFO is intentionally not supported). */
export type ValuationMethod = 'fifo' | 'weighted_average' | 'standard_cost';

export const VALUATION_METHODS: readonly ValuationMethod[] = ['fifo', 'weighted_average', 'standard_cost'];

/** Where the effective valuation method of an item comes from. */
export type ValuationMethodSource = 'item' | 'category' | 'default';

/**
 * Tolerant single-resource envelope: inventory endpoints answer either with the
 * bare resource or with `{ data }` (optionally `{ success, message, data }`).
 */
export interface InventoryDataEnvelope<T> {
  success?: boolean;
  message?: string;
  data: T;
}

/** Tolerant list envelope: `{ data, links?, meta? }` with optional `success`/`message`. */
export interface InventoryListEnvelope<T> {
  success?: boolean;
  message?: string;
  data: T[];
  links?: Record<string, string | null>;
  meta?: Partial<LaravelPaginationMeta> & Record<string, unknown>;
}

export interface ValuationConfigRow {
  item_id: string;
  sku: string;
  name?: string | null;
  category_id: string | null;
  category_name?: string | null;
  category_method: ValuationMethod | null;
  item_method: ValuationMethod | null;
  effective_method: ValuationMethod;
  source: ValuationMethodSource;
  standard_cost?: string | null;
  weight_kg?: string | null;
  volume_m3?: string | null;
}

export interface ValuationConfigFilterParams {
  item_id?: string;
  category_id?: string;
}

export interface UpdateCategoryValuationPayload {
  valuation_method: ValuationMethod;
  inventory_account_id?: string | null;
  cogs_account_id?: string | null;
  ppv_account_id?: string | null;
  landed_cost_clearing_account_id?: string | null;
}

export interface UpdateItemValuationPayload {
  valuation_method: ValuationMethod | null;
  standard_cost?: string | null;
  weight_kg?: string | null;
  volume_m3?: string | null;
  revalue_on_change?: boolean;
}

export interface InventoryRevaluation {
  id: string;
  source_type?: 'landed_cost' | 'method_change' | 'manual';
  status?: string;
  total_inventory_delta: string;
  total_cogs_delta: string;
  journal_entry_id: string | null;
}

export interface ValuationCategory {
  id: string;
  name?: string | null;
  valuation_method: ValuationMethod;
  inventory_account_id?: string | null;
  cogs_account_id?: string | null;
  ppv_account_id?: string | null;
  landed_cost_clearing_account_id?: string | null;
}

export interface ValuationItem {
  id: string;
  sku?: string;
  name?: string | null;
  valuation_method: ValuationMethod | null;
  standard_cost?: string | null;
  weight_kg?: string | null;
  volume_m3?: string | null;
  revaluation?: InventoryRevaluation | null;
}

export interface ValuationSummaryItem {
  item_id: string;
  sku: string;
  name?: string | null;
  method?: string | null;
  valuation: number | string;
}

export interface ValuationSummary {
  valuation_method: string;
  warehouse_id: string | null;
  total_valuation: number | string;
  items_count: number;
  items: ValuationSummaryItem[];
}

export interface ValuationSummaryParams {
  warehouse_id?: string;
  valuation_method?: ValuationMethod;
}

export interface ValuationSnapshotPayload {
  stock_item_id: string;
  warehouse_id: string;
  valuation_method?: ValuationMethod;
}

export interface CostLayer {
  id: string;
  item_id: string;
  sku?: string | null;
  warehouse_id?: string | null;
  lot_id: string | null;
  lot_number?: string | null;
  received_at: string;
  original_quantity: string;
  remaining_quantity: string;
  unit_cost: string;
  landed_cost_unit: string;
  effective_unit_cost: string;
  currency?: string | null;
  receipt_id: string | null;
}

export interface CostLayerFilterParams {
  page?: number;
  per_page?: number;
  item_id?: string;
  warehouse_id?: string;
  lot_id?: string;
  open_only?: boolean;
}

export type LandedCostStatus = 'draft' | 'applied' | 'reversed';
export type LandedCostAllocationKey = 'value' | 'weight' | 'volume' | 'quantity';
export type LandedCostType = 'freight' | 'customs_duty' | 'insurance' | 'brokerage' | 'other';

export const LANDED_COST_STATUSES: readonly LandedCostStatus[] = ['draft', 'applied', 'reversed'];
export const LANDED_COST_ALLOCATION_KEYS: readonly LandedCostAllocationKey[] = [
  'value',
  'weight',
  'volume',
  'quantity',
];
export const LANDED_COST_TYPES: readonly LandedCostType[] = [
  'freight',
  'customs_duty',
  'insurance',
  'brokerage',
  'other',
];

export interface LandedCostAllocation {
  receipt_id: string;
  item_id: string;
  sku?: string | null;
  lot_id: string | null;
  basis_value: string;
  allocated_amount: string;
  to_inventory_amount?: string | null;
  to_cogs_amount?: string | null;
}

export interface LandedCostReceiptRef {
  receipt_id: string;
  receipt_number: string | null;
}

export interface LandedCostDocument {
  id: string;
  number: string;
  status: LandedCostStatus;
  cost_type: LandedCostType;
  allocation_key: LandedCostAllocationKey;
  currency: string;
  total_amount: string;
  document_date: string;
  supplier_invoice_id: string | null;
  notes?: string | null;
  receipts?: LandedCostReceiptRef[];
  allocations?: LandedCostAllocation[];
  journal_entry_id: string | null;
  applied_at: string | null;
  reversal_of_id: string | null;
  reversed_by_id?: string | null;
  revaluation?: InventoryRevaluation | null;
}

export interface LandedCostFilterParams {
  page?: number;
  per_page?: number;
  status?: LandedCostStatus;
  receipt_id?: string;
  from?: string;
  to?: string;
}

export interface LandedCostPayload {
  document_date: string;
  cost_type: LandedCostType;
  allocation_key: LandedCostAllocationKey;
  currency: string;
  total_amount: string;
  supplier_invoice_id?: string | null;
  notes?: string | null;
  receipt_ids: string[];
}

export interface LandedCostPreview {
  allocations: LandedCostAllocation[];
  totals: {
    allocated: string;
    difference: string;
  };
}

export interface ReverseLandedCostPayload {
  reason: string;
}

export interface InventoryBookParams {
  year: number;
  as_of?: string;
  warehouse_id?: string;
  require_closed?: boolean;
}

export interface InventoryBookRow {
  sku: string;
  name: string;
  uom: string;
  warehouse_id: string | null;
  lot_number: string | null;
  quantity: string;
  unit_cost: string;
  total_value: string;
  valuation_method: ValuationMethod | string;
}

export interface InventoryBook {
  meta: {
    year: number;
    as_of: string;
    company_id?: string;
    method_breakdown?: Record<string, string | number>;
    generated_at?: string;
  };
  rows: InventoryBookRow[];
  totals: {
    quantity: string;
    total_value: string;
  };
  reconciliation: {
    gl_inventory_balance: string;
    difference: string;
  };
}

export interface InventoryBookExport {
  id: string;
  year: number;
  as_of?: string | null;
  status: string;
  totals?: { quantity?: string; total_value?: string } | null;
  checksum?: string | null;
  generated_by?: string | null;
  created_at?: string | null;
}

export interface InventoryBookExportFilterParams {
  page?: number;
  per_page?: number;
}

/** A downloaded file with the filename resolved from `Content-Disposition`. */
export interface DownloadedFile {
  blob: Blob;
  filename: string;
}

/** Minimal goods receipt (Procurement) used to pick landed-cost targets. */
export interface GoodsReceiptSummary {
  id: string;
  receipt_number: string;
  purchase_order_id?: string | null;
  supplier_delivery_note_ref?: string | null;
  received_date?: string | null;
  warehouse_id?: string | null;
  inspection_status?: string | null;
}

export interface GoodsReceiptFilterParams {
  page?: number;
  per_page?: number;
  purchase_order_id?: string;
  search?: string;
}

/** Minimal warehouse / stock item lookups used by the valuation filters. */
export interface InventoryWarehouseOption {
  id: string;
  code?: string;
  name: string;
}

export interface InventoryItemOption {
  id: string;
  sku: string;
  name?: string | null;
}
