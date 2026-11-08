export type PurchaseOrderStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'sent'
  | 'ordered'
  | 'partially_received'
  | 'received'
  | 'closed'
  | 'cancelled';

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

export type GoodsReceiptInspectionStatus = 'pending' | 'passed' | 'failed' | 'conditional';

export type ThreeWayMatchStatus = 'matched' | 'discrepancy' | 'escalated_to_workflow' | 'rejected';

export interface PurchaseOrderItem {
  id?: string;
  purchase_order_id?: string;
  product_id?: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate?: number;
  total?: number;
  received_quantity?: number;
  invoiced_quantity?: number;
}

export interface PurchaseOrder {
  id: string;
  order_number: string;
  po_number?: string;
  supplier_id: string;
  supplier_name: string;
  channel: 'SDI' | 'QR-Bill' | 'Standard';
  status: PurchaseOrderStatus;
  issue_date: string;
  due_date?: string;
  currency: 'EUR' | 'CHF';
  subtotal: number;
  tax_amount: number;
  total: number;
  items?: PurchaseOrderItem[];
  lines?: PurchaseOrderItem[];
  rejection_reason?: string;
  is_budget_encumbered?: boolean;
  is_locked?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface PurchaseOrderFilterParams {
  page?: number;
  per_page?: number;
  search?: string;
  status?: PurchaseOrderStatus;
  supplier_id?: string;
}

export interface CreatePurchaseOrderPayload {
  supplier_id: string;
  supplier_name?: string;
  currency: 'EUR' | 'CHF';
  issue_date: string;
  due_date?: string;
  channel?: 'SDI' | 'QR-Bill' | 'Standard';
  notes?: string;
  items: {
    product_id?: string | null;
    description: string;
    quantity: number;
    unit_price: number;
    tax_rate?: number;
  }[];
}

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

export interface GoodsReceiptLine {
  id?: string;
  purchase_order_line_id: string;
  description?: string;
  quantity_received: number;
  quantity_accepted?: number | null;
  quantity_rejected?: number | null;
  lot_number?: string | null;
  serial_number?: string | null;
  warehouse_location_id?: string | null;
  rejection_reason?: string | null;
}

export interface GoodsReceipt {
  id: string;
  receipt_number: string;
  purchase_order_id: string;
  purchase_order_number?: string;
  supplier_delivery_note_ref: string;
  received_date: string;
  inspection_status: GoodsReceiptInspectionStatus;
  inspection_required: boolean;
  notes?: string | null;
  lines: GoodsReceiptLine[];
  created_at?: string;
}

export interface ProcessGoodsReceiptPayload {
  supplier_delivery_note_ref: string;
  received_date: string;
  warehouse_id?: string | null;
  inspection_required?: boolean;
  receipt_number?: string;
  inspection_status?: GoodsReceiptInspectionStatus | null;
  notes?: string | null;
  lines: {
    purchase_order_line_id: string;
    quantity_received: number;
    quantity_accepted?: number | null;
    quantity_rejected?: number | null;
    lot_number?: string | null;
    serial_number?: string | null;
    rejection_reason?: string | null;
  }[];
}

export interface ThreeWayMatchLog {
  id: string;
  purchase_order_id: string;
  purchase_order_number?: string;
  purchase_receipt_id?: string;
  receipt_number?: string;
  passive_invoice_id?: string;
  invoice_number?: string;
  supplier_id: string;
  supplier_name?: string;
  status: ThreeWayMatchStatus;
  price_variance: number;
  quantity_variance: number;
  matched_at?: string;
  notes?: string;
}

export interface ExecuteThreeWayMatchPayload {
  purchase_order_id: string;
  purchase_receipt_id: string;
  passive_invoice_id: string;
  invoice_total_amount: number;
}

export interface SupplierInvoice {
  id: string;
  invoice_number: string;
  supplier_id: string;
  supplier_name: string;
  issue_date: string;
  due_date?: string;
  currency: 'EUR' | 'CHF' | string;
  subtotal: number;
  tax_amount: number;
  total: number;
  status: 'draft' | 'pending_approval' | 'approved' | 'paid' | 'rejected' | string;
  channel?: 'SDI' | 'QR-Bill' | 'Standard';
  sdi_identifier?: string;
}
