import { LaravelPaginationMeta } from './api.models';

export interface ProductItem {
  id: string;
  sku: string;
  name: string;
  description?: string;
  warehouse: string;
  quantity: number;
  unit_of_measure: string;
  hs_code?: string;
  price: number;
  currency: 'EUR' | 'CHF';
  tax_rate?: number;
  status?: 'in_stock' | 'low_stock' | 'out_of_stock';
  created_at?: string;
  updated_at?: string;
}

export interface ProductFilterParams {
  page?: number;
  per_page?: number;
  search?: string;
  warehouse?: string;
  status?: string;
}

export interface CreateProductPayload {
  sku: string;
  name: string;
  description?: string;
  warehouse: string;
  quantity: number;
  unit_of_measure: string;
  hs_code?: string;
  price: number;
  currency: 'EUR' | 'CHF';
  tax_rate?: number;
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
