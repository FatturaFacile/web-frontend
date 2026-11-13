export type StatementStatus = 'imported' | 'reconciled' | 'partially_reconciled';
export type StatementSourceFormat = 'camt053' | 'cbi' | 'csv' | 'xlsx';

export type BankTransactionStatus = 'unmatched' | 'matched' | 'manual' | 'ignored';

export interface BankStatement {
  id: string;
  file_name?: string;
  account_iban: string;
  statement_date: string;
  opening_balance: number;
  closing_balance: number;
  currency: string;
  status: StatementStatus;
  source_format: StatementSourceFormat;
  total_entries?: number;
  reconciled_entries?: number;
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
  branch_name?: string | null;
  account_name?: string;
  account_number?: string | null;
  iban: string;
  bic?: string | null;
  bic_swift?: string | null;
  currency: 'EUR' | 'CHF' | string;
  account_type?: 'checking' | 'savings' | 'escrow' | 'credit_line' | string | null;
  current_balance: number;
  available_balance: number;
  opening_balance?: number | null;
  overdraft_limit?: number | null;
  credit_line_limit?: number | null;
  is_default?: boolean | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface CreateBankAccountPayload {
  bank_name: string;
  branch_name?: string | null;
  iban: string;
  bic_swift?: string | null;
  account_number?: string | null;
  currency: 'EUR' | 'CHF' | string;
  account_type?: 'checking' | 'savings' | 'escrow' | 'credit_line' | string | null;
  opening_balance?: number | null;
  overdraft_limit?: number | null;
  is_default?: boolean | null;
  is_active?: boolean;
}

export interface BankTransactionResource {
  id: string;
  bank_account_id: string;
  booking_date: string;
  value_date?: string;
  amount: number;
  currency: string;
  description: string;
  reference?: string | null;
  matched_invoice_id?: string | null;
  status: BankTransactionStatus;
  bank_account?: { id: string; bank_name: string; iban: string } | null;
}

export interface ManualMatchPayload {
  matched_type: 'invoice' | 'expense' | 'ledger_entry';
  matched_id: string;
}

export interface CategorizePayload {
  category: string;
}

export type PaymentMethodType =
  | 'sepa_credit_transfer'
  | 'sepa_instant'
  | 'sepa_direct_debit'
  | 'swiss_qr_pain001'
  | 'riba'
  | 'f24';

export type PaymentBatchStatus = 'draft' | 'pending_approval' | 'approved' | 'exported' | 'executed' | 'cancelled';

export interface PaymentBatchLine {
  id?: string;
  recipient_name: string;
  recipient_iban: string;
  recipient_bic?: string | null;
  amount: number;
  currency?: string | null;
  remittance_reference?: string | null;
  invoice_id?: string | null;
  status?: string;
}

export interface PaymentBatchResource {
  id: string;
  batch_reference: string;
  bank_account_id: string;
  payment_method: PaymentMethodType;
  execution_date: string;
  currency: string;
  total_amount: number;
  item_count: number;
  status: PaymentBatchStatus;
  lines: PaymentBatchLine[];
  created_at?: string;
}

export interface CreatePaymentBatchPayload {
  bank_account_id: string;
  batch_reference?: string | null;
  payment_method: PaymentMethodType;
  execution_date?: string | null;
  currency?: string | null;
  lines: {
    recipient_name: string;
    recipient_iban: string;
    recipient_bic?: string | null;
    amount: number;
    currency?: string | null;
    remittance_reference?: string | null;
    invoice_id?: string | null;
  }[];
}

export interface CashForecastResource {
  id: string;
  forecast_number: string;
  calculation_date: string;
  horizon_days: number;
  opening_cash_balance: number;
  projected_inflows: number;
  projected_outflows: number;
  closing_cash_balance: number;
  min_liquidity_threshold: number;
  deficit_detected: boolean;
  deficit_date?: string | null;
}
