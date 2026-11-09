/** General ledger extensions: settings, four-eyes, recurring, accruals, close checklist, FX revaluation, reports, budgets. */

export type PostingAccountRole =
  | 'sales_revenue'
  | 'purchase_expense'
  | 'output_vat'
  | 'input_vat'
  | 'receivables'
  | 'payables'
  | 'retained_earnings'
  | 'fx_unrealised_gain'
  | 'fx_unrealised_loss'
  | 'fx_realised_gain'
  | 'fx_realised_loss'
  | 'rounding';

export const POSTING_ACCOUNT_ROLES: readonly PostingAccountRole[] = [
  'sales_revenue',
  'purchase_expense',
  'output_vat',
  'input_vat',
  'receivables',
  'payables',
  'retained_earnings',
  'fx_unrealised_gain',
  'fx_unrealised_loss',
  'fx_realised_gain',
  'fx_realised_loss',
  'rounding',
];

export interface ResolvedPostingAccount {
  account_id: string | null;
  account_code: string | null;
  account_name: string | null;
  source: string | null;
}

export interface LedgerSettings {
  posting_accounts: Partial<Record<PostingAccountRole, ResolvedPostingAccount>>;
  manual_journal_approval_required: boolean;
  manual_journal_approval_threshold: string | null;
}

export interface UpdateLedgerSettingsPayload {
  posting_accounts?: Partial<Record<PostingAccountRole, string | null>>;
  manual_journal_approval_required?: boolean;
  manual_journal_approval_threshold?: number | null;
}

export type ExtendedJournalStatus = 'draft' | 'pending_approval' | 'rejected' | 'posted' | 'reversed';

export interface GlJournalLine {
  id: string;
  line_number: number;
  account_id: string;
  cost_center_id: string | null;
  profit_center_id: string | null;
  project_id: string | null;
  description: string;
  debit_amount: number | string;
  credit_amount: number | string;
  currency: string;
  exchange_rate: number | string;
  amount_in_functional_currency: number | string;
  functional_debit: number | string | null;
  functional_credit: number | string | null;
}

export interface GlJournalEntry {
  id: string;
  entry_number: string;
  journal_number: number | null;
  fiscal_period_id: string;
  posting_date: string;
  document_date: string;
  ledger_type: string;
  journal_type: string;
  description: string;
  status: ExtendedJournalStatus;
  total_amount: string;
  auto_reverse_on: string | null;
  created_by: string | null;
  submitted_by: string | null;
  submitted_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  rejected_by: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  recurring_journal_id: string | null;
  lines?: GlJournalLine[];
}

export type RecurringFrequency = 'monthly' | 'quarterly' | 'semiannual' | 'yearly';
export type RecurringStatus = 'active' | 'paused' | 'ended';

export interface RecurringJournalLine {
  account_id: string;
  debit_amount: string | number | null;
  credit_amount: string | number | null;
  description?: string | null;
  cost_center_id?: string | null;
  profit_center_id?: string | null;
}

export interface RecurringJournal {
  id: string;
  name: string;
  description: string;
  frequency: RecurringFrequency;
  start_date: string | null;
  end_date: string | null;
  next_run_date: string | null;
  last_run_date: string | null;
  reverse_next_day: boolean;
  status: RecurringStatus;
  lines: RecurringJournalLine[];
  runs?: { run_date: string | null; journal_entry_id: string }[];
  created_by: string | null;
  created_at: string | null;
}

export interface CreateRecurringJournalPayload {
  name: string;
  description: string;
  frequency: RecurringFrequency;
  start_date: string;
  end_date?: string | null;
  reverse_next_day?: boolean | null;
  lines: RecurringJournalLine[];
}

export interface ScheduledRunResult {
  as_of: string;
  recurring: { posted: string[]; failed: { recurring_journal_id: string; message: string }[] };
  reversals: { reversed: string[]; failed: { journal_entry_id: string; message: string }[] };
}

export type AccrualType = 'accrued_revenue' | 'accrued_expense' | 'prepaid_expense' | 'deferred_revenue';

export interface Accrual {
  id: string;
  accrual_type: AccrualType;
  description: string;
  total_amount: string;
  coverage_start: string | null;
  coverage_end: string | null;
  cutoff_date: string | null;
  coverage_days: number;
  accrued_days: number;
  amount: string;
  income_statement_account_id: string;
  balance_sheet_account_id: string;
  cost_center_id: string | null;
  journal_entry_id: string | null;
  journal_status: string | null;
  reversal_date: string | null;
  reversal_journal_entry_id: string | null;
}

export interface CreateAccrualPayload {
  accrual_type: AccrualType;
  description: string;
  total_amount: number;
  coverage_start: string;
  coverage_end: string;
  cutoff_date: string;
  income_statement_account_id: string;
  balance_sheet_account_id: string;
  cost_center_id?: string | null;
}

export interface CloseCheck {
  code: string;
  label: string;
  blocking: boolean;
  passed: boolean;
  count: number;
}

export type CloseTaskStatus = 'open' | 'done' | 'waived';

export interface CloseTask {
  id: string;
  fiscal_period_id: string;
  title: string;
  description: string | null;
  is_blocking: boolean;
  status: CloseTaskStatus;
  completed_by: string | null;
  completed_at: string | null;
  completion_note: string | null;
}

export interface CloseChecklist {
  fiscal_period_id: string;
  period_name: string;
  status: string;
  can_close: boolean;
  checks: CloseCheck[];
  tasks: CloseTask[];
}

export interface FxRevaluation {
  id: string;
  revaluation_date: string | null;
  side: 'receivable' | 'payable';
  currency: string;
  account_id: string;
  closing_rate: string;
  open_amount: string;
  book_value: string;
  revalued_value: string;
  difference: string;
  open_items: number;
  journal_entry_id: string | null;
  reversal_date: string | null;
}

