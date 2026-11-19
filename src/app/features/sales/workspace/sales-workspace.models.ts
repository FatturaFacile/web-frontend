/** Wire types of the sales orders workspace and blanket agreement API (`/api/v1/sales-orders`, `/api/v1/blanket-agreements`). */

export interface DataEnvelope<T> {
  data: T;
}

export interface PageMeta {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

export interface PagedEnvelope<T> extends DataEnvelope<T[]> {
  meta: PageMeta;
}

export type AtpStatus =
  'available_on_time' | 'partial_availability' | 'delayed_atp' | 'ctp_required' | 'shortage';

export type FulfillmentSuggestion =
  | 'full_immediate'
  | 'split_partial_and_backorder'
  | 'wait_for_atp_date'
  | 'trigger_procurement_or_production';

export type OrderType = 'standard' | 'call_off' | 'rush' | 'dropship';

export type ResidualMode = 'keep_open' | 'backorder' | 'cancel_residual';

export type CreditBlockReason = 'credit_limit_exceeded' | 'overdue_invoices_present' | 'both';

/** Decimal amounts and quantities travel as strings to keep their precision. */
export interface AtpCheckResult {
  product_id: string;
  warehouse_id: string | null;
  requested_quantity: string;
  available_now_qty: string;
  shortage_qty: string;
  earliest_atp_date: string | null;
  ctp_estimated_date: string | null;
  atp_status: AtpStatus;
  fulfillment_suggestion: FulfillmentSuggestion;
  stock_relevant: boolean;
}

export interface AtpCheckLine {
  product_id: string;
  quantity: number;
  warehouse_id?: string | null;
  requested_date?: string | null;
}

export interface CreditExposure {
  credit_limit: string;
  open_receivables: string;
  committed_orders: string;
  overdue_amount: string;
  overdue_invoices_count: number;
  max_overdue_days: number;
  order_total: string;
  total_exposure: string;
  over_limit: boolean;
  has_overdue: boolean;
  block_reason: CreditBlockReason | null;
}

export interface WorkspaceOrderLine {
  id: string;
  product_id: string | null;
  warehouse_id: string | null;
  blanket_agreement_line_id: string | null;
  parent_line_id: string | null;
  is_backorder: boolean;
  backorder_sequence: number;
  description: string;
  unit_of_measure: string;
  ordered_quantity: string;
  reserved_quantity: string;
  delivered_quantity: string;
  invoiced_quantity: string;
  cancelled_quantity: string;
  backorder_quantity: string;
  requested_date: string | null;
  atp_promised_date: string | null;
  atp_status: AtpStatus | null;
  replenishment_triggered: boolean;
  replenishment_reference_type: 'purchase_requisition' | 'production_order' | null;
  replenishment_reference_id: string | null;
  unit_price: string;
  discount_percent: string;
  tax_rate: string;
  line_subtotal: string;
}

export interface OrderAuditEntry {
  id: string;
  event: string;
  from_status: string | null;
  to_status: string | null;
  actor_id: string | null;
  payload: Record<string, unknown> | null;
  created_at: string | null;
}

export interface ReplenishmentRequestRow {
  id: string;
  sales_order_item_id: string;
  request_type: 'purchase_requisition' | 'production_order';
  quantity: string;
  needed_by: string | null;
  status: string;
}

export interface WorkspaceOrder {
  id: string;
  order_number: string;
  order_type: OrderType;
  status: string;
  contact_id: string;
  customer_name?: string | null;
  blanket_agreement_id: string | null;
  blanket_agreement_number?: string | null;
  warehouse_id: string | null;
  date: string;
  requested_delivery_date: string | null;
  confirmed_delivery_date: string | null;
  currency: string;
  subtotal_amount: string;
  discount_amount: string;
  vat_amount: string;
  total_amount: string;
  credit_status: string;
  credit_block_reason: CreditBlockReason | null;
  credit_approved_at: string | null;
  credit_override_notes: string | null;
  allocated_percentage: string;
  delivered_percentage: string;
  invoiced_percentage: string;
  has_backorders?: boolean;
  notes: string | null;
  credit_exposure?: CreditExposure;
  lines?: WorkspaceOrderLine[];
  delivery_notes?: { id: string; number: string | null; status: string }[];
  replenishment_requests?: ReplenishmentRequestRow[];
  audit_log?: OrderAuditEntry[];
}

export interface WorkspaceOrderLinePayload {
  product_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  warehouse_id?: string | null;
  requested_date?: string | null;
}

export interface WorkspaceOrderPayload {
  contact_id: string;
  warehouse_id?: string | null;
  order_type?: Exclude<OrderType, 'call_off'>;
  requested_delivery_date?: string | null;
  notes?: string | null;
  items: WorkspaceOrderLinePayload[];
}

export interface CreateDdtPayload {
  lines: Record<string, number>;
  residual_mode: ResidualMode;
  carrier_name?: string;
}

export type AgreementType = 'quantity_based' | 'value_based';

export type AgreementStatus = 'draft' | 'active' | 'suspended' | 'exhausted' | 'expired' | 'closed';

export interface BlanketAgreementLine {
  id: string;
  line_number: number;
  product_id: string | null;
  description: string;
  unit_of_measure: string;
  target_quantity: string;
  called_off_quantity: string;
  delivered_quantity: string;
  remaining_quantity: string;
  unit_price: string;
  discount_percent: string;
  tax_rate: string;
  target_amount: string;
  called_off_amount: string;
}

export interface BlanketAgreement {
  id: string;
  agreement_number: string;
  contact_id: string;
  customer_name?: string | null;
  currency_code: string;
  agreement_type: AgreementType;
  valid_from: string;
  valid_to: string;
  days_to_expiry: number;
  status: AgreementStatus;
  total_committed_amount: string;
  total_called_off_amount: string;
  remaining_amount: string;
  called_off_percentage: string;
  over_release_tolerance_percent: string;
  pricing_lock_mode: 'fixed_contract_price' | 'spot_price_with_discount';
  payment_terms: string | null;
  lines?: BlanketAgreementLine[];
}

export interface BlanketAgreementPayload {
  contact_id: string;
  agreement_type: AgreementType;
  valid_from: string;
  valid_to: string;
  currency_code?: string;
  total_committed_amount?: number;
  over_release_tolerance_percent?: number;
  lines: {
    product_id: string | null;
    description: string;
    target_quantity: number;
    unit_price: number;
    discount_percent?: number;
    tax_rate: number;
  }[];
}

export interface CallOffPayload {
  lines: { blanket_agreement_line_id: string; quantity?: number; amount?: number }[];
  requested_delivery_date?: string | null;
}

export interface BackorderMonitorRow {
  sales_order_item_id: string;
  sales_order_id: string;
  order_number: string | null;
  customer_name: string | null;
  product_id: string | null;
  description: string;
  is_backorder: boolean;
  open_quantity: string;
  reserved_quantity: string;
  atp_status: AtpStatus | null;
  atp_promised_date: string | null;
  requested_date: string | null;
  replenishment_triggered: boolean;
  replenishment_reference_type: string | null;
}
