/** Order statuses of the procurement module (`fully_received` is now `received`, `sent` is new). */
export type PurchaseOrderStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'sent'
  | 'partially_received'
  | 'received'
  | 'closed'
  | 'cancelled';

export type PurchaseOrderType = 'standard' | 'blanket_release' | 'subcontract';

export type RequisitionStatus =
  | 'draft'
  | 'pending_approval'
  | 'submitted'
  | 'approved'
  | 'rejected'
  | 'sourcing'
  | 'converted_to_po'
  | 'converted'
  | 'cancelled';

export interface Requisition {
  id: string;
  requisition_number: string;
  requested_by: string;
  department?: string;
  status: RequisitionStatus;
  date: string;
  total_estimated: number;
  currency: 'EUR' | 'CHF';
  notes?: string;
  rejection_reason?: string;
}

export interface RequisitionFilterParams {
  page?: number;
  per_page?: number;
  search?: string;
  status?: RequisitionStatus;
}

export interface CreateRequisitionPayload {
  requested_by: string;
  department?: string;
  total_estimated: number;
  currency: 'EUR' | 'CHF';
  notes?: string;
}

export type GoodsReceiptInspectionStatus = 'pending' | 'passed' | 'failed' | 'conditional';

/**
 * Result of a three-way match. The code also writes `price_variance` and `quantity_variance` (the OpenAPI enum lists
 * `discrepancy`), so every value is kept.
 */
export type ThreeWayMatchStatus =
  | 'matched'
  | 'price_variance'
  | 'quantity_variance'
  | 'discrepancy'
  | 'escalated_to_workflow'
  | 'rejected'
  | string;

/** Approval status of a supplier invoice; `match_blocked` means the three-way match failed beyond tolerance. */
export type SupplierInvoiceApprovalStatus =
  | 'not_required'
  | 'pending'
  | 'in_approval'
  | 'approved'
  | 'rejected'
  | 'match_blocked'
  | string;

/** Decimals (quantities, prices, amounts, rates) arrive from the API as strings. */
export interface PurchaseOrderLine {
  id: string;
  line_number: number;
  description: string;
  supplier_catalog_id?: string | null;
  supplier_contract_line_id?: string | null;
  quantity_ordered: string;
  quantity_received: string;
  quantity_returned: string;
  quantity_invoiced: string;
  uom: string;
  unit_price: string;
  list_unit_price?: string | null;
  tax_rate: string;
  line_net_amount: string;
  line_tax_amount: string;
  line_total_amount: string;
  is_closed: boolean;
}

export interface PurchaseOrderSupplier {
  id: string;
  supplier_code: string;
  company_name: string;
  vat_number?: string | null;
  status?: string;
  qualification_status?: string;
  currency?: string;
}

export interface PurchaseOrder {
  id: string;
  po_number: string;
  supplier_id: string;
  status: PurchaseOrderStatus;
  order_type: PurchaseOrderType | null;
  order_date: string | null;
  expected_delivery_date: string | null;
  currency: string;
  exchange_rate: string;
  net_amount: string;
  tax_amount: string;
  total_amount: string;
  is_budget_encumbered: boolean;
  budget_committed_amount: string;
  is_locked: boolean;
  supplier_contract_id?: string | null;
  purchase_requisition_id?: string | null;
  rfq_id?: string | null;
  cost_center_id?: string | null;
  project_id?: string | null;
  workflow_instance_id?: string | null;
  submitted_at?: string | null;
  approved_at?: string | null;
  approved_by?: string | null;
  sent_at?: string | null;
  payment_terms_code?: string | null;
  incoterms?: string | null;
  notes?: string | null;
  supplier?: PurchaseOrderSupplier;
  lines?: PurchaseOrderLine[];
  receipts?: GoodsReceipt[];
  created_at?: string | null;
}

export interface PurchaseOrderFilterParams {
  page?: number;
  per_page?: number;
  status?: PurchaseOrderStatus;
  supplier_id?: string;
  sort?: string;
}

/** A supplier of the procurement module (`GET /procurement/suppliers`). */
export interface ProcurementSupplier {
  id: string;
  supplier_code: string;
  company_name: string;
  vat_number?: string | null;
  status?: string;
  currency?: string;
  payment_terms_code?: string | null;
  qualification_status?: string;
}

