export type StatementStatus = 'imported' | 'reconciled' | 'partially_reconciled';
export type StatementSourceFormat = 'camt053' | 'cbi' | 'csv' | 'xlsx';

export interface BankStatement {
  id: string;
  file_name?: string;
  iban: string;
  statement_date: string;
  opening_balance: number;
  closing_balance: number;
  currency: string;
  status: StatementStatus;
  source_format: StatementSourceFormat;
  lines_count?: number;
  reconciled_lines_count?: number;
  created_at?: string;
}

export interface BankStatementLine {
  id: string;
  statement_id: string;
  booking_date: string;
  value_date: string;
  amount: number;
  currency: string;
  counterparty_name?: string | null;
  counterparty_iban?: string | null;
  remittance_information?: string | null;
  is_reconciled: boolean;
  matched_entity_type?: string | null;
  matched_entity_id?: string | null;
  category?: string | null;
}

export interface BankAccountResource {
  id: string;
  bank_name: string;
  account_name?: string;
  iban: string;
  bic?: string | null;
  currency: 'EUR' | 'CHF';
  balance: number;
  is_active: boolean;
}

export interface BankTransactionResource {
  id: string;
  bank_account_id: string;
  transaction_date: string;
  value_date?: string;
  amount: number;
  currency: string;
  description: string;
  counterparty?: string | null;
  reference?: string | null;
  reconciled: boolean;
  category?: string | null;
}

export interface ManualMatchPayload {
  matched_type: 'invoice' | 'expense' | 'ledger_entry';
  matched_id: string;
}

export interface CategorizePayload {
  category: string;
}
