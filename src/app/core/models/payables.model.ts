import { LaravelPaginationMeta } from './api.models';

/**
 * Accounts payable and supplier ledger (Mod 015, issue #333): `/api/v1/accounting/payables`.
 * Amounts are decimal strings with two decimals; they are formatted for display and never used for money arithmetic.
 */

/** Payment state of a supplier open item. */
export type ApItemStatus = 'open' | 'in_batch' | 'authorized' | 'paid' | 'disputed' | 'blocked';

export type ApDocumentType = 'xml_invoice' | 'qr_bill' | 'manual_bill' | 'credit_note';

export type ApSkontoState = 'active' | 'expiring' | 'expired' | 'none';

export type ApBatchStatus =
  'draft' | 'pending_approval' | 'approved' | 'rejected' | 'executed' | 'cancelled';

export type ApBlockKind = 'dispute' | 'block';

export const AP_ITEM_STATUSES: readonly ApItemStatus[] = [
  'open',
  'in_batch',
  'authorized',
  'paid',
  'disputed',
  'blocked',
];
export const AP_DOCUMENT_TYPES: readonly ApDocumentType[] = [
  'xml_invoice',
  'qr_bill',
  'manual_bill',
  'credit_note',
];
export const AP_BATCH_STATUSES: readonly ApBatchStatus[] = [
  'draft',
  'pending_approval',
  'approved',
  'rejected',
  'executed',
  'cancelled',
];

/** The `{ data }` envelope of the read endpoints. */
export interface ApEnvelope<T> {
  data: T;
}

/** Laravel resource pagination. */
export interface ApPage<T> {
  data: T[];
  links?: Record<string, string | null>;
  meta: LaravelPaginationMeta;
}

/** Cash-discount (Skonto / Escompte) terms and the opportunity computed by the API as of today. */
export interface ApSkonto {
  /** Discount percentage, e.g. `2.00`. */
  percent: string;
  /** Last day on which the discount can still be taken (`YYYY-MM-DD`). */
  deadline: string;
  /** Days left to the deadline; negative once expired. */
  days_remaining: number;
  /** Cash saved if the item is paid by the deadline. */
  savings: string;
  /** Amount to pay by the deadline. */
  net_payable: string;
  /** Terms as written in the supplier contract (`30 days, 2% within 10 days`). */
  terms: string | null;
}

export interface ApBlockEvent {
  id: string;
  kind: ApBlockKind | 'release';
  reason: string;
  user_name: string | null;
  created_at: string;
}

/** One open item of a supplier: an invoice, a QR bill, a manual bill or a credit note. */
export interface ApItem {
  id: string;
  supplier_id: string;
  supplier_name: string;
  supplier_iban: string | null;
  document_type: ApDocumentType;
  document_number: string;
  issue_date: string;
  due_date: string;
  currency: string;
  original_amount: string;
  open_amount: string;
  status: ApItemStatus;
  /** Reason of the dispute or of the administrative block. */
  block_reason: string | null;
  batch_id: string | null;
  skonto: ApSkonto | null;
  /** Dispute, block and release history (audit trail); present on the detail only. */
  block_history?: ApBlockEvent[];
}

export interface ApItemFilters {
  supplier_id?: string;
  status?: ApItemStatus;
  document_type?: ApDocumentType;
  currency?: string;
  due_from?: string;
  due_to?: string;
  /** Only the items with a cash discount that can still be taken. */
  skonto_only?: boolean;
  open_only?: boolean;
  search?: string;
  per_page?: number;
  page?: number;
}

export interface ApBlockPayload {
  kind: ApBlockKind;
  reason: string;
}

export interface ApReleasePayload {
  reason: string;
}

export interface ApItemSummary {
  total_open: string;
  total_overdue: string;
  skonto_savings: string;
  blocked_count: number;
  currency: string;
}

// --- Payment batches (Distinte di Pagamento) ---

