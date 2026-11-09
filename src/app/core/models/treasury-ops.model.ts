/** Treasury operations: balances, movements, cash registers, payment proposals, rules, FX, liquidity, KPIs, Ri.Ba., collections. */

export interface BankBalanceSnapshot {
  bank_account_id: string;
  bank_name: string;
  iban: string;
  currency: string;
  date: string;
  book_balance: string | null;
  statement_balance: string | null;
  statement_date: string | null;
  snapshot_balance: string | null;
  current_balance: string;
}

export interface BankAccountBalanceReport {
  bank_account_id: string;
  currency: string;
  from_date: string;
  to_date: string;
  at_end: BankBalanceSnapshot;
}

export type TreasuryMovementType = 'transfer' | 'bank_fee' | 'interest_income' | 'interest_expense';

export interface TreasuryMovement {
  id: string;
  movement_type: TreasuryMovementType;
  bank_account_id: string;
  counter_bank_account_id: string | null;
  amount: string;
  currency: string;
  movement_date: string;
  description: string | null;
  idempotency_key: string;
  journal_entry_id: string | null;
  created_at: string | null;
}

export interface TransferPayload {
  from_bank_account_id: string;
  to_bank_account_id: string;
  amount: number;
  transfer_date: string;
  description?: string | null;
  idempotency_key: string;
}

export interface BankChargePayload {
  movement_type: 'bank_fee' | 'interest_income' | 'interest_expense';
  amount: number;
  movement_date: string;
  description?: string | null;
  idempotency_key: string;
}

export interface CashRegister {
  id: string;
  code: string;
  name: string;
  currency: string;
  gl_account_id: string;
  opening_balance: string;
  current_balance: string;
  last_closed_date: string | null;
  is_active: boolean;
}

export interface CreateCashRegisterPayload {
  code: string;
  name: string;
  currency: string;
  gl_account_id: string;
  opening_balance?: number | null;
}

export interface CashRegisterMovement {
  id: string;
  cash_register_id: string;
  movement_date: string;
  direction: 'in' | 'out';
  payment_method: string;
  amount: string;
  counter_account_id: string;
  description: string;
  reference: string | null;
  journal_entry_id: string | null;
}

export interface CashRegisterMovementPayload {
  movement_date: string;
  direction: 'in' | 'out';
  payment_method?: 'cash' | 'cheque' | null;
  amount: number;
  counter_account_id: string;
  description: string;
  reference?: string | null;
  idempotency_key: string;
}

export interface CashRegisterClosing {
  id: string;
  cash_register_id: string;
  closing_date: string;
  opening_balance: string;
  total_in: string;
  total_out: string;
  expected_balance: string;
  counted_balance: string;
  difference: string;
  difference_journal_entry_id: string | null;
  notes: string | null;
}

export interface CashRegisterClosePayload {
  closing_date: string;
  counted_balance: number;
  notes?: string | null;
}

export type PaymentProposalStatus = 'draft' | 'converted' | 'rejected';
export type PaymentProposalFormat = 'sepa_pain_001_it' | 'iso_pain_001_ch';

export interface PaymentProposalLine {
  passive_invoice_id: string;
  supplier_id: string;
  selection_reason: string;
  due_date: string | null;
  discount_deadline: string | null;
  open_amount: string;
  discount_amount: string;
  amount: string;
}

export interface PaymentProposal {
  id: string;
  proposal_number: string;
  status: PaymentProposalStatus;
  bank_account_id: string;
  format: PaymentProposalFormat;
  execution_date: string;
  due_until: string;
  include_discounts: boolean;
  currency: string;
  total_amount: string;
  total_discount: string;
  item_count: number;
  created_by: string;
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  payment_batch_id: string | null;
  lines?: PaymentProposalLine[];
}

export interface CreatePaymentProposalPayload {
  bank_account_id: string;
  execution_date: string;
  due_until: string;
  include_discounts?: boolean;
  format: PaymentProposalFormat;
  supplier_ids?: string[] | null;
}

