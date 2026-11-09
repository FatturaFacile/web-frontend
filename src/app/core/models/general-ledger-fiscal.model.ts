/** General ledger: payroll, VAT and withholding settings, Enasarco, reclassified statements, reconciliations and subledgers. */

export type EnasarcoAgentType = 'single_mandate' | 'multi_mandate';

export interface EnasarcoParameter {
  id: string;
  tenant_id: string | null;
  year: number;
  agent_type: EnasarcoAgentType;
  rate_percent: string;
  agent_share_percent: string;
  annual_ceiling: string;
  source: string;
}

export interface EnasarcoParameterPayload {
  year: number;
  agent_type: EnasarcoAgentType;
  rate_percent: number;
  agent_share_percent: number;
  annual_ceiling: number;
  source: string;
}

export interface EnasarcoPrincipalStatement {
  lines: unknown[];
  total_agent_withheld: string;
  total_principal_amount: string;
  total_due: string;
}

export interface PayrollSettings {
  id: string;
  salary_expense_account_id: string | null;
  employer_cost_account_id: string | null;
  expense_allowance_account_id: string | null;
  employee_payable_account_id: string | null;
  social_payable_account_id: string | null;
  tax_payable_account_id: string | null;
  non_cash_benefit_account_id: string | null;
  rounding_account_id: string | null;
  wage_type_accounts: unknown[] | null;
}

export type PayrollSettingsPayload = Partial<Omit<PayrollSettings, 'id'>>;

export interface PayrollPosting {
  id: string;
  payroll_run_id: string;
  status: string;
  run_date: string;
  currency: string;
  journal_entry_id: string | null;
  last_error: string | null;
}

export interface VatSettings {
  periodicity: 'monthly' | 'quarterly' | 'semiannual' | null;
  output_vat_account_ids: string[];
  input_vat_account_ids: string[];
  settlement_account_id: string | null;
  interest_expense_account_id: string | null;
  declarant_tax_code: string | null;
  declarant_role_code: string | null;
}

export type VatSettingsPayload = Partial<VatSettings>;

export interface StatementSchemeRow {
  code: string;
  label: string;
  row_type: 'heading' | 'accounts' | 'subtotal';
  sign?: number | '1' | '-1' | null;
  account_prefixes?: string[];
  formula?: { row: string; sign?: '1' | '-1' | null }[];
}

export interface StatementScheme {
  id: string;
  name: string;
  statement_type: 'income_statement' | 'balance_sheet';
  description: string | null;
  is_active: boolean;
  rows: StatementSchemeRow[];
}

export interface StatementSchemePayload {
  name: string;
  statement_type: 'income_statement' | 'balance_sheet';
  description?: string | null;
  rows: StatementSchemeRow[];
}

export type LedgerReconciliationType = 'subledger_ar' | 'subledger_ap' | 'gr_ir' | 'inventory' | 'project';

export interface LedgerReconciliation {
  id: string;
  reconciliation_type: LedgerReconciliationType;
  period_id: string | null;
  account_id: string;
  status: string;
  gl_balance: number;
  subledger_balance: number;
  variance_amount: number;
  reconciled_at: string | null;
  notes: string | null;
}

export interface WithholdingSettlement {
  id: string;
  year: number;
  month: number;
  currency: string;
  total_withheld: string;
  total_f24: string;
  due_date: string;
  status: string;
  payment_date: string | null;
  payment_journal_id: string | null;
  lines?: Record<string, unknown>[];
}

export interface WithholdingF24 {
  section: string;
  reference_month: string;
  reference_year: number;
  due_date: string;
  total: string;
  lines: { tax_code: string; reference_month: string; reference_year: number; amount: string }[];
}

export interface VatSettlementF24 {
  section: string;
  tax_code: string | null;
  reference_year: number;
  amount: string;
  payment_due: boolean;
  carried_forward: string;
  summary: string;
}

export interface SubledgerItem {
  id: string;
  customer_id?: string;
  supplier_id?: string;
  journal_entry_id: string;
  posting_date: string;
  due_date: string;
  original_amount: string;
  open_amount: string;
  currency: string;
  status: string;
  dunning_level?: number;
}

export interface SubledgerPage {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  data: SubledgerItem[];
}

export interface LedgerPreviewTotals {
  entries: number;
  lines: number;
  total_debit: number;
  total_credit: number;
  balanced: boolean;
  unbalanced_entries: string[];
}

export interface LedgerPreviewParams {
  from_date: string;
  to_date: string;
  account_code?: string | null;
  source?: 'all' | 'invoices' | 'payments' | 'banking';
  date_format?: 'YYYY-MM-DD' | 'DD/MM/YYYY';
  page?: number;
  per_page?: number;
}

export interface VendorAging {
  as_of_date: string;
  suppliers: unknown[];
  summary: unknown[];
}
