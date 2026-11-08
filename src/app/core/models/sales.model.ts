export interface SalesQuoteItem {
  id?: string;
  quote_id?: string;
  product_id?: string | null;
  description: string;
  quantity: number;
  unit_price?: number | null;
  tax_rate?: number | null;
  discount_percentage?: number | null;
  line_total?: number | string | null;
  uom?: string | null;
  created_at?: string | null;
}

export interface SalesQuoteResource {
  id: string;
  tenant_id?: string | null;
  contact_id: string;
  quote_number: string;
  date: string;
  valid_until?: string | null;
  currency: string;
  subtotal: number;
  discount_amount?: number;
  total_net: number;
  total_tax: number;
  total_gross: number;
  status: 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'accepted' | 'converted' | string;
  approval_status?: 'pending' | 'approved' | 'rejected' | null;
  notes?: string | null;
  contact?: {
    id: string;
    display_name?: string;
    name?: string;
    company_name?: string;
    email?: string;
  } | null;
  items?: SalesQuoteItem[];
  created_at?: string | null;
  updated_at?: string | null;
}

export interface CreateSalesQuotePayload {
  contact_id: string;
  date?: string | null;
  valid_until?: string | null;
  currency?: string | null;
  notes?: string | null;
  items: Array<{
    product_id?: string | null;
    description: string;
    quantity: number;
    unit_price?: number | null;
    tax_rate?: number | null;
    discount_percentage?: number | null;
    uom?: string | null;
  }>;
}

export interface SalesOrderItem {
  id?: string;
  sales_order_id?: string;
  product_id?: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  discount_percentage?: number | null;
  line_total?: number | string | null;
  delivered_quantity?: number | null;
  invoiced_quantity?: number | null;
}

export interface SalesOrderResource {
  id: string;
  tenant_id?: string | null;
  contact_id: string;
  order_number: string;
  quote_id?: string | null;
  date: string;
  due_date?: string | null;
  currency: string;
  subtotal?: number;
  total_net: number;
  total_tax: number;
  total_gross: number;
  status: 'draft' | 'confirmed' | 'approved' | 'in_production' | 'shipped' | 'completed' | 'cancelled' | string;
  is_stock_reserved?: boolean;
  notes?: string | null;
  contact?: {
    id: string;
    display_name?: string;
    name?: string;
    company_name?: string;
    email?: string;
  } | null;
  items?: SalesOrderItem[];
  created_at?: string | null;
  updated_at?: string | null;
}

export interface CreateSalesOrderPayload {
  contact_id: string;
  date: string;
  currency: string;
  due_date?: string | null;
  notes?: string | null;
  status?: string;
  items: Array<{
    product_id?: string | null;
    description: string;
    quantity: number;
    unit_price: number;
    tax_rate: number;
    discount_percentage?: number | null;
  }>;
}

export interface DeliveryNoteItem {
  id?: string;
  delivery_note_id?: string;
  sales_order_item_id?: string | null;
  product_id?: string | null;
  description?: string;
  quantity: number;
  unit_price?: number | string | null;
  tax_rate?: number | string | null;
}

export interface DeliveryNoteResource {
  id: string;
  tenant_id?: string | null;
  contact_id: string;
  sales_order_id?: string | null;
  warehouse_id?: string | null;
  ddt_number: string;
  date: string;
  transport_reason: string;
  goods_appearance?: string | null;
  packages_count: number;
  gross_weight_kg?: number | null;
  carrier_name?: string | null;
  carrier_license_plate?: string | null;
  shipping_address?: string | null;
  status?: 'draft' | 'dispatched' | 'confirmed' | 'invoiced' | string;
  contact?: {
    id: string;
    display_name?: string;
    name?: string;
    company_name?: string;
  } | null;
  items?: DeliveryNoteItem[];
  created_at?: string | null;
  updated_at?: string | null;
}

export interface CreateDeliveryNotePayload {
  sales_order_id: string;
  warehouse_id?: string | null;
  date?: string | null;
  transport_reason?: string | null;
  goods_appearance?: string | null;
  packages_count?: number | null;
  gross_weight_kg?: number | null;
  carrier_name?: string | null;
  carrier_license_plate?: string | null;
  notes?: string | null;
  items: Array<{
    sales_order_item_id: string;
    quantity: number;
    batch_number?: string | null;
    serial_number?: string | null;
  }>;
}
