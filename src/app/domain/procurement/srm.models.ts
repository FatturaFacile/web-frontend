/** Procure-to-pay document types that can start or take part in a document flow. */
export type DocumentFlowNodeType =
  | 'requisition'
  | 'rfq'
  | 'framework_agreement'
  | 'purchase_order'
  | 'goods_receipt'
  | 'supplier_invoice'
  | 'purchase_return';

/** Document types the document-flow endpoint accepts as entry point. */
export type DocumentFlowEntryType = Exclude<DocumentFlowNodeType, 'framework_agreement'>;

export const DOCUMENT_FLOW_ENTRY_TYPES: readonly DocumentFlowEntryType[] = [
  'requisition',
  'rfq',
  'purchase_order',
  'goods_receipt',
  'supplier_invoice',
  'purchase_return',
];

export interface DocumentFlowNode {
  key: string;
  type: DocumentFlowNodeType;
  id: string;
  number: string | null;
  status: string | null;
  date: string | null;
  amount: string | null;
  currency: string | null;
  supplier_id: string | null;
  /** Current matching run of a supplier invoice, used to open its 3-way match detail. */
  run_id: string | null;
  is_anchor: boolean;
}

export interface DocumentFlowEdge {
  from: string;
  to: string;
  relation: string;
}

/** Quantities in the base unit of measure, as decimal strings. */
export interface DocumentFlowQuantities {
  ordered: string;
  received: string;
  invoiced: string;
  returned: string;
  remaining: string;
}

export interface DocumentFlowOrderQuantities extends DocumentFlowQuantities {
  purchase_order_id: string;
  po_number: string | null;
}

export interface DocumentFlow {
  anchor: { type: DocumentFlowEntryType; id: string };
  nodes: DocumentFlowNode[];
  edges: DocumentFlowEdge[];
  quantities: DocumentFlowQuantities;
  orders: DocumentFlowOrderQuantities[];
}

export type SupplierTier = 'A' | 'B' | 'C' | 'D';

export type SupplierRatingComponentKey =
  | 'on_time_delivery_rate'
  | 'quality_acceptance_rate'
  | 'price_competitiveness_score'
  | 'invoice_accuracy_rate'
  | 'rfq_responsiveness_rate';

export const SUPPLIER_RATING_COMPONENTS: readonly SupplierRatingComponentKey[] = [
  'on_time_delivery_rate',
  'quality_acceptance_rate',
  'price_competitiveness_score',
  'invoice_accuracy_rate',
  'rfq_responsiveness_rate',
];

export interface SupplierRating {
  supplier_id: string;
  supplier_name: string;
  qualification_status: string;
  period: { from: string; to: string };
  components: Record<SupplierRatingComponentKey, string | null>;
  weights: Record<SupplierRatingComponentKey, number>;
  score: string | null;
  tier: SupplierTier | null;
  sample: {
    receipt_lines: number;
    order_lines: number;
    matched_invoices: number;
    blocked_invoices: number;
    rfq_invitations: number;
    rfq_responses: number;
  };
}

export interface SpendRow {
  key: string | null;
  label: string | null;
  orders: number;
  spend: string;
}

export interface SrmOverdueOrder {
  purchase_order_id: string;
  po_number: string | null;
  supplier_id: string;
  supplier_name: string | null;
  status: string;
  expected_delivery_date: string | null;
  currency: string;
  open_value: string;
  is_overdue: boolean;
}

export interface SrmBlockedInvoice {
  run_id: string;
  passive_invoice_id: string;
  purchase_order_id: string | null;
  invoice_number: string | null;
  supplier_name: string | null;
  status: string;
  currency: string | null;
  variance_amount: string;
  blocked_at: string | null;
}

export interface SrmDashboard {
  period: { from: string; to: string };
  requisitions: {
    pending_approval: number;
    pending_value: string;
    approved_waiting_sourcing: number;
  };
  rfqs: { open: number; awaiting_award: number; expiring_soon: number };
  orders: {
    open: number;
    open_value: Record<string, string>;
    overdue: number;
    overdue_value: Record<string, string>;
    overdue_list: SrmOverdueOrder[];
  };
  receipts: { pending_inspection: number; awaiting_invoice: number };
  blocked_invoices: { count: number; variance_total: string; items: SrmBlockedInvoice[] };
  spend: { by_supplier: SpendRow[]; by_category: SpendRow[] };
  suppliers: {
    by_qualification: Record<string, number>;
    expiring_documents: number;
    expired_documents: number;
  };
  scorecards: { top: SupplierRating[]; bottom: SupplierRating[] };
}

export interface SrmPeriod {
  from?: string;
  to?: string;
}
