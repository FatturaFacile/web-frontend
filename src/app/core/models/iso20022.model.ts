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

export type CategoryPurpose = 'SALA' | 'SUPP' | 'TAXS' | 'PENS' | 'BONU' | 'TRAD';
export type ChargeBearer = 'SLEV' | 'SHAR' | 'DEBT' | 'CRED';
export type IsoUploadType = 'camt.053' | 'camt.054' | 'pain.002';
export type PaymentLineOutcome = 'executed' | 'rejected' | 'pending';
export type ReconciliationExceptionCode =
  | 'Unmatched'
  | 'AmountMismatch'
  | 'DuplicatePayment'
  | 'AlreadyPaid'
  | 'InvalidReference';
export type LineCategory = 'tax_payment' | 'payroll' | 'bank_expense' | 'internal_transfer' | 'generic_expense';

/** One transaction of a pain.002 status report, with the ISO 20022 reason code of a rejection. */
export interface Pain002Transaction {
  end_to_end_id: string;
  instruction_id: string | null;
  status: string;
  reason_code: string | null;
  additional_info: string | null;
  line_status: PaymentLineOutcome;
}

export interface Pain002Report {
  batch_id: string;
  batch_reference: string;
  batch_status: string;
  group_status: string | null;
  accepted: number;
  rejected: number;
  pending: number;
  transactions: Pain002Transaction[];
}

/** The stored statement, as exposed by BankStatementResource. */
export interface IsoUploadStatement {
  id: string;
  source_format?: string | null;
  account_iban: string;
  statement_date: string;
  opening_balance?: number | null;
  closing_balance?: number | null;
  currency: string;
  total_entries?: number;
  status?: string;
  created_at?: string;
}

/** Outcome of POST /banking/iso20022/upload: the detected message type and what was done with the file. */
export interface IsoUploadResult {
  type: IsoUploadType;
  filename: string;
  statement?: IsoUploadStatement | null;
  reconciliation?: { reconciled: number; unmatched: number } | null;
  duplicates?: number | null;
  payment_report?: Pain002Report | null;
}

export interface IsoUploadOptions {
  autoReconcile?: boolean;
  paymentBatchId?: string | null;
}

/** The open document the API suggests for a line in exception. */
export interface ExceptionCandidate {
  id: string;
  invoice_number: string;
  kind: 'customer' | 'supplier';
  due_amount: number;
  currency: string;
}

/** A bank line the automatic reconciliation could not settle, as listed by GET /banking/reconciliation/exceptions. */
export interface ReconciliationException {
  id: string;
  bank_statement_id: string;
  booking_date: string;
  value_date: string | null;
  direction: 'credit' | 'debit';
  amount: number;
  fee_amount: number;
  currency: string;
  gross_amount: number;
  reference: string | null;
  qr_reference: string | null;
  description: string | null;
  counterpart_name: string | null;
  counterpart_iban: string | null;
  reconciled: boolean;
  matched_document_id?: string | null;
  reconciliation_type?: string | null;
  exception_code: ReconciliationExceptionCode;
  exception_candidate: ExceptionCandidate | null;
}

export type ReconciliationExceptionCounts = Record<ReconciliationExceptionCode, number>;

export interface ReconciliationExceptionFilters {
  code?: ReconciliationExceptionCode;
  direction?: 'credit' | 'debit';
  search?: string;
  statement_id?: string;
  page?: number;
  per_page?: number;
}

export interface ReconciliationExceptionMeta {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  counts: ReconciliationExceptionCounts;
}

export interface ReconciliationExceptionPage {
  success: boolean;
  message: string;
  data: ReconciliationException[];
  meta: ReconciliationExceptionMeta;
}

export interface LineInvoiceMatchPayload {
  invoice_id: string;
  difference_handling?: DifferenceHandling;
}