export interface PaymentProposalExcluded {
  invoice_id: string;
  invoice_number: string;
  reason: string;
}

export type ReconciliationRuleCategory =
  | 'tax_payment'
  | 'payroll'
  | 'bank_expense'
  | 'internal_transfer'
  | 'generic_expense';

export interface ReconciliationRule {
  id: string;
  name: string;
  priority: number;
  is_active: boolean;
  direction: 'credit' | 'debit' | null;
  expected_amount: string | null;
  amount_tolerance: string;
  min_amount: string | null;
  max_amount: string | null;
  reference_contains: string | null;
  description_contains: string | null;
  counterparty_iban: string | null;
  counterparty_name_contains: string | null;
  category: ReconciliationRuleCategory;
  ledger_account_code: string | null;
}

export interface ReconciliationRulePayload {
  name: string;
  priority?: number;
  is_active?: boolean;
  direction?: 'credit' | 'debit' | null;
  expected_amount?: number | null;
  amount_tolerance?: number;
  min_amount?: number | null;
  max_amount?: number | null;
  reference_contains?: string | null;
  description_contains?: string | null;
  counterparty_iban?: string | null;
  counterparty_name_contains?: string | null;
  category: ReconciliationRuleCategory;
  ledger_account_code?: string | null;
}

export interface BankReconciliation {
  id: string;
  bank_account_id: string;
  reconciliation_number: string;
  period_start_date: string;
  period_end_date: string;
  bank_statement_balance: number;
  gl_book_balance: number;
  difference_amount: number;
  status: string;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string | null;
}

export interface ManualReconciliationMatchPayload {
  bank_reconciliation_id: string;
  matched_entity_type: string;
  matched_entity_id: string;
  allocated_amount?: number | null;
}

export interface FxBankRevaluation {
  id: string;
  bank_account_id: string | null;
  period_end_date: string;
  currency: string;
  closing_rate: string | null;
  foreign_amount: string;
  book_value_base: string;
  revalued_market_base: string;
  unrealized_gain_loss: string;
  gl_journal_entry_id: string | null;
}

export interface FxBankRevaluationPayload {
  period_end_date: string;
  currency?: string | null;
}

export interface ForecastScenario {
  id: string;
  code: string;
  name: string;
  description: string | null;
  collection_delay_days: number;
  disbursement_acceleration_days: number;
  sales_growth_factor: string;
  is_active: boolean;
}

export interface ForecastScenarioPayload {
  code: string;
  name: string;
  description?: string | null;
  collection_delay_days?: number;
  disbursement_acceleration_days?: number;
  sales_growth_factor?: number;
}

export interface LiquidityForecastDay {
  date: string;
  inflows: string;
  outflows: string;
  balance: string;
}

export interface LiquidityScenarioProjection {
  scenario: string;
  name: string;
  assumptions: {
    collection_delay_days: number;
    disbursement_acceleration_days: number;
    sales_growth_factor: string;
  };
  total_inflows: string;
  total_outflows: string;
  closing_balance: string;
  lowest_balance: { date: string; balance: string };
  first_day_below_minimum: string | null;
  net_by_source: Record<string, string>;
  days: LiquidityForecastDay[];
}

export interface LiquidityForecast {
  as_of: string;
  until: string;
  currency: string;
  opening_cash: string;
  minimum_balance: string | null;
  scenarios: LiquidityScenarioProjection[];
}

export interface LiquidityForecastParams {
  horizon_days?: number | null;
  currency?: string | null;
  minimum_balance?: number | null;
}

export type RecurringCashDirection = 'inflow' | 'outflow';
export type RecurringCashFrequency = 'weekly' | 'monthly' | 'quarterly' | 'yearly';

export interface RecurringCashItem {
  id: string;
  name: string;
  category: string;
  direction: RecurringCashDirection;
  amount: string;
  currency: string;
  frequency: RecurringCashFrequency;
  next_date: string;
  end_date: string | null;
  is_active: boolean;
}

