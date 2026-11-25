/**
 * Intercompany accounting and consolidation extensions (Mod 021, `/api/v1/intercompany`).
 * Amounts are strings with four decimals, dates ISO `YYYY-MM-DD`, every enum is a code whose label comes from the
 * translation store (`intercompany.enum.<enumName>.<code>`).
 */

export type IcMirrorMode = 'draft' | 'confirmed';
export type IcLinkStatus = 'pending' | 'drafted' | 'confirmed' | 'reversed' | 'failed' | 'skipped';
export type IcDocumentType = 'invoice' | 'debit_note' | 'credit_note';
export type IcPaymentStatus = 'unpaid' | 'partial' | 'paid';
export type IcNettingStatus = 'draft' | 'confirmed' | 'cancelled';
export type IcMatchStatus = 'unmatched' | 'matched' | 'disputed' | 'written_off' | 'adjusted';
export type IcAnomalyType = 'none' | 'timing' | 'fx' | 'amount' | 'tax' | 'missing_counterpart';
export type IcRateType = 'closing' | 'average' | 'historical';
export type IcRunStatus = 'draft' | 'calculating' | 'review' | 'locked' | 'posted';
export type IcStandard = 'fer30' | 'ifrs10' | 'oic17';
export type IcStatementKind = 'balance_sheet' | 'income_statement' | 'cash_flow' | 'all';
export type IcPartyRole = 'customer' | 'supplier';
export type IcPackageFormat = 'json' | 'csv' | 'xlsx';
export type IcEliminationType =
  | 'intercompany_balance'
  | 'intercompany_revenue_cost'
  | 'investment_equity'
  | 'equity_method'
  | 'translation_difference'
  | 'goodwill'
  | 'goodwill_amortisation'
  | 'unrealised_profit'
  | 'dividend'
  | 'fair_value_release'
  | 'provision_release'
  | 'manual';

export interface IcApiEnvelope<T, M = Record<string, never>> {
  success: boolean;
  message: string;
  data: T;
  meta?: M;
}

export interface IcPaginationMeta {
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
}

export interface IcLookups {
  enums: Record<string, string[]>;
  standards: { code: IcStandard; name_key: string; framework: string }[];
}

// --- Settings, party links, period rates ---

export interface IcSettings {
  id: string;
  group_id: string;
  mirror_mode: IcMirrorMode;
  auto_mirror: boolean;
  sync_payments: boolean;
  netting_enabled: boolean;
  amount_tolerance: string;
  date_tolerance_days: number;
  default_standard: IcStandard;
}

export type IcSettingsPayload = Omit<IcSettings, 'id' | 'group_id'>;

export interface IcPartyLink {
  id: string;
  group_id: string;
  entity_tenant_id: string;
  counterparty_tenant_id: string;
  contact_id: string;
  role: IcPartyRole;
  entity_name?: string;
  counterparty_name?: string;
}

export interface IcPartyLinkPayload {
  entity_tenant_id: string;
  counterparty_tenant_id: string;
  contact_id: string;
  role: IcPartyRole;
}

export interface IcPeriodRate {
  id: string;
  group_id: string;
  currency: string;
  group_currency: string;
  rate_type: IcRateType;
  period_end: string;
  rate: string;
  note: string | null;
}

export interface IcPeriodRatePayload {
  currency: string;
  rate_type: IcRateType;
  period_end: string;
  rate: string;
}

export interface IcPeriodRateFilters {
  currency?: string;
  rate_type?: IcRateType;
  period_end?: string;
}

// --- Transactions (mirror postings) ---

export interface IcSyncEvent {
  id: string;
  transaction_id: string;
  event: string;
  message_key: string | null;
  context: Record<string, unknown>;
  amount: string | null;
  occurred_at: string;
  user_id: string | null;
}