export interface ApProposalParams {
  /** Items due up to this date are proposed (`YYYY-MM-DD`). */
  cutoff_date: string;
  /** Also propose items whose Skonto deadline falls before their due date. */
  prioritize_skonto: boolean;
  currency?: string;
  supplier_id?: string;
  /** Restricts the batch to these items (the wizard re-previews after every tick); omitted = all candidates. */
  item_ids?: string[];
  /** Credit notes to net; omitted = the API nets every open credit note of the suppliers in the batch. */
  set_off_ids?: string[];
}

/** A supplier credit note netted against the invoices of the batch. */
export interface ApSetOff {
  credit_note_id: string;
  credit_note_number: string;
  supplier_id: string;
  supplier_name: string;
  /** Amount of the credit note consumed by the batch. */
  amount: string;
  applied_to_item_ids: string[];
}

export interface ApBatchLine {
  item_id: string;
  supplier_id: string;
  supplier_name: string;
  document_number: string;
  due_date: string;
  open_amount: string;
  /** Amount actually paid after the Skonto. */
  pay_amount: string;
  skonto_taken: boolean;
  skonto_savings: string;
}

/** A bank transfer: the lines of one creditor IBAN and currency are paid with a single transfer. */
export interface ApTransferGroup {
  iban: string;
  supplier_id: string;
  supplier_name: string;
  currency: string;
  gross_amount: string;
  set_off_amount: string;
  skonto_savings: string;
  /** What the bank actually moves. */
  net_amount: string;
  lines: ApBatchLine[];
}

export interface ApBatchTotals {
  gross_amount: string;
  set_off_amount: string;
  skonto_savings: string;
  net_amount: string;
  transfers: number;
  lines: number;
}

export interface ApBatchApproval {
  user_name: string | null;
  decision: 'approved' | 'rejected';
  reason: string | null;
  decided_at: string;
}

export interface ApBatch {
  id: string;
  number: string | null;
  status: ApBatchStatus;
  cutoff_date: string;
  currency: string;
  prioritize_skonto: boolean;
  totals: ApBatchTotals;
  transfers: ApTransferGroup[];
  set_offs: ApSetOff[];
  approval: ApBatchApproval | null;
  executed_at: string | null;
  created_at: string;
}

export interface ApBatchFilters {
  status?: ApBatchStatus;
  per_page?: number;
  page?: number;
}

export interface ApBatchCreatePayload {
  cutoff_date: string;
  prioritize_skonto: boolean;
  currency?: string;
  /** Items ticked in the wizard; the credit notes netted are the ones of `set_off_ids`. */
  item_ids: string[];
  set_off_ids: string[];
}

export interface ApBatchDecisionPayload {
  reason?: string;
}

/** What the wizard shows before the batch is finalised: nothing is saved by the preview. */
export interface ApBatchPreview {
  cutoff_date: string;
  currency: string;
  candidates: ApItem[];
  credit_notes: ApItem[];
  excluded: { item_id: string; reason: 'disputed' | 'blocked' | 'in_batch' }[];
  batch: ApBatch;
}

// --- Aging ---

export interface ApAgingBucket {
  key: string;
  from: number | null;
  to: number | null;
}

export interface ApAgingSupplier {
  supplier_id: string;
  supplier_name: string;
  buckets: Record<string, string>;
  total_open: string;
  total_overdue: string;
  items: number;
}

export interface ApAging {
  as_of: string;
  currency: string;
  available_currencies: string[];
  buckets: ApAgingBucket[];
  totals: Record<string, string>;
  total_open: string;
  total_overdue: string;
  suppliers: ApAgingSupplier[];
}

export interface ApAgingFilters {
  as_of?: string;
  currency?: string;
  supplier_id?: string;
}

export type ApExportFormat = 'xlsx' | 'pdf';

export interface ApValidationError {
  message?: string;
  errors?: Record<string, string[]>;
}