export interface RecurringCashItemPayload {
  name: string;
  category?: string;
  direction: RecurringCashDirection;
  amount: number;
  currency: string;
  frequency: RecurringCashFrequency;
  next_date: string;
  end_date?: string | null;
}

export interface TreasuryKpis {
  as_of: string;
  period_from: string;
  period_days: number;
  currency: string;
  sales: string;
  purchases: string;
  open_receivables: string;
  overdue_receivables: string;
  open_payables: string;
  overdue_payables: string;
  cash: string;
  net_liquidity: string;
  quick_ratio: string | null;
  dso_days: string | null;
  dpo_days: string | null;
  dio_days: string | null;
  cash_conversion_cycle_days: string | null;
  includes_inventory: boolean;
}

export interface TreasuryCashPosition {
  as_of: string;
  bank_accounts: {
    id: string;
    bank_name: string;
    iban: string;
    currency: string;
    current_balance: string;
    available_balance: string;
    overdraft_limit: string;
  }[];
  cash_registers: { id: string; code: string; currency: string; current_balance: string }[];
  totals: { currency: string; bank: string; cash: string; total: string }[];
}

export interface IbanCheckResult {
  iban: string;
  is_valid: boolean;
  country: string | null;
  reason: 'invalid_format' | 'unknown_country' | 'invalid_length' | 'invalid_checksum' | null;
}

export interface RibaBatchSummary {
  id: string;
  batch_reference: string | null;
  bank_account_id: string | null;
  status: string;
  execution_date: string;
  total_amount: string;
  currency: string;
  item_count: number;
}

export interface RibaBatchDetail {
  id: string;
  payment_batch_id: string;
  sia_code: string;
  file_name: string | null;
  file_sha256: string | null;
  exported_at: string | null;
}

export interface CreateRibaBatchPayload {
  bank_account_id: string;
  sia_code: string;
  batch_reference?: string | null;
  receipts: {
    invoice_id: string;
    due_date: string;
    amount?: number | null;
    debtor_abi?: string | null;
    debtor_cab?: string | null;
  }[];
}

export interface RibaOpenReceipt {
  id: string;
  payment_batch_id: string;
  invoice_id: string;
  receipt_number: number;
  debtor_name: string;
  due_date: string;
  amount: string;
  status: string;
  overdue: boolean;
}

export interface RibaPortfolio {
  by_status: Record<string, unknown>;
  open_receipts: RibaOpenReceipt[];
}

export interface ReceivableCollection {
  id: string;
  customer_id: string;
  invoice_id: string | null;
  expected_amount: number | string;
  collected_amount: number | string;
  due_date: string;
  collection_date: string | null;
  payment_method: string;
  status: string;
  aging_bucket: string;
  dunning_level: number;
  created_at: string | null;
}

export interface DunningReadiness {
  evaluated_count: number;
  overdue_items: ReceivableCollection[];
}

export interface IntercompanyTransferPayload {
  source_bank_account_id: string;
  destination_bank_account_id: string;
  amount: number;
  transfer_date?: string | null;
  intercompany_interest_rate?: number | null;
  cash_pool_id?: string | null;
}

export interface IntercompanyTransfer {
  id: string;
  cash_pool_id: string | null;
  source_bank_account_id: string;
  destination_bank_account_id: string;
  transfer_amount: string;
  transfer_date: string;
  intercompany_interest_rate: string;
  gl_journal_entry_id: string | null;
  status: string;
}

export interface LiquidityBuffer {
  total_cash: number;
  available_cash: number;
  blocked_cash: number;
  overdraft_utilized: number;
  currency: string;
}

export interface WorkingCapitalMetrics {
  id: string;
  metric_date: string;
  accounts_receivable_total: string;
  accounts_payable_total: string;
  inventory_valuation_total: string;
  trailing_12m_revenue: string;
  trailing_12m_cogs: string;
  dso_days: string;
  dpo_days: string;
  dio_days: string;
  cash_conversion_cycle_days: string;
  current_ratio: string;
  quick_ratio: string;
}
