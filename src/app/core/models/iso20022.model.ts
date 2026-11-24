export type Pain001Version = '03' | '09';
export type Pain001Scheme = 'ch' | 'it';
export type TransactionStatusFilter = 'unmatched' | 'matched' | 'all';
export type DifferenceHandling = 'none' | 'write_off' | 'partial';

/** Outcome of POST /banking/iso20022/import: what was read, what was skipped and what the auto-reconciliation did. */
export interface Iso20022ImportSummary {
  statement_id: string;
  format: 'camt053' | 'camt054';
  account_iban: string;
  currency: string;
  statement_date: string;
  opening_balance: number | null;
  closing_balance: number | null;
  entries: number;
  stored: number;
  duplicates: number;
  reconciled: number;
  unmatched: number;
  auto_reconciled: boolean;
  status: string;
}

/** A bank transaction of an imported statement, as listed by GET /banking/reconciliation/transactions. */
export interface ReconciliationTransaction {
  id: string;
  bank_statement_id: string;
  booking_date: string;
  value_date: string;
  direction: 'credit' | 'debit';
  amount: number;
  fee_amount: number;
  gross_amount: number;
  currency: string;
  reference: string | null;
  qr_reference: string | null;
  description: string | null;
  counterpart_name: string | null;
  counterpart_iban: string | null;
  reconciled: boolean;
  matched_document_id: string | null;
  reconciliation_type: string | null;
}

export interface ReconciliationTransactionFilters {
  status?: TransactionStatusFilter;
  direction?: 'credit' | 'debit';
  search?: string;
  page?: number;
  per_page?: number;
}

export interface ManualTransactionMatchPayload {
  invoice_id: string;
  difference_handling: DifferenceHandling;
}

export interface Pain001ExportPayload {
  invoice_ids: string[];
  version: Pain001Version;
  scheme: Pain001Scheme;
  execution_date?: string | null;
  bank_account_id?: string | null;
}

export interface Pain001ExportResult {
  batch_id: string;
  message_id: string | null;
  format: string;
  pain_version: Pain001Version;
  status: string;
  xml_preview: string;
  schema_valid: boolean;
  filename: string;
}
