/**
 * Sales cycle on the core `/sales/*` endpoints (quotes, orders, delivery notes, returns, pricing, credit).
 * Money, quantities and rates arrive as decimal strings and are sent back as strings or numbers untouched.
 */

export type CoreQuoteStatus =
  | 'draft'
  | 'sent'
  | 'accepted'
  | 'rejected'
  | 'expired'
  | 'converted'
  | 'superseded';

export interface CoreContactRef {
  id: string;
  name?: string | null;
}

export interface CoreDocumentLine {
  id?: string;
  product_id?: string | null;
  description: string;
  quantity: string | number;
  unit_price: string | number;
  tax_rate: string | number;
  discount_percentage?: string | number | null;
  line_total?: string | null;
  sales_order_item_id?: string | null;
  quantity_delivered?: string | null;
  quantity_invoiced?: string | null;
}

export interface CoreQuote {
  id: string;
  quote_number: string;
  contact_id: string;
  contact?: CoreContactRef | null;
  date: string;
  valid_until?: string | null;
  currency: string;
  status: CoreQuoteStatus | string;
  notes?: string | null;
  custom_text?: string | null;
  total_net?: string | null;
  total_tax?: string | null;
  total_gross?: string | null;
  revision_of_quote_id?: string | null;
  superseded_at?: string | null;
  signed_by?: string | null;
  items?: CoreDocumentLine[];
}

export interface CoreDocumentLinePayload {
  product_id?: string | null;
  description: string;
  quantity: number | string;
  unit_price: number | string;
  tax_rate: number | string;
  discount_percentage?: number | string | null;
}

export interface CoreQuotePayload {
  contact_id: string;
  date: string;
  currency: string;
  notes?: string | null;
  items: CoreDocumentLinePayload[];
  valid_until?: string | null;
  status?: 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired';
  custom_text?: string | null;
}

export interface QuoteRevisionPayload {
  date?: string | null;
  valid_until?: string | null;
  notes?: string | null;
  custom_text?: string | null;
  items?: Partial<CoreDocumentLinePayload>[];
}

export interface QuoteSignaturePayload {
  signed_by: string;
  signature_base64: string;
}

export type CoreOrderStatus =
  | 'draft'
  | 'on_hold'
  | 'confirmed'
  | 'in_production'
  | 'shipped'
  | 'completed'
  | 'cancelled';

export type OrderInventoryStatus =
  | 'reserved'
  | 'partially_reserved'
  | 'not_reserved'
  | 'not_required'
  | 'released';

export interface CoreOrderHold {
  id: string;
  status: 'active' | 'released' | string;
  hold_reason?: string | null;
}

export interface CoreOrder {
  id: string;
  order_number: string;
  contact_id: string;
  contact?: CoreContactRef | null;
  quote_id?: string | null;
  date: string;
  due_date?: string | null;
  currency: string;
  status: CoreOrderStatus | string;
  inventory_status?: OrderInventoryStatus | string | null;
  billing_status?: string | null;
  notes?: string | null;
  total_net?: string | null;
  total_tax?: string | null;
  total_gross?: string | null;
  credit_status?: 'pending_check' | 'approved' | 'on_hold' | 'rejected' | 'warning' | string | null;
  credit_hold_reason?: string | null;
  /** Id of the credit hold that parks the order (`GET /sales/orders` and `/sales/orders/{id}`), when it has one. */
  credit_hold_id?: string | null;
  /** Credit holds of the order, present only when the endpoint loads them. */
  holds?: CoreOrderHold[];
  items?: CoreDocumentLine[];
}

export interface CoreOrderPayload {
  contact_id: string;
  date: string;
  currency: string;
  notes?: string | null;
  items: CoreDocumentLinePayload[];
  due_date?: string | null;
  status?: 'draft' | 'confirmed' | 'in_production' | 'shipped' | 'completed' | 'cancelled';
}

export interface OrderAvailabilityLine {
  sales_order_item_id: string;
  product_id?: string | null;
  description: string;
  stock_relevant: boolean;
  quantity_ordered: string;
  quantity_delivered: string;
  quantity_open: string;
  quantity_reserved: string;
  quantity_available: string;
  quantity_promisable: string;
  shortage: string;
  fully_available: boolean;
}

export interface OrderAvailability {
  sales_order_id: string;
  warehouse_id?: string | null;
  fully_available: boolean;
  lines: OrderAvailabilityLine[];
}

export interface BackorderLine {
  sales_order_item_id: string;
  sales_order_id: string;
  order_number: string;
  order_date: string;
  order_status: string;
  contact_id: string;
  product_id?: string | null;
  description: string;
  quantity_ordered: string;
  quantity_delivered: string;
  quantity_open: string;
  quantity_reserved: string;
  open_net_value: string;
}

export interface SalesKpis {
  period: { from: string; to: string };
  order_backlog: { open_orders: number; open_lines: number; open_net_value: string };
  fill_rate: {
    orders: number;
    lines: number;
    lines_fully_delivered: number;
    line_fill_rate: string | null;
    quantity_ordered: string;
    quantity_delivered: string;
    quantity_fill_rate: string | null;
  };
  quote_conversion: {
    quotes: number;
    accepted: number;
    rejected: number;
    expired: number;
    open: number;
    converted_to_order: number;
    quoted_net_value: string;
    accepted_net_value: string;
    conversion_rate: string | null;
    order_conversion_rate: string | null;
  };
  returns: { opened: number; credited: number };
}
export type TransportBy = 'sender' | 'recipient' | 'carrier';