export interface IcTransaction {
  id: string;
  pair_id: string;
  group_id: string;
  document_type: IcDocumentType;
  source_tenant_id: string;
  source_tenant_name: string;
  source_document_id: string;
  source_document_number: string;
  mirror_tenant_id: string;
  mirror_tenant_name: string;
  mirror_document_id: string | null;
  mirror_document_number: string | null;
  mirror_status: IcMirrorMode | null;
  status: IcLinkStatus;
  currency: string;
  net_amount: string;
  tax_amount: string;
  gross_amount: string;
  payment_status: IcPaymentStatus;
  synced_paid_amount: string;
  paid_variance: string;
  document_date: string;
  error_message: string | null;
  version: number;
  idempotency_key: string;
  created_at: string;
  events?: IcSyncEvent[];
}

export interface IcTransactionSummary {
  total: number;
  drafted: number;
  confirmed: number;
  reversed: number;
  failed: number;
  unpaid: number;
  amount_by_currency: Record<string, string>;
}

export type IcTransactionMeta = IcPaginationMeta & { summary: IcTransactionSummary };

export interface IcTransactionFilters {
  status?: IcLinkStatus | '';
  payment_status?: IcPaymentStatus | '';
  source_tenant_id?: string;
  mirror_tenant_id?: string;
  page?: number;
  per_page?: number;
}

export interface IcScanResult {
  created: number;
  skipped: number;
  failed: number;
  transactions: IcTransaction[];
}

// --- Netting ---

export interface IcNettingItem {
  id: string;
  transaction_id: string | null;
  side: 'a' | 'b';
  document_number: string;
  currency: string;
  open_amount: string;
  applied_amount: string;
  fx_rate: string;
  variance: string;
}

export interface IcNettingRun {
  id: string;
  group_id: string;
  entity_a_tenant_id: string;
  entity_b_tenant_id: string;
  as_of_date: string;
  currency: string;
  status: IcNettingStatus;
  receivable_total: string;
  payable_total: string;
  net_amount: string;
  net_direction: 'a_pays_b' | 'b_pays_a' | 'balanced';
  fx_variance: string;
  amount_variance: string;
  version: number;
  items: IcNettingItem[];
}

export interface IcNettingPayload {
  entity_a_tenant_id: string;
  entity_b_tenant_id: string;
  as_of_date: string;
  currency?: string;
}

// --- Reconciliation cockpit ---

export interface IcBatchTotals {
  items: number;
  matched: number;
  unmatched: number;
  disputed: number;
  written_off: number;
  adjusted: number;
  difference_by_anomaly: Record<Exclude<IcAnomalyType, 'none'>, string>;
}

export interface IcReconciliationItem {
  id: string;
  batch_id: string;
  entity_a_tenant_id: string;
  entity_a_name: string;
  entity_b_tenant_id: string;
  entity_b_name: string;
  a_document_id: string;
  a_document_number: string;
  a_document_date: string;
  a_currency: string;
  a_amount: string;
  a_tax: string;
  b_document_id: string | null;
  b_document_number: string | null;
  b_document_date: string | null;
  b_currency: string | null;
  b_amount: string | null;
  b_tax: string | null;
  difference: string;
  difference_group_currency: string;
  status: IcMatchStatus;
  anomaly_type: IcAnomalyType;
  anomaly_reason: string | null;
  match_kind: 'exact' | 'tolerance' | 'manual' | null;
  resolution_reason: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
}

export interface IcReconciliationBatch {
  id: string;
  group_id: string;
  as_of_date: string;
  status: 'open' | 'closed';
  totals: IcBatchTotals;
  created_at: string;
  items?: IcReconciliationItem[];
}

export interface IcReconciliationItemFilters {
  anomaly_type?: IcAnomalyType | '';
  status?: IcMatchStatus | '';
  entity_a_tenant_id?: string;
  entity_b_tenant_id?: string;
}

export type IcAnomalyCounts = Record<Exclude<IcAnomalyType, 'none'>, number>;

export interface IcMatrixCell {
  entity_a_tenant_id: string;
  entity_b_tenant_id: string;
  receivable_a: string;
  payable_b: string;
  difference: string;
  anomaly_counts: IcAnomalyCounts;
  status: 'matched' | 'difference';
  open_items: number;
}

