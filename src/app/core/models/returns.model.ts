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

// Mod 232: Reverse Logistics, Advance Replacements, Grading/B-Stock & Credit Note VAT Control
export type CustomerReturnChannel = 'backoffice' | 'portal_b2b' | 'portal_b2c';
export type AdvanceReplacementStatus = 'pending_defective_return' | 'defective_received' | 'overdue_billed' | 'cancelled';
export type AdvanceReplacementUnitType = 'new' | 'refurbished';
export type ReturnGrade = 'grade_a' | 'grade_b' | 'grade_c' | 'scrap_or_supplier';
export type ReturnGradingDisposition = 'restock_primary' | 'convert_b_stock' | 'return_to_supplier' | 'scrap';
export type RefurbishedWorkOrderStatus = 'pending_reconditioning' | 'in_progress' | 'completed';

export interface ReverseLogisticsConfig {
  settings: {
    return_window_days: number;
    warranty_window_days: number;
    default_restocking_fee_percent: string;
    advance_replacement_sla_days: number;
    outlet_devaluation_grade_b_percent: string;
    outlet_devaluation_grade_c_percent: string;
  };
  reason_codes: { code: string; label: string; is_defect: boolean }[];
  grades: { code: ReturnGrade; label: string; default_disposition: ReturnGradingDisposition; default_devaluation_percent: string }[];
  tax_rules: {
    it_art26_summary: string;
    it_art26_n2_2_explanation: string;
    ch_art41_summary: string;
  };
}

export interface ReturnEligibilityRequest {
  contact_id: string;
  invoice_id?: string | null;
  delivery_note_id?: string | null;
  reason_code: string;
  requested_on?: string | null;
  restocking_fee_percent?: number | null;
  lines: { invoice_item_id?: string | null; delivery_note_item_id?: string | null; product_id?: string | null; quantity: number }[];
}

export interface ReturnEligibilityResult {
  eligible: boolean;
  within_return_window: boolean;
  within_warranty_window: boolean;
  return_window_days: number;
  warranty_window_days: number;
  days_since_purchase: number;
  source_date: string;
  is_defect_reason: boolean;
  restocking_fee_applicable: boolean;
  restocking_fee_percent: string;
  restocking_fee_amount: string;
  gross_return_amount: string;
  net_refundable_amount: string;
}

export interface ReturnShippingLabel {
  rma_number: string;
  rma_barcode: string;
  barcode_format: string;
  carrier: string;
  tracking_number: string;
  generated_at: string;
}

export interface CustomerReturnLine {
  id: string;
  invoice_item_id: string | null;
  delivery_note_item_id: string | null;
  sales_order_item_id: string | null;
  product_id: string;
  description: string;
  quantity: string;
  quantity_received: string;
  quantity_inspected: string;
  unit_price: string;
  tax_rate: string;
  serial_number: string | null;
  lot_number: string | null;
  reason_code: string | null;
  grade: ReturnGrade | null;
  disposition: ReturnGradingDisposition | null;
  photo_urls: string[];
  inspection_notes: string | null;
  stock_movement_id: string | null;
}

export interface CustomerReturn {
  id: string;
  rma_number: string;
  rma_barcode: string;
  return_tracking_number: string | null;
  carrier: string | null;
  status: RmaStatus;
  channel: CustomerReturnChannel;
  contact_id: string;
  customer_name: string;
  invoice_id: string | null;
  invoice_number: string | null;
  invoice_date: string | null;
  delivery_note_id: string | null;
  delivery_note_number: string | null;
  sales_order_id: string | null;
  warehouse_id: string | null;
  reason_code: string;
  requested_on: string;
  within_return_window: boolean;
  within_warranty_window: boolean;
  window_overridden: boolean;
  days_since_purchase: number;
  restocking_fee_applicable: boolean;
  restocking_fee_percent: string;
  restocking_fee_amount: string;
  gross_return_amount: string;
  net_refundable_amount: string;
  photo_urls: string[];
  customer_notes: string | null;
  internal_notes: string | null;
  resolution_type: string | null;
  credit_note_id: string | null;
  credit_note_reference: string | null;
  lines: CustomerReturnLine[];
  created_at: string;
  updated_at: string;
}

export interface CustomerReturnCreateRequest {
  contact_id: string;
  invoice_id?: string | null;
  delivery_note_id?: string | null;
  sales_order_id?: string | null;
  reason_code: string;
  channel?: CustomerReturnChannel;
  requested_on?: string | null;
  override_window?: boolean;
  restocking_fee_percent?: number | null;
  photo_urls?: string[];
  customer_notes?: string | null;
  lines: {
    invoice_item_id?: string | null;
    delivery_note_item_id?: string | null;
    product_id?: string | null;
    quantity: number;
    serial_number?: string | null;
  }[];
}