export interface CoreDeliveryNote {
  id: string;
  ddt_number: string;
  contact_id: string;
  contact?: CoreContactRef | null;
  sales_order_id?: string | null;
  warehouse_id?: string | null;
  date: string;
  status: 'draft' | 'issued' | 'dispatched' | 'delivered' | 'invoiced' | string;
  transport_reason?: string | null;
  goods_appearance?: string | null;
  packages_count?: number | null;
  gross_weight_kg?: string | null;
  net_weight_kg?: string | null;
  carrier_name?: string | null;
  carrier_license_plate?: string | null;
  shipping_terms?: string | null;
  transport_by?: TransportBy | null;
  courier?: string | null;
  tracking_number?: string | null;
  shipping_address?: string | null;
  items?: CoreDocumentLine[];
}

export interface DeliveryNoteLinePayload {
  sales_order_item_id?: string;
  quote_item_id?: string;
  quantity: number | string;
}

export interface DeliveryNoteFromDocumentPayload {
  lines?: DeliveryNoteLinePayload[] | null;
  warehouse_id?: string | null;
  transport_reason?: string | null;
  goods_appearance?: string | null;
  packages_count?: number | null;
  gross_weight_kg?: number | string | null;
  net_weight_kg?: number | string | null;
  carrier_name?: string | null;
  carrier_license_plate?: string | null;
  departure_time?: string | null;
  shipping_terms?: string | null;
  transport_by?: TransportBy | null;
  courier?: string | null;
  tracking_number?: string | null;
  shipping_address?: string | null;
  show_prices?: boolean | null;
  notes?: string | null;
}

export type SalesReturnStatus =
  | 'requested'
  | 'approved'
  | 'rejected'
  | 'received'
  | 'credited'
  | 'cancelled';

export type ReturnCondition = 'resellable' | 'damaged';

export interface SalesReturnItem {
  id: string;
  delivery_note_item_id?: string | null;
  invoice_item_id?: string | null;
  sales_order_item_id?: string | null;
  product_id?: string | null;
  description: string;
  quantity: string;
  quantity_received: string;
  unit_price: string;
  tax_rate: string;
  discount_percentage?: string | null;
  condition?: ReturnCondition | null;
  restock: boolean;
}

export interface SalesReturn {
  id: string;
  return_number: string;
  date: string;
  status: SalesReturnStatus | string;
  contact_id: string;
  contact?: CoreContactRef | null;
  sales_order_id?: string | null;
  delivery_note_id?: string | null;
  invoice_id?: string | null;
  warehouse_id?: string | null;
  reason: string;
  notes?: string | null;
  rejection_reason?: string | null;
  credit_note_id?: string | null;
  approved_at?: string | null;
  received_at?: string | null;
  credited_at?: string | null;
  items?: SalesReturnItem[];
}

export interface SalesReturnPayload {
  delivery_note_id?: string | null;
  invoice_id?: string | null;
  warehouse_id?: string | null;
  date?: string | null;
  reason: string;
  notes?: string | null;
  items: {
    delivery_note_item_id?: string | null;
    invoice_item_id?: string | null;
    quantity: number | string;
    condition?: ReturnCondition | null;
    restock?: boolean | null;
  }[];
}

export interface SalesReturnReceivePayload {
  warehouse_id?: string | null;
  items?: {
    id: string;
    quantity_received: number | string;
    condition?: ReturnCondition | null;
    restock?: boolean | null;
  }[];
}

export type DiscountType = 'percentage' | 'fixed_amount';

export interface DiscountPolicyRule {
  id?: string;
  product_id?: string | null;
  customer_group_id?: string | null;
  contact_id?: string | null;
  min_threshold?: string | number | null;
  discount_percent?: string | number | null;
  discount_fixed_amount?: string | number | null;
}

export interface DiscountPolicy {
  id: string;
  code: string;
  name: string;
  discount_type: DiscountType;
  value: string;
  min_order_amount?: string | null;
  min_quantity?: string | null;
  valid_from?: string | null;
  valid_to?: string | null;
  is_active: boolean;
  priority: number;
  is_stackable: boolean;
  auto_apply: boolean;
  contact_id?: string | null;
  rules?: DiscountPolicyRule[];
}

export interface DiscountPolicyPayload {
  code: string;
  name: string;
  discount_type: DiscountType;
  value: number | string;
  min_order_amount?: number | string | null;
  min_quantity?: number | string | null;
  valid_from?: string | null;
  valid_to?: string | null;
  is_active?: boolean;
  priority?: number;
  is_stackable?: boolean;
  auto_apply?: boolean;
  contact_id?: string | null;
  rules?: DiscountPolicyRule[];
}

export interface PriceLookupParams {
  product_id: string;
  contact_id?: string | null;
  quantity?: number | string | null;
  date?: string | null;
  price_list_id?: string | null;
  discount_policy_id?: string | null;
  order_amount?: number | string | null;
}

export type PriceLookupResult = Record<string, unknown>;

export interface CustomerCreditProfile {
  id: string;
  customer_id: string;
  credit_limit: string;
  used_credit: string;
  pending_orders_amount: string;
  total_exposure: string;
  overdue_amount: string;
  max_overdue_days: number;
  credit_status: string;
  risk_rating?: string | null;
  is_credit_hold: boolean;
  hold_reason?: string | null;
  last_evaluated_at?: string | null;
}

export interface SalesListFilterParams {
  status?: string;
  contact_id?: string;
  page?: number;
  per_page?: number;
  search?: string;
}

export interface SalesOrderLineFilterParams {
  contact_id?: string;
  product_id?: string;
  open?: boolean;
  page?: number;
  per_page?: number;
}
