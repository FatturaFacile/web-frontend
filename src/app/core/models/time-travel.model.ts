/** Wire contracts of the bi-temporal time-travel audit engine (Mod 354, issue #600). Amounts are decimal strings. */

export interface TtEnvelope<T, M = Record<string, unknown>> {
  success: boolean;
  message: string;
  data: T;
  meta?: M;
}

export type TtDomain = 'trial_balance' | 'account_ledger' | 'aging' | 'inventory';
export const TT_DOMAINS: readonly TtDomain[] = ['trial_balance', 'account_ledger', 'aging', 'inventory'];

export type TtAggregateType = 'general_ledger' | 'open_items' | 'inventory_wms' | 'fixed_assets';
export const TT_AGGREGATE_TYPES: readonly TtAggregateType[] = [
  'general_ledger',
  'open_items',
  'inventory_wms',
  'fixed_assets',
];

export type TtValuationMethod = 'WAC' | 'FIFO' | 'LIFO';
export const TT_VALUATION_METHODS: readonly TtValuationMethod[] = ['WAC', 'FIFO', 'LIFO'];

export type TtPartnerType = 'customer' | 'supplier';
export type TtAgingBucket = 'current' | '1_30' | '31_60' | '61_90' | '90_plus';
export const TT_AGING_BUCKETS: readonly TtAgingBucket[] = ['current', '1_30', '31_60', '61_90', '90_plus'];
export type TtDiffStatus = 'unchanged' | 'delta' | 'backdated';

/** Domain filters shared by the state and the cut-off diff endpoints. */
export interface TtFilters {
  account_id?: string;
  partner_type?: TtPartnerType;
  warehouse_id?: string;
  item_id?: string;
}

export interface TtStateQuery extends TtFilters {
  domain: TtDomain;
  valid_at: string;
  known_at: string;
}

export interface TtDiffQuery extends TtFilters {
  domain: TtDomain;
  valid_at: string;
  known_at_from: string;
  known_at_to: string;
}

export interface TtTrialBalanceRow {
  account_id: string;
  account_code: string | null;
  account_name: string | null;
  debit: string;
  credit: string;
  balance: string;
}

export interface TtAccountLedgerRow {
  entry_id: string;
  entry_number: string;
  posting_date: string;
  description: string;
  debit: string;
  credit: string;
  running_balance: string;
  recorded_at: string;
}

export interface TtAgingRow {
  document_id: string;
  document_number: string;
  partner_id: string;
  partner_type: TtPartnerType;
  due_date: string | null;
  amount: string;
  open_amount: string;
  days_overdue: number;
  bucket: TtAgingBucket;
}

export interface TtInventoryRow {
  item_id: string;
  warehouse_id: string;
  lot_id: string | null;
  quantity: string;
  value: string;
  unit_cost: string;
}

export interface TtStateMeta {
  event_count: number;
  checkpoint_used: boolean;
  duration_ms: number;
}

export interface TtStateBase<R, T> {
  domain: TtDomain;
  coordinate: { valid_at: string; known_at: string };
  rows: R[];
  totals: T;
}

export type TtTrialBalanceState = TtStateBase<TtTrialBalanceRow, { debit: string; credit: string; balance: string }>;
export type TtAccountLedgerState = TtStateBase<TtAccountLedgerRow, { debit: string; credit: string; balance: string }>;
export type TtAgingState = TtStateBase<TtAgingRow, { open_amount: string; buckets: Record<TtAgingBucket, string> }>;
export type TtInventoryState = TtStateBase<TtInventoryRow, { quantity: string; value: string }>;
export type TtState = TtTrialBalanceState | TtAccountLedgerState | TtAgingState | TtInventoryState;

export interface TtDiffRow {
  key: string;
  label: string;
  status: TtDiffStatus;
  before: string;
  after: string;
  delta: string;
}

export interface TtBackdatedEntry {
  event_id: string;
  event_type: string;
  aggregate_type: TtAggregateType;
  aggregate_id: string;
  valid_at: string;
  recorded_at: string;
  actor_user_id: string | null;
  actor_name: string | null;
  source_document: string | null;
  amount_delta: string;
  cryptographic_chain_hash: string;
  payload: Record<string, unknown>;
}

export interface TtCutOffDiff {
  domain: TtDomain;
  valid_at: string;
  known_at_from: string;
  known_at_to: string;
  rows: TtDiffRow[];
  backdated_entries: TtBackdatedEntry[];
  totals: { before: string; after: string; delta: string };
}

export interface TtWhatIfRequest {
  valid_at: string;
  known_at: string;
  valuation_method: TtValuationMethod;
  warehouse_id?: string;
  item_id?: string;
  simulation_name?: string;
}

export interface TtValuationSummary {
  method: TtValuationMethod;
  total_value: string;
  total_quantity: string;
}

export interface TtWhatIfItem {
  item_id: string;
  warehouse_id: string;
  quantity: string;
  official_value: string;
  simulated_value: string;
  variance: string;
  variance_pct: string;
}

export interface TtWhatIfResult {
  id: string;
  simulation_name: string | null;
  valuation_method: TtValuationMethod;
  target_valid_at: string;
  target_known_at: string;
  baseline_summary: TtValuationSummary;
  simulated_summary: TtValuationSummary;
  delta_summary: { total_value: string; pct: string };
  items: TtWhatIfItem[];
  created_at: string;
}

export interface TtIntegrityAnchor {
  period_start: string;
  period_end: string;
  merkle_root: string;
  event_count: number;
  matches: boolean;
}

export interface TtIntegrityReport {
  verified: boolean;
  events_checked: number;
  broken_at: { event_id: string; sequence_number: number; reason: string } | null;
  merkle_root: string | null;
  anchors: TtIntegrityAnchor[];
  generated_at: string;
  standard_codes: string[];
}

export interface TtCheckpoint {
  id: string;
  aggregate_type: TtAggregateType;
  valid_at: string;
  recorded_at: string;
  event_count: number;
  merkle_root: string;
  last_sequence_number: number;
}

export interface TtCheckpointResult {
  checkpoints: TtCheckpoint[];
}