export interface IcMatrix {
  currency: string;
  as_of_date: string;
  entities: { tenant_id: string; name: string }[];
  cells: IcMatrixCell[];
}

// --- Run workflow and analytics ---

export interface IcWorkflowHistoryEntry {
  id: string;
  from_status: IcRunStatus | null;
  to_status: IcRunStatus;
  action: 'advance' | 'reopen' | 'lock' | 'post';
  reason: string | null;
  user_id: string;
  created_at: string;
}

export interface IcRunWorkflow {
  run_id: string;
  status: IcRunStatus;
  version: number;
  history: IcWorkflowHistoryEntry[];
  allowed_transitions: string[];
}

export interface IcScopeCheck {
  code: string;
  passed: boolean;
  entity_tenant_id: string | null;
  detail: string | null;
}

export interface IcScopeValidation {
  ready: boolean;
  checks: IcScopeCheck[];
}

export interface IcEliminationLine {
  line_number: number;
  entity_tenant_id: string | null;
  account_code: string;
  account_name: string;
  account_type: string;
  debit: string;
  credit: string;
  pre_elimination_amount: string;
  post_elimination_amount: string;
}

export interface IcEliminationEntry {
  adjustment_id: string;
  elimination_type: IcEliminationType;
  description: string;
  relation_id: string | null;
  member_tenant_id: string | null;
  amount: string;
  lines: IcEliminationLine[];
}

export interface IcEliminationLedger {
  run_id: string;
  currency: string;
  entries: IcEliminationEntry[];
  totals_by_type: Partial<Record<IcEliminationType, string>>;
}

export interface IcNciRow {
  member_tenant_id: string;
  name: string;
  ownership_percentage: string;
  nci_percentage: string;
  consolidation_method: 'full' | 'proportional' | 'equity';
  nci_net_assets: string;
  nci_profit: string;
  nci_opening: string;
  nci_movement: string;
}

export interface IcNciSchedule {
  currency: string;
  rows: IcNciRow[];
  total_nci_net_assets: string;
  total_nci_profit: string;
}

export interface IcShareholdingRow {
  member_tenant_id: string;
  name: string;
  holder_tenant_id: string | null;
  direct_percentage: string;
  effective_percentage: string;
  voting_percentage: string;
  consolidation_method: 'full' | 'proportional' | 'equity';
  currency: string;
  consolidation_basis: string;
}

export interface IcShareholdings {
  currency: string;
  rows: IcShareholdingRow[];
}

export interface IcStatementLine {
  account_code: string;
  account_name: string;
  standalone: string;
  eliminations: string;
  consolidated: string;
}

export interface IcStatementSection {
  code: string;
  label_key: string;
  lines: IcStatementLine[];
  total: string;
}

export interface IcStatement {
  sections: IcStatementSection[];
  totals: Record<string, string>;
}

export interface IcCashFlow {
  currency?: string;
  operating: string;
  investing: string;
  financing: string;
  fx_effect: string;
  net_change: string;
  opening_cash: string;
  closing_cash: string;
  lines: { code: string; label_key: string; amount: string }[];
}

export interface IcStatements {
  run_id: string;
  standard: IcStandard;
  currency: string;
  period_start: string;
  period_end: string;
  balance_sheet?: IcStatement;
  income_statement?: IcStatement;
  cash_flow?: IcCashFlow;
  translation_reserve: string;
  nci: { net_assets: string; profit: string };
  presentation: Record<string, unknown>;
}

export interface IcPackagePayload {
  balance_sheet: IcStatement;
  income_statement: IcStatement;
  cash_flow: IcCashFlow;
  shareholdings: IcShareholdings;
  nci_schedule: IcNciSchedule;
  reciprocal_reconciliation: unknown;
  elimination_ledger: IcEliminationLedger;
  translation: unknown;
  meta: { standard: IcStandard; run_id: string; currency: string; period_end: string };
}

export interface IcPackage {
  id: string;
  run_id: string;
  standard: IcStandard;
  checksum: string;
  generated_at: string;
  sections: string[];
  payload?: IcPackagePayload;
}