export interface AdvanceReplacement {
  id: string;
  replacement_number: string;
  customer_return_id: string | null;
  rma_id: string | null;
  contact_id: string;
  customer_name: string;
  original_invoice_id: string | null;
  faulty_product_id: string;
  faulty_product_name: string | null;
  faulty_serial_number: string | null;
  replacement_product_id: string;
  replacement_product_name: string | null;
  replacement_serial_number: string | null;
  replacement_unit_type: AdvanceReplacementUnitType;
  refurbished_item_id: string | null;
  quantity: string;
  warehouse_id: string | null;
  status: AdvanceReplacementStatus;
  is_overdue: boolean;
  shipped_on: string;
  sla_days: number;
  return_due_on: string;
  defective_received_at: string | null;
  penalty_amount: string;
  currency: string;
  penalty_invoice_id: string | null;
  penalty_invoice_number: string | null;
  billed_at: string | null;
  notes: string | null;
  created_at: string;
}

export interface AdvanceReplacementCreateRequest {
  customer_return_id?: string | null;
  contact_id: string;
  faulty_product_id: string;
  faulty_serial_number?: string | null;
  replacement_product_id?: string | null;
  replacement_serial_number?: string | null;
  replacement_unit_type?: AdvanceReplacementUnitType;
  refurbished_item_id?: string | null;
  quantity?: number;
  warehouse_id?: string | null;
  sla_days?: number;
  penalty_amount?: number | null;
  notes?: string | null;
}

export interface ReturnGradingInspection {
  id: string;
  inspection_number: string;
  customer_return_id: string | null;
  customer_return_line_id: string | null;
  product_id: string;
  product_name: string | null;
  product_sku: string | null;
  serial_number: string | null;
  quantity_inspected: string;
  grade: ReturnGrade;
  disposition: ReturnGradingDisposition;
  checklist: Record<string, boolean>;
  photo_urls: string[];
  original_unit_cost: string;
  devaluation_percent: string;
  revalued_unit_cost: string;
  target_warehouse_id: string | null;
  supplier_id: string | null;
  supplier_return_id: string | null;
  refurbished_item_id: string | null;
  refurbished_sku: string | null;
  inspector_notes: string | null;
  inspected_at: string;
}

export interface ReturnGradingCreateRequest {
  customer_return_id?: string | null;
  customer_return_line_id?: string | null;
  product_id: string;
  serial_number?: string | null;
  quantity_inspected: number;
  grade: ReturnGrade;
  disposition: ReturnGradingDisposition;
  checklist?: Record<string, boolean>;
  photo_urls: string[];
  devaluation_percent?: number | null;
  refurbishment_cost?: number | null;
  target_warehouse_id?: string | null;
  supplier_id?: string | null;
  inspector_notes?: string | null;
}

export interface RefurbishedItem {
  id: string;
  refurbished_sku: string;
  original_product_id: string;
  original_product_name: string | null;
  original_product_sku: string | null;
  grade: ReturnGrade;
  serial_number: string | null;
  quantity: string;
  original_cost: string;
  devaluation_percent: string;
  refurbishment_cost: string;
  new_unit_cost: string;
  suggested_sale_price: string;
  warehouse_id: string | null;
  work_order_status: RefurbishedWorkOrderStatus;
  work_order_steps: Record<string, boolean>;
  is_available: boolean;
  notes: string | null;
  created_at: string;
}

export interface CreditNoteFiscalCheckResult {
  customer_return_id: string;
  rma_number: string;
  jurisdiction: string;
  original_invoice_id: string;
  original_invoice_number: string;
  original_invoice_date: string;
  credit_note_date: string;
  days_elapsed: number;
  art26_one_year_exceeded: boolean;
  is_commercial_agreement: boolean;
  vat_recoverable: boolean;
  proposed_document_type: string;
  proposed_natura: string | null;
  proposed_tax_rate: string | null;
  warning_code: string | null;
  warning_message: string | null;
  dati_fatture_collegate: { id_documento: string; data: string; rma_number: string };
  totals: { net: string; vat: string; gross: string };
}

export interface IssuedReturnCreditNote {
  credit_note_id: string;
  invoice_number: string;
  document_type: string | null;
  vat_nature: string | null;
  total_net: string;
  total_tax: string;
  total_gross: string;
  customer_return_id: string;
}
