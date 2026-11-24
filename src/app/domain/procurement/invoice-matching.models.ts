/** Domain types of Mod 048: 2-way / 3-way invoice matching, GR/IR clearing and tolerance rules. */

export const INVOICE_MATCH_STATUSES = [
  'matched',
  'within_tolerance',
  'blocked_discrepancy',
  'pending_credit_note',
  'override_approved',
  'resolved',
] as const;
export type InvoiceMatchStatus = (typeof INVOICE_MATCH_STATUSES)[number];

export const INVOICE_MATCH_LINE_STATUSES = [
  'matched',
  'within_tolerance',
  'price_variance',
  'quantity_variance',
  'not_received',
  'unmatched',
  'accepted',
] as const;
export type InvoiceMatchLineStatus = (typeof INVOICE_MATCH_LINE_STATUSES)[number];

export const INVOICE_MATCH_TYPES = ['2_way', '3_way'] as const;
export type InvoiceMatchType = (typeof INVOICE_MATCH_TYPES)[number];

export const INVOICE_MATCH_REFERENCE_SOURCES = [
  'explicit',
  'linked',
  'xml',
  'ebill',
  'ocr',
  'fallback',
  'none',
] as const;
export type InvoiceMatchReferenceSource = (typeof INVOICE_MATCH_REFERENCE_SOURCES)[number];

export const INVOICE_MATCH_TRIGGERS = ['auto', 'manual', 'batch', 'rematch'] as const;
export type InvoiceMatchTrigger = (typeof INVOICE_MATCH_TRIGGERS)[number];

export const INVOICE_MATCH_REASONS = [
  'no_purchase_order',
  'unmatched_line',
  'price_above_tolerance',
  'quantity_above_received',
  'quantity_above_ordered',
  'not_received',
  'duplicate_billing',
  'currency_mismatch',
  'header_above_tolerance',
] as const;
export type InvoiceMatchReason = (typeof INVOICE_MATCH_REASONS)[number];

export const INVOICE_MATCH_ACTIONS = [
  'request_credit_note',
  'rematch',
  'partial_resolution',
  'override',
] as const;
export type InvoiceMatchAction = (typeof INVOICE_MATCH_ACTIONS)[number];

export const TOLERANCE_SCOPES = ['tenant', 'supplier', 'item_category', 'rule'] as const;
export type ToleranceScope = (typeof TOLERANCE_SCOPES)[number];

/** The scopes ordered from the most to the least specific: the first applicable rule wins. */
export const TOLERANCE_PRECEDENCE: readonly ToleranceScope[] = [
  'rule',
  'supplier',
  'item_category',
  'tenant',
];

export interface InvoiceMatchSummary {
  total: number;
  by_status: Record<InvoiceMatchStatus, number>;
  blocked_count: number;
  blocked_amount: string;
  auto_match_rate: number;
  gr_ir_cleared_amount: string;
}

export interface InvoiceMatchLine {
  id: string;
  line_number: number;
  description: string | null;
  purchase_order_line_id: string | null;
  passive_invoice_line_id: string | null;
  status: InvoiceMatchLineStatus;
  is_blocking: boolean;
  receipt_required: boolean;
  ordered_quantity: number | null;
  received_quantity: number | null;
  previously_invoiced_quantity: number | null;
  invoiced_quantity: number | null;
  ordered_unit_price: number | null;
  invoiced_unit_price: number | null;
  quantity_variance: number;
  price_variance: number;
  price_variance_percent: number;
  amount_variance: number;
  allowed_quantity_variance: number | null;
  allowed_amount_variance: number | null;
  gr_ir_amount: number | null;
  tolerance_rule_id: string | null;
  reasons: string[];
}

export interface InvoiceMatchResolution {
  id: string;
  run_id: string;
  action: InvoiceMatchAction;
  from_status: InvoiceMatchStatus | null;
  to_status: InvoiceMatchStatus | null;
  reason: string | null;
  actor_id: string | null;
  actor_name: string | null;
  context: Record<string, unknown> | null;
  resolved_at: string;
}

