export type AccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';

export type JournalStatus = 'draft' | 'posted' | 'reversed';

export type JournalType = 'standard' | 'reversing' | 'opening' | 'recurring' | 'adjusting';

export type LedgerType = 'statutory' | 'ifrs' | 'management';

export interface ChartOfAccount {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  account_type?: string;
  parent_id?: string | null;
  balance: number;
  currency?: string;
  is_active?: boolean;
  children?: ChartOfAccount[];
}

export interface JournalLine {
  id?: string;
  journal_id?: string;
  account_id: string;
  account_code?: string;
  account_name?: string;
  debit_amount: number;
  credit_amount: number;
  description?: string | null;
  cost_center_id?: string | null;
  profit_center_id?: string | null;
  partner_type?: 'customer' | 'supplier' | 'employee' | string | null;
  partner_id?: string | null;
}

export interface JournalEntryResource {
  id: string;
  entry_number: string;
  fiscal_period_id: string;
  posting_date: string;
  document_date?: string | null;
  ledger_type: LedgerType;
  journal_type: JournalType;
  description: string;
  status: JournalStatus;
  lines: JournalLine[];
  total_debit?: number;
  total_credit?: number;
  created_at?: string;
}

export interface CreateJournalEntryPayload {
  fiscal_period_id?: string;
  posting_date?: string;
  date?: string;
  entry_number?: string;
  document_date?: string | null;
  ledger_type?: LedgerType;
  journal_type?: JournalType;
  description: string;
  status?: JournalStatus;
  lines: {
    account_id: string;
    debit_amount?: number;
    credit_amount?: number;
    debit?: number;
    credit?: number;
    description?: string | null;
  }[];
}

// Backward compatible aliases
export type LedgerEntry = JournalEntryResource;
export type LedgerEntryLine = JournalLine;
export type CreateLedgerEntryPayload = CreateJournalEntryPayload;

export interface FiscalPeriodResource {
  id: string;
  name: string;
  year: number;
  period_number: number;
  start_date: string;
  end_date: string;
  status: 'open' | 'closed' | 'locked';
}

export interface TaxSettlementResource {
  id: string;
  fiscal_period_id?: string;
  period_type: 'monthly' | 'quarterly' | 'semiannual' | string;
  year: number;
  period: number;
  vat_payable: number;
  vat_receivable: number;
  balance: number;
  status: 'draft' | 'calculated' | 'posted' | 'paid';
  f24_code?: string | null;
  lipe_generated?: boolean;
}

export interface CalculateTaxSettlementPayload {
  fiscal_period_id?: string;
  period_type?: 'monthly' | 'quarterly' | 'semiannual';
  year: number;
  period: number;
}

export interface IntrastatDeclarationResource {
  id: string;
  declaration_number: string;
  year: number;
  month?: number | null;
  quarter?: number | null;
  direction: 'dispatch' | 'arrival' | 'both';
  total_amount: number;
  status: 'draft' | 'validated' | 'submitted';
  submitted_at?: string | null;
}

export interface TrialBalanceItem {
  account_code: string;
  account_name: string;
  account_type: string;
  opening_balance: number;
  debit_movement: number;
  credit_movement: number;
  closing_balance: number;
}

export interface TrialBalanceReport {
  fiscal_year: number;
  period_from: string;
  period_to: string;
  items: TrialBalanceItem[];
  total_debit: number;
  total_credit: number;
}
