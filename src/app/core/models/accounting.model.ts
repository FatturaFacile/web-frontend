import type { IntrastatFlow, IntrastatPeriodicity } from './intrastat.model';

export type AccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';

/** Side on which the account normally grows (`normal_balance` of the API). */
export type NormalBalance = 'debit' | 'credit';

export type JournalStatus = 'draft' | 'pending_approval' | 'rejected' | 'posted' | 'reversed';

export type JournalType = 'standard' | 'reversing' | 'opening' | 'recurring' | 'adjusting';

export type LedgerType = 'statutory' | 'ifrs' | 'management';

export interface ChartOfAccount {
  id: string;
  account_code: string;
  name: string;
  account_type: AccountType | string;
  normal_balance: NormalBalance;
  currency?: string | null;
  is_active?: boolean;
}

/** Body of POST /general-ledger/accounts (StoreChartOfAccountRequest). */
export interface CreateAccountPayload {
  account_code: string;
  name: string;
  account_type: AccountType;
  normal_balance: NormalBalance;
  currency?: string | null;
  parent_account_id?: string | null;
  is_active?: boolean;
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
  /** Date (YYYY-MM-DD) on which the journal is reversed automatically, when set. */
  auto_reverse_on?: string | null;
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
  document_date?: string | null;
  /** Reverses the journal automatically on this date (YYYY-MM-DD, after the posting date). */
  auto_reverse_on?: string | null;
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
  /** INTRA-1 for the sales flow, INTRA-2 for the purchases. */
  model: string;
  flow: IntrastatFlow;
  year: number;
  periodicity: IntrastatPeriodicity;
  period: number;
  reference_number?: number | null;
  status: 'draft' | 'validated' | 'submitted';
  protocol_number?: string | null;
  submitted_at?: string | null;
}

/** Body of POST /intrastat/declarations/generate (GenerateDeclarationRequest). */
export interface GenerateIntrastatPayload {
  flow: IntrastatFlow;
  year: number;
  periodicity: IntrastatPeriodicity;
  period: number;
}

/** Body of POST /intrastat/declarations/{id}/submit (SubmitDeclarationRequest). */
export interface SubmitIntrastatPayload {
  protocol_number: string;
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
