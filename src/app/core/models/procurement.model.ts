export type PurchaseOrderStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'ordered'
  | 'received'
  | 'cancelled';

export type RequisitionStatus =
  | 'draft'
  | 'submitted'
  | 'approved'
  | 'rejected'
  | 'converted';

export interface PurchaseOrderItem {
  id?: string;
  product_id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  total: number;
}

export interface PurchaseOrder {
  id: string;
  order_number: string;
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
  rejection_reason?: string;
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
  items: {
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