export interface Dimension {
  id: string;
  code: string;
  name: string;
  is_active: boolean;
}

export interface DimensionPayload {
  code: string;
  name: string;
  is_active?: boolean;
}

export interface ChartAccountDetail {
  id: string;
  account_code: string | null;
  name: string;
  account_class: string;
  account_type: string;
  normal_balance: 'debit' | 'credit';
  currency: string;
  is_reconciliation_account: boolean;
  reconciliation_type: string | null;
  allows_manual_posting: boolean;
  is_cost_center_mandatory: boolean;
  is_active: boolean;
  reporting_class: string | null;
}

export interface ChartAccountPayload {
  account_code: string;
  name: string;
  account_class?: string | null;
  account_type: string;
  normal_balance: 'debit' | 'credit';
  parent_account_id?: string | null;
  currency?: string | null;
  is_reconciliation_account?: boolean | null;
  reconciliation_type?: string | null;
  allows_manual_posting?: boolean | null;
  is_cost_center_mandatory?: boolean | null;
  is_active?: boolean | null;
  reporting_class?: string | null;
}

// --- Reports (all amounts in the accounting currency, decimal strings) ---

export interface ReportDimensionFilter {
  cost_center_id?: string | null;
  profit_center_id?: string | null;
  project_id?: string | null;
}

export interface TrialBalanceRow {
  account_id: string;
  account_code: string;
  account_name: string;
  account_type: string;
  normal_balance: string;
  opening_balance: string;
  debit: string;
  credit: string;
  closing_balance: string;
  comparison_debit?: string | null;
  comparison_credit?: string | null;
}

export interface LedgerTrialBalance {
  currency: string;
  from: string;
  to: string;
  compare_from: string | null;
  compare_to: string | null;
  accounts: TrialBalanceRow[];
  totals: Record<string, string> | string[];
  is_balanced: boolean;
}

export interface AccountLedgerLine {
  line_id: string;
  journal_entry_id: string;
  entry_number: string;
  journal_number: number | null;
  posting_date: string;
  journal_type: string;
  status: string;
  description: string;
  currency: string;
  debit: string;
  credit: string;
  transaction_currency: string;
  transaction_debit: string;
  transaction_credit: string;
  exchange_rate: string;
  running_balance: string;
}

export interface AccountLedgerReport {
  account: { id: string; account_code: string | null; name: string; account_type: string; normal_balance: string };
  currency: string;
  from: string;
  to: string;
  opening_balance: string;
  closing_balance: string;
  total_debit: string;
  total_credit: string;
  transaction_totals: Record<string, unknown> | null;
  lines: AccountLedgerLine[];
  meta: { current_page: number; last_page: number | null; per_page: number; total: number };
}

export interface StatementAccount {
  account_id: string;
  account_code: string;
  account_name: string;
  amount: string;
  comparison_amount?: string | null;
  variance?: string | null;
}

export interface StatementSection {
  accounts: StatementAccount[];
  total: string;
  comparison_total?: string | null;
  variance?: string | null;
}

export interface LedgerStatementReport {
  currency: string;
  as_of?: string | null;
  compare_as_of?: string | null;
  from?: string | null;
  to?: string | null;
  compare_from?: string | null;
  compare_to?: string | null;
  sections: Record<string, StatementSection>;
  totals: Record<string, string>;
  comparison_totals?: Record<string, string> | null;
  is_balanced?: boolean | null;
}

export type ReportDimension = 'cost_center' | 'profit_center' | 'project';

export interface DimensionReport {
  currency: string;
  dimension: ReportDimension;
  from: string;
  to: string;
  groups: {
    dimension_id: string | null;
    dimension_code: string;
    dimension_name: string;
    accounts: {
      account_id: string;
      account_code: string;
      account_name: string;
      account_type: string;
      debit: string;
      credit: string;
      amount: string;
    }[];
    result: string;
  }[];
  total: string;
}

export interface BudgetLine {
  account_id: string;
  cost_center_id: string | null;
  period_number: number;
  amount: string | number;
}

export interface Budget {
  id: string;
  fiscal_year_id: string;
  name: string;
  version: number;
  status: string;
  notes: string | null;
  approved_by: string | null;
  approved_at: string | null;
  lines?: BudgetLine[];
}

export interface BudgetVarianceReport {
  rows: Record<string, string | null>[];
  totals: { budget: string; actual: string; variance: string };
}

export interface RollingForecastReport {
  as_of_period: unknown;
  method: 'run_rate' | 'budget';
  rows: Record<string, string | null>[];
  totals: { actual_to_date: string; forecast_remaining: string; full_year_forecast: string; full_year_budget: string };
}

export interface GlFiscalPeriod {
  id: string;
  fiscal_year_id: string;
  period_number: number;
  period_name: string;
  start_date: string;
  end_date: string;
  status: string;
}

export interface GlFiscalYear {
  id: string;
  year_code: string;
  start_date: string;
  end_date: string;
  status: string;
  is_locked: boolean;
  closed_at: string | null;
  periods?: GlFiscalPeriod[];
}

export interface FiscalYearClosingRun {
  id: string;
  fiscal_period_id: string;
  closing_type: string;
  status: string;
  closing_journal_id: string | null;
  retained_earnings_journal_id: string | null;
  net_income_amount: string;
  executed_at: string | null;
}

export interface VatRegisterRow {
  protocol_number: string | null;
  posting_date: string;
  document_date: string;
  document_number: string;
  document_type: string;
  partner_name: string | null;
  taxable_amount: string;
  vat_rate: string;
  vat_amount: string;
  vat_treatment: string;
}

export interface VatRegister {
  data: VatRegisterRow[];
  totals: { taxable: string; tax: string };
}