export interface CreatePurchaseOrderPayload {
  supplier_id: string;
  order_date: string;
  expected_delivery_date: string;
  po_number?: string;
  order_type?: PurchaseOrderType | null;
  currency?: string | null;
  notes?: string | null;
  lines: {
    description?: string | null;
    quantity_ordered: number;
    unit_price?: number | null;
    uom?: string | null;
    tax_rate?: number | null;
    expected_delivery_date?: string | null;
  }[];
}

export interface GoodsReceiptLine {
  id: string;
  purchase_order_line_id: string;
  quantity_received: string;
  quantity_accepted: string;
  quantity_rejected: string;
  quantity_released: string;
  quantity_returned: string;
  unit_cost?: string | null;
  inspection_status: string;
  lot_number?: string | null;
  serial_numbers?: string[] | unknown[];
  warehouse_bin_id?: string | null;
  landed_cost_amount?: string;
  rejection_reason?: string | null;
}

export interface GoodsReceipt {
  id: string;
  receipt_number: string;
  purchase_order_id: string;
  supplier_delivery_note_ref: string | null;
  received_date: string | null;
  received_by_user_id?: string;
  warehouse_id?: string | null;
  inspection_required: boolean;
  inspection_status: GoodsReceiptInspectionStatus | string | null;
  inspected_at?: string | null;
  landed_cost_amount?: string;
  lines?: GoodsReceiptLine[];
  created_at?: string | null;
}

export interface ProcessGoodsReceiptPayload {
  supplier_delivery_note_ref: string;
  received_date: string;
  warehouse_id?: string | null;
  inspection_required?: boolean;
  receipt_number?: string;
  inspection_status?: 'passed' | 'failed' | 'conditional' | null;
  notes?: string | null;
  lines: {
    purchase_order_line_id: string;
    quantity_received: number;
    quantity_accepted?: number | null;
    quantity_rejected?: number | null;
    lot_number?: string | null;
    rejection_reason?: string | null;
  }[];
}

/** Quality inspection of a receipt: the quantity released to stock, line by line. */
export interface InspectGoodsReceiptPayload {
  results: {
    purchase_receipt_line_id: string;
    quantity_released: number;
    notes?: string | null;
  }[];
}

export interface ThreeWayMatchLog {
  id: string;
  purchase_order_id: string;
  purchase_receipt_id: string;
  passive_invoice_id: string;
  match_status: ThreeWayMatchStatus;
  po_total_amount: number;
  grn_total_amount: number;
  invoice_total_amount: number;
  variance_amount: number;
  variance_percentage: number;
  discrepancy_details?: unknown[];
  evaluated_at: string;
}

export interface ExecuteThreeWayMatchPayload {
  purchase_order_id: string;
  purchase_receipt_id: string;
  passive_invoice_id: string;
  invoice_total_amount: number;
}

/** Body of `POST /procurement/three-way-match/{id}/approve-variance`. */
export interface ApproveThreeWayVariancePayload {
  reason?: string | null;
  suggestion_ids?: string[];
  passive_invoice_id?: string | null;
  credit_note_reference?: string | null;
  cost_center_id?: string | null;
}

/** A received supplier document (passive invoice): the API returns the record's own columns. */
export interface SupplierInvoice {
  id: string;
  supplier_id: string | null;
  invoice_number: string;
  document_type?: string | null;
  date: string;
  due_date?: string | null;
  currency: string;
  total_net?: string | null;
  total_tax?: string | null;
  total_amount: string;
  total_paid?: string | null;
  payment_status?: 'unpaid' | 'partially_paid' | 'paid' | string | null;
  approval_status?: SupplierInvoiceApprovalStatus | null;
  match_status?: string | null;
  purchase_order_id?: string | null;
  cost_center_id?: string | null;
  is_reconciled?: boolean;
  sdi_file_name?: string | null;
}

export interface SupplierInvoiceApproval {
  invoice_id: string;
  approval_status: SupplierInvoiceApprovalStatus;
  is_payment_blocked: boolean | string;
  cost_center_id?: string | null;
  workflow_instance_id?: string | null;
  decided_at?: string | null;
  steps: {
    id: string;
    tier_level: number;
    assigned_role: string | null;
    assigned_user_id: string | null;
    status: string;
  }[];
}

/** One invoice (or document) registered from a received FatturaPA XML. */
export interface ReceivedPassiveInvoice {
  duplicate: boolean;
  invoice: SupplierInvoice;
}