export interface InvoiceMatchRun {
  id: string;
  passive_invoice_id: string;
  invoice_number: string | null;
  invoice_date: string | null;
  invoice_due_date: string | null;
  invoice_total_amount: number | null;
  supplier_id: string | null;
  supplier_name: string | null;
  purchase_order_id: string | null;
  po_number: string | null;
  match_type: InvoiceMatchType;
  status: InvoiceMatchStatus;
  is_blocking: boolean;
  trigger: InvoiceMatchTrigger;
  reference_source: InvoiceMatchReferenceSource;
  reference_value: string | null;
  currency: string;
  ordered_total: number;
  received_total: number;
  invoiced_total: number;
  variance_amount: number;
  variance_percent: number;
  gr_ir_amount: number | null;
  price_variance_amount: number | null;
  line_count: number;
  discrepancy_count: number;
  is_current: boolean;
  reasons: string[];
  tolerance_snapshot: Record<string, unknown>[];
  evaluated_at: string | null;
  blocked_at: string | null;
  released_at: string | null;
  lines?: InvoiceMatchLine[];
  resolutions?: InvoiceMatchResolution[];
}

export interface GrIrJournalLine {
  account_code: string;
  account_name: string | null;
  debit_amount: number | string;
  credit_amount: number | string;
  description: string | null;
}

export interface GrIrJournalEntry {
  journal_entry_id: string;
  entry_number: string | null;
  posting_date: string | null;
  status: string | null;
  description: string | null;
  lines: GrIrJournalLine[];
}

export interface GrIrReceiptEntry extends GrIrJournalEntry {
  receipt_id: string | null;
  receipt_number: string | null;
  clearing_amount: number | string | null;
}

export interface InvoiceMatchGrIr {
  currency: string;
  expected_clearing_amount: string;
  expected_variance_amount: string;
  accrued_amount: string;
  cleared_amount: string;
  open_balance: string;
  receipts: GrIrReceiptEntry[];
  invoice: GrIrJournalEntry | null;
}

export interface InvoiceMatchBatchResult {
  processed: number;
  matched: number;
  blocked: number;
  skipped: number;
  run_ids: string[];
}

export interface InvoiceMatchFilters {
  status?: InvoiceMatchStatus;
  match_type?: InvoiceMatchType;
  supplier_id?: string;
  search?: string;
  queue?: 'blocked';
  page?: number;
  per_page?: number;
}

export interface RunMatchingPayload {
  passive_invoice_id: string;
  purchase_order_id?: string;
}

export interface BatchRunPayload {
  supplier_id?: string;
  limit?: number;
  include_unreferenced?: boolean;
}

export interface RequestCreditNotePayload {
  reason: string;
  expected_credit_amount?: number;
}

export interface RematchPayload {
  reason?: string;
}

export interface PartialResolutionPayload {
  reason: string;
  line_ids: string[];
}

export interface OverridePayload {
  reason: string;
}

export interface InvoiceMatchToleranceRule {
  id: string;
  name: string;
  scope: ToleranceScope;
  supplier_id: string | null;
  item_category: string | null;
  match_type: InvoiceMatchType | null;
  priority: number;
  price_tolerance_percent: number;
  price_tolerance_amount: number;
  quantity_tolerance_percent: number | null;
  quantity_tolerance_amount: number | null;
  currency: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string | null;
}

export interface ToleranceRulePayload {
  name: string;
  scope: ToleranceScope;
  supplier_id: string | null;
  item_category: string | null;
  match_type: InvoiceMatchType | null;
  priority: number;
  price_tolerance_percent: number;
  price_tolerance_amount: number;
  quantity_tolerance_percent: number | null;
  quantity_tolerance_amount: number | null;
  currency: string | null;
  is_active: boolean;
  notes: string | null;
}
