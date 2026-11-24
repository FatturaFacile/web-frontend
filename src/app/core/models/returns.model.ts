/** Returns and warranty (RMA). Mirrors the API FormRequests and Resources of the Returns module. */

export type RmaStatus = 'requested' | 'approved' | 'received' | 'inspected' | 'resolved' | 'rejected' | 'closed';
export type RmaDisposition = 'restock' | 'scrap' | 'refurbish' | 'return_to_supplier';
export type RmaResolutionType = 'refund' | 'credit_note' | 'replacement' | 'repair';
export type ReturnsWarrantyStatus = 'active' | 'void';
export type ReturnsCoverageType = 'full' | 'parts' | 'labor' | 'limited';
export type ReturnsClaimStatus = 'open' | 'accepted' | 'rejected' | 'resolved';
export type ReturnsSupplierReturnStatus = 'draft' | 'shipped' | 'credited' | 'closed' | 'cancelled';
export type ReturnsSourceType = 'invoice' | 'sales_order';
export type ReturnsAgeingBucket = '0_7' | '8_30' | '31_60' | 'over_60';
export type ReturnsInvalidReason = 'void' | 'not_started' | 'expired';

export const RMA_STATUSES: readonly RmaStatus[] = ['requested', 'approved', 'received', 'inspected', 'resolved', 'rejected', 'closed'];
export const RMA_DISPOSITIONS: readonly RmaDisposition[] = ['restock', 'scrap', 'refurbish', 'return_to_supplier'];
export const RMA_RESOLUTION_TYPES: readonly RmaResolutionType[] = ['refund', 'credit_note', 'replacement', 'repair'];
export const RETURNS_COVERAGE_TYPES: readonly ReturnsCoverageType[] = ['full', 'parts', 'labor', 'limited'];
export const RETURNS_CLAIM_STATUSES: readonly ReturnsClaimStatus[] = ['open', 'accepted', 'rejected', 'resolved'];
export const RETURNS_SUPPLIER_RETURN_STATUSES: readonly ReturnsSupplierReturnStatus[] = ['draft', 'shipped', 'credited', 'closed', 'cancelled'];
export const RETURNS_AGEING_BUCKETS: readonly ReturnsAgeingBucket[] = ['0_7', '8_30', '31_60', 'over_60'];

/** The API wraps every record or list in `data`; lists that paginate add the Laravel `meta`. */
export interface ReturnsResponse<T> {
  data: T;
  meta?: { current_page: number; last_page: number; per_page: number; total: number };
}

export interface ReturnsReasonCode {
  id: string;
  code: string;
  label: string;
  is_defect: boolean;
  is_active: boolean;
}

export interface ReturnsReasonCodeRequest {
  code: string;
  label: string;
  is_defect?: boolean;
  is_active?: boolean;
}

export interface ReturnsSettings {
  return_window_days: number;
  reason_codes: ReturnsReasonCode[];
}

export interface ReturnsRmaLine {
  id: string;
  invoice_item_id: string | null;
  sales_order_item_id: string | null;
  product_id: string;
  description: string;
  quantity: string;
  quantity_received: string;
  quantity_inspected: string;
  unit_price: string;
  serial_number: string | null;
  lot_number: string | null;
  reason_code: string | null;
  disposition: RmaDisposition | null;
  disposition_warehouse_id: string | null;
  supplier_id: string | null;
  inspection_notes: string | null;
  stock_movement_id: string | null;
}

export interface ReturnsRma {
  id: string;
  rma_number: string;
  status: RmaStatus;
  contact_id: string;
  customer_name: string;
  invoice_id: string | null;
  invoice_number: string | null;
  sales_order_id: string | null;
  warehouse_id: string | null;
  reason_code: string;
  requested_on: string;
  window_overridden: boolean;
  approved_at: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  received_at: string | null;
  inspected_at: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  resolution_type: RmaResolutionType | null;
  refund_amount: string | null;
  credit_note_reference: string | null;
  resolution_notes: string | null;
  notes: string | null;
  allowed_transitions: RmaStatus[];
  lines: ReturnsRmaLine[];
  created_at: string;
  updated_at: string;
}

export interface ReturnsRmaLineRequest {
  invoice_item_id?: string | null;
  sales_order_item_id?: string | null;
  quantity: number;
  serial_number?: string | null;
  lot_number?: string | null;
  reason_code?: string | null;
}

export interface ReturnsRmaRequest {
  contact_id: string;
  invoice_id?: string | null;
  sales_order_id?: string | null;
  reason_code: string;
  requested_on?: string | null;
  override_window?: boolean;
  notes?: string | null;
  lines: ReturnsRmaLineRequest[];
}

export interface ReturnsRmaFilters {
  status?: RmaStatus;
  contact_id?: string;
  reason_code?: string;
  search?: string;
  from?: string;
  to?: string;
  page?: number;
  per_page?: number;
}

export interface ReturnsRmaReceiveRequest {
  warehouse_id?: string | null;
  lines?: { id: string; quantity_received: number }[];
}

export interface ReturnsRmaInspectLineRequest {
  id: string;
  quantity_inspected?: number | null;
  disposition: RmaDisposition;
  warehouse_id?: string | null;
  supplier_id?: string | null;
  notes?: string | null;
}

export interface ReturnsRmaResolveRequest {
  resolution_type: RmaResolutionType;
  refund_amount?: number | null;
  credit_note_reference?: string | null;
  warehouse_id?: string | null;
  notes?: string | null;
}

