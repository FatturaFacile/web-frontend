import { LaravelPaginationMeta } from './api.models';

/**
 * Accounts receivable and credit management (Mod 013, issue #165): `/api/v1/invoicing/receivables`.
 * Amounts are decimal strings with two decimals; they are formatted for display and never used for money arithmetic.
 */

export type ArItemStatus =
  | 'open'
  | 'partially_paid'
  | 'paid'
  | 'overdue'
  | 'disputed'
  | 'written_off';

export type ArAllocationType =
  | 'payment'
  | 'credit_note'
  | 'debit_adjustment'
  | 'write_off'
  | 'discount';

export type ArReactionPolicy = 'warning' | 'block_order' | 'block_delivery_note' | 'credit_hold';
export type ArOverrideScope = 'all' | 'order' | 'delivery_note';
export type ArDecisionOutcome = 'ok' | 'warning' | 'block';
export type ArRiskRating = 'low' | 'medium' | 'high' | 'critical';
export type ArStatementLocale = 'it' | 'de' | 'fr' | 'en';

/** `document` for an invoice line, otherwise the allocation type that settled it. */
export type ArMovementKind = 'document' | ArAllocationType;

export const AR_ITEM_STATUSES: readonly ArItemStatus[] = [
  'open',
  'partially_paid',
  'paid',
  'overdue',
  'disputed',
  'written_off',
];
export const AR_ALLOCATION_TYPES: readonly ArAllocationType[] = [
  'payment',
  'credit_note',
  'debit_adjustment',
  'write_off',
  'discount',
];
export const AR_REACTION_POLICIES: readonly ArReactionPolicy[] = [
  'warning',
  'block_order',
  'block_delivery_note',
  'credit_hold',
];
export const AR_OVERRIDE_SCOPES: readonly ArOverrideScope[] = ['all', 'order', 'delivery_note'];
export const AR_STATEMENT_LOCALES: readonly ArStatementLocale[] = ['it', 'de', 'fr', 'en'];

/** The `{ data }` envelope of the read endpoints. */
export interface ArEnvelope<T> {
  data: T;
}

/** Laravel resource pagination. */
export interface ArPage<T> {
  data: T[];
  links?: Record<string, string | null>;
  meta: LaravelPaginationMeta;
}

/** One aging bucket as configured for the tenant: render the columns from this list, never hardcode them. */
export interface ArBucket {
  key: string;
  from: number | null;
  to: number | null;
}

export interface ArAgingCustomer {
  customer_id: string;
  customer_name: string;
  buckets: Record<string, string>;
  total_open: string;
  total_overdue: string;
  items: number;
}

export interface ArAging {
  as_of: string;
  currency: string;
  available_currencies: string[];
  buckets: ArBucket[];
  totals: Record<string, string>;
  total_open: string;
  total_overdue: string;
  over_90: string;
  customers: ArAgingCustomer[];
}

export interface ArKpis {
  total_exposure: string;
  total_open: string;
  overdue_amount: string;
  over_90: string;
  /** `null` when there are receivables but no sales in the period. */
  dso: number | string | null;
  bad_debt_provision: string;
  net_realizable_value: string;
  blocked_customers: number;
  active_overrides: number;
}

export interface ArBlockedCustomer {
  customer_id: string;
  reason: string | null;
  exposure: string;
  limit: string;
}

export interface ArDashboard {
  as_of: string;
  currency: string;
  kpis: ArKpis;
  aging: ArAging;
  blocked: ArBlockedCustomer[];
}

export interface ArAllocation {
  id: string;
  receivable_item_id: string;
  source_type: ArAllocationType;
  origin: string | null;
  source_id: string | null;
  source_reference: string | null;
  amount: string;
  value_date: string;
  notes: string | null;
  allocated_by: string | null;
  reversed_at: string | null;
}

export interface ArItem {
  id: string;
  customer_id: string;
  invoice_id: string | null;
  sequence: number;
  document_type: string;
  document_number: string;
  currency: string;
  original_amount: string;
  open_amount: string;
  settled_amount: string;
  issue_date: string;
  due_date: string;
  value_date: string | null;
  status: ArItemStatus;
  stored_status: ArItemStatus;
  days_past_due: number;
  dispute_reason: string | null;
  allocations?: ArAllocation[];
}

export interface ArItemFilters {
  customer_id?: string;
  status?: ArItemStatus;
  document_type?: string;
  currency?: string;
  due_from?: string;
  due_to?: string;
  issued_from?: string;
  issued_to?: string;
  value_from?: string;
  value_to?: string;
  /** Bucket key of the aging report (drill-down). */
  bucket?: string;
  open_only?: boolean;
  per_page?: number;
  page?: number;
}

export interface ArDisputePayload {
  disputed: boolean;
  reason?: string;
}

export interface ArAllocationLine {
  receivable_item_id: string;
  type: ArAllocationType;
  amount: string;
  value_date: string;
  /** Ledger entry id of an unreconciled payment, or the credit note invoice id. */
  source_id?: string | null;
  reference?: string | null;
  notes?: string | null;
}

export interface ArAllocatePayload {
  allocations: ArAllocationLine[];
}

export interface ArAllocateResult {
  allocations: ArAllocation[];
  items: ArItem[];
}

export interface ArLedgerFilters {
  from?: string;
  to?: string;
  document_type?: string;
  status?: ArItemStatus;
  currency?: string;
}

