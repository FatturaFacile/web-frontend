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