export interface ReturnsSourceLine {
  source_item_id: string;
  product_id: string;
  description: string;
  quantity_sold: string;
  quantity_returned: string;
  quantity_available: string;
  unit_price: string;
}

/** An invoice or sales order of a customer a return can be requested against. */
export interface ReturnsSource {
  type: ReturnsSourceType;
  id: string;
  number: string;
  date: string;
  within_window: boolean;
  lines: ReturnsSourceLine[];
}

export interface ReturnsWarrantyValidity {
  valid: boolean;
  reason: ReturnsInvalidReason | null;
  checked_on: string;
  days_left: number;
}

export interface ReturnsWarranty {
  id: string;
  product_id: string;
  product_name: string | null;
  product_sku: string | null;
  contact_id: string;
  customer_name: string;
  invoice_id: string | null;
  serial_number: string | null;
  lot_number: string | null;
  starts_on: string;
  ends_on: string;
  coverage_type: ReturnsCoverageType;
  coverage_terms: string | null;
  status: ReturnsWarrantyStatus;
  void_reason: string | null;
  validity: ReturnsWarrantyValidity;
  created_at: string;
  updated_at: string;
}

export interface ReturnsWarrantyRequest {
  product_id: string;
  contact_id: string;
  invoice_id?: string | null;
  serial_number?: string | null;
  lot_number?: string | null;
  starts_on: string;
  ends_on: string;
  coverage_type?: ReturnsCoverageType;
  coverage_terms?: string | null;
}

export interface ReturnsWarrantyFilters {
  status?: ReturnsWarrantyStatus;
  product_id?: string;
  contact_id?: string;
  search?: string;
  /** Active warranties ending within that many days from today. */
  expiring?: number;
  /** Active warranties already past their end date. */
  expired?: boolean;
  page?: number;
  per_page?: number;
}

export interface ReturnsWarrantyClaim {
  id: string;
  claim_number: string;
  warranty_id: string;
  serial_number: string | null;
  lot_number: string | null;
  rma_id: string | null;
  rma_number: string | null;
  claim_date: string;
  description: string;
  status: ReturnsClaimStatus;
  is_valid: boolean;
  validity_note: ReturnsInvalidReason | null;
  decision_notes: string | null;
  decided_at: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReturnsWarrantyClaimRequest {
  warranty_id: string;
  rma_id?: string | null;
  claim_date?: string | null;
  description: string;
}

export interface ReturnsClaimFilters {
  status?: ReturnsClaimStatus;
  warranty_id?: string;
  rma_id?: string;
  page?: number;
  per_page?: number;
}

export interface ReturnsSupplierReturnLine {
  id: string;
  product_id: string;
  description: string | null;
  quantity: string;
  unit_cost: string;
  goods_receipt_item_id: string | null;
  rma_line_id: string | null;
  serial_number: string | null;
  lot_number: string | null;
  stock_movement_id: string | null;
}

export interface ReturnsSupplierReturn {
  id: string;
  return_number: string;
  status: ReturnsSupplierReturnStatus;
  supplier_id: string;
  supplier_name: string | null;
  warehouse_id: string | null;
  rma_id: string | null;
  reason_code: string | null;
  carrier: string | null;
  tracking_number: string | null;
  currency: string;
  credit_expected: string;
  credit_received: string | null;
  shipped_at: string | null;
  credited_at: string | null;
  closed_at: string | null;
  cancelled_at: string | null;
  notes: string | null;
  allowed_transitions: ReturnsSupplierReturnStatus[];
  lines: ReturnsSupplierReturnLine[];
  created_at: string;
  updated_at: string;
}

export interface ReturnsSupplierReturnLineRequest {
  product_id: string;
  description?: string | null;
  quantity: number;
  unit_cost?: number | null;
  goods_receipt_item_id?: string | null;
  rma_line_id?: string | null;
  serial_number?: string | null;
  lot_number?: string | null;
}

export interface ReturnsSupplierReturnRequest {
  supplier_id: string;
  warehouse_id?: string | null;
  rma_id?: string | null;
  reason_code?: string | null;
  carrier?: string | null;
  tracking_number?: string | null;
  currency?: string | null;
  credit_expected?: number | null;
  notes?: string | null;
  lines: ReturnsSupplierReturnLineRequest[];
}

export interface ReturnsSupplierReturnShipRequest {
  warehouse_id?: string | null;
  carrier?: string | null;
  tracking_number?: string | null;
}

export interface ReturnsSupplierReturnFilters {
  status?: ReturnsSupplierReturnStatus;
  supplier_id?: string;
  search?: string;
  page?: number;
  per_page?: number;
}

export interface ReturnsSummary {
  period: { from: string; to: string };
  totals: {
    rma_count: number;
    open_rma_count: number;
    refund_value: string;
    open_warranty_claims: number;
    active_warranties: number;
    open_supplier_returns: number;
    supplier_credit_expected: string;
  };
  by_reason: { reason_code: string; rma_count: number; quantity: string }[];
  by_product: {
    product_id: string;
    sku: string | null;
    name: string | null;
    returned_quantity: string;
    sold_quantity: string;
    return_rate: string | null;
  }[];
  ageing: { bucket: ReturnsAgeingBucket; count: number }[];
  by_status: Record<RmaStatus, number>;
}