export interface ArLedgerMovement {
  date: string;
  value_date: string;
  kind: ArMovementKind;
  document_type: string;
  reference: string | null;
  receivable_item_id: string;
  allocation_id: string | null;
  currency: string;
  debit: string;
  credit: string;
  due_date: string | null;
  status: ArItemStatus | null;
  balance: string;
}

export interface ArLedger {
  movements: ArLedgerMovement[];
  closing_balance: string;
}

export interface ArUnreconciledPayment {
  ledger_entry_id: string;
  reference: string | null;
  date: string;
  currency: string;
  amount: string;
  unallocated: string;
}

export interface ArCreditLimit {
  id: string;
  customer_id: string;
  currency: string;
  granted_limit: string;
  insured_limit: string;
  insured_cover: string;
  insurer_name: string | null;
  policy_number: string | null;
  coverage_percentage: string;
  max_overdue_days: number | null;
  overdue_tolerance_amount: string;
  reaction_policy: ArReactionPolicy;
  valid_from: string;
  valid_to: string | null;
  is_active: boolean;
  notes: string | null;
}

export interface ArCreditLimitPayload {
  customer_id: string;
  currency: string;
  granted_limit: string;
  insured_limit?: string | null;
  insurer_name?: string | null;
  policy_number?: string | null;
  coverage_percentage?: string | null;
  max_overdue_days?: number | null;
  overdue_tolerance_amount?: string | null;
  reaction_policy: ArReactionPolicy;
  valid_from: string;
  valid_to?: string | null;
  is_active?: boolean;
  notes?: string | null;
}

export type ArCreditLimitUpdate = Partial<Omit<ArCreditLimitPayload, 'customer_id'>>;

export interface ArOverride {
  id: string;
  customer_id: string;
  scope: ArOverrideScope;
  reason: string;
  authorized_by: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  revoke_reason: string | null;
  created_at: string;
}

export interface ArOverridePayload {
  scope: ArOverrideScope;
  reason: string;
  expires_at?: string | null;
}

export interface ArExposure {
  open_invoices: string;
  unbilled_delivery_notes: string;
  confirmed_orders: string;
  unreconciled_payments: string;
  total_exposure: string;
  overdue_amount: string;
  overdue_items: number;
  max_days_past_due: number;
}

export interface ArCreditDecision {
  outcome: ArDecisionOutcome;
  breaches: string[];
  reason: string | null;
  exposure: string;
  limit: string;
  overridden: boolean;
  reaction_policy: ArReactionPolicy | null;
}

export interface ArCreditPosition {
  customer_id: string;
  as_of: string;
  limit: ArCreditLimit | null;
  exposure: ArExposure;
  utilization_percent: number | string | null;
  available_credit: string | null;
  insured_cover: string;
  uninsured_exposure: string;
  is_credit_hold: boolean;
  is_blocked: boolean;
  decision: ArCreditDecision;
  overrides: ArOverride[];
}

export interface ArRiskFactor {
  key: string;
  value: number | string | null;
  points: number;
}

export interface ArRisk {
  customer_id: string;
  score: number;
  rating: ArRiskRating;
  factors: ArRiskFactor[];
  blocked: boolean;
}

export interface ArDso {
  as_of: string;
  period_days: number;
  currency: string;
  receivables: string;
  credit_sales: string;
  dso: number | string | null;
}

export interface ArProvisionLine {
  key: string;
  from: number | null;
  to: number | null;
  open_amount: string;
  rate_percent: string;
  provision: string;
  is_default_rate: boolean;
}

export interface ArProvision {
  as_of: string;
  currency: string;
  lines: ArProvisionLine[];
  total_open: string;
  total_provision: string;
  net_realizable_value: string;
}

export type ArProvisionRates = Record<string, number | string>;

/** Result of booking the provision to the general ledger: only the difference to what is already booked is posted. */
export interface ArProvisionPostingResult {
  posted: boolean;
  total_provision: string;
  previous_provision: string;
  adjustment_amount: string;
  posting: { id: string; journal_entry_id: string | null; as_of: string; currency: string } | null;
}

export interface ArStatementOpenItem {
  receivable_item_id: string;
  document_type: string;
  document_number: string;
  issue_date: string;
  due_date: string;
  original_amount: string;
  open_amount: string;
  days_past_due: number;
  is_overdue: boolean;
  status: ArItemStatus;
}

export interface ArStatement {
  tenant: { id: string; name: string };
  customer: { id: string; name: string; email: string | null };
  currency: string;
  period: { from: string; to: string };
  as_of: string;
  opening_balance: string;
  movements: ArLedgerMovement[];
  closing_balance: string;
  open_items: ArStatementOpenItem[];
  total_open: string;
  total_overdue: string;
  aging: ArAging;
  credit: {
    granted_limit: string | null;
    total_exposure: string;
    available_credit: string | null;
  };
}

export interface ArStatementPeriod {
  from: string;
  to: string;
  currency?: string;
}

export interface ArStatementSendPayload {
  from: string;
  to: string;
  recipient?: string | null;
  locale?: ArStatementLocale;
}

export interface ArStatementSendResult {
  id: string;
  status: 'queued';
  recipient: string;
}

export interface ArCreditCheckParams {
  customer_id: string;
  scope: 'order' | 'delivery_note';
  amount?: string;
}

/** Validation (422) body of the API. */
export interface ArValidationError {
  message?: string;
  errors?: Record<string, string[]>;
}
