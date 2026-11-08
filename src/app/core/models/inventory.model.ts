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
  items?: Array<{
    product_id: string;
    price: number;
    min_quantity?: number | null;
    valid_from?: string | null;
    valid_to?: string | null;
  }>;
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
  items?: Array<{
    product_id: string;
    price: number;
    min_quantity?: number | null;
    valid_from?: string | null;
    valid_to?: string | null;
  }>;
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
  warehouse?: { id: string; name: string; code?: string } | null;
}

export interface TransferStockPayload {
  stock_item_id: string;
  warehouse_id: string;
  quantity: number;
  movement_type:
    | 'INTERNAL_TRANSFER'
    | 'PURCHASE_RECEIPT'
    | 'SALES_DELIVERY'
    | 'ADJUSTMENT_IN'
    | 'ADJUSTMENT_OUT'
    | 'SCRAP'
    | 'PRODUCTION_CONSUMPTION'
    | 'PRODUCTION_OUTPUT'
    | 'RETURN_CUSTOMER'
    | 'RETURN_SUPPLIER'
    | string;
  unit_cost: number;
  source_bin_id?: string | null;
  destination_bin_id?: string | null;
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
  is_locked?: boolean;
  created_by?: string;
  approved_by?: string | null;
  approved_at?: string | null;
  notes?: string | null;
  warehouse?: WarehouseItem | null;
  created_at?: string | null;
  lines?: Array<{
    id?: string;
    stock_item_id: string;
    warehouse_bin_id?: string | null;
    quantity_delta: number;
    unit_cost?: number;
    reason?: string | null;
  }>;
}

export interface StoreInventoryAdjustmentPayload {
  warehouse_id: string;
  reason: 'cycle_count_variance' | 'damage_loss' | 'obsolete_write_off' | 'found_stock' | 'scrap' | string;
  notes?: string | null;
  lines: Array<{
    stock_item_id: string;
    warehouse_bin_id?: string | null;
    quantity_delta: number;
    unit_cost?: number;
    reason?: string | null;
  }>;
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

export interface StockValuationItem {
  item_id: string;
  sku: string;
  name: string;
  valuation: number;
}

export interface StockValuationSummary {
  valuation_method: string | null;
  warehouse_id: string | null;
  total_valuation: number;
  items_count: number;
  items: StockValuationItem[];
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
