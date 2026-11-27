/** Treasury banking workspace (#268): payment files, Modello F24, statement imports, open banking, smart reconciliation. */

import { PaymentBatchLine, PaymentBatchResource } from './banking.model';

export type PaymentFlowCode = 'ch_pain001_09' | 'ch_pain001_03' | 'sepa_pain001_03' | 'cbi_sepa_03';

export interface PaymentFlowInfo {
  flow: PaymentFlowCode;
  pain_version: '03' | '09';
  currencies: string[];
  requires_cuc: boolean;
  is_sepa: boolean;
}

export interface PaymentFlowLine {
  recipient_name: string;
  recipient_iban: string;
  recipient_bic?: string | null;
  amount: number | string;
  currency?: string | null;
  remittance_reference?: string | null;
  /** 27 digit QR reference (QRR) or ISO 11649 creditor reference (SCOR). */
  structured_creditor_ref?: string | null;
  /** Supplier invoice paid by the line: the API refuses a second payment of the same invoice. */
  invoice_id?: string | null;
  end_to_end_id?: string | null;
}

export interface PaymentFlowPayload {
  flow: PaymentFlowCode;
  bank_account_id: string;
  execution_date: string;
  currency?: string | null;
  cuc?: string | null;
  category_purpose?: 'SALA' | 'SUPP' | 'TAXS' | 'PENS' | 'BONU' | 'TRAD' | null;
  charge_bearer?: 'SLEV' | 'SHAR' | 'DEBT' | 'CRED' | null;
  lines: PaymentFlowLine[];
}

/** The draft batch stored from a payment flow, with its lines and their bank feedback once known. */
export interface PaymentFlowBatch extends Pick<PaymentBatchResource, 'id' | 'batch_reference' | 'status'> {
  category_purpose?: PaymentBatchResource['category_purpose'];
  charge_bearer?: PaymentBatchResource['charge_bearer'];
  lines?: PaymentBatchLine[];
}

export interface GeneratedPaymentFlow {
  flow: PaymentFlowCode;
  pain_version: '03' | '09';
  message_id: string;
  transactions: number;
  control_sum: string;
  currency: string;
  filename: string;
  sha256: string;
  xml: string | null;
}

export type F24Section = 'erario' | 'inps' | 'regioni' | 'imu' | 'inail';
export type F24DelegationStatus = 'draft' | 'validated' | 'generated' | 'paid';

export interface F24TaxCode {
  section: F24Section;
  code: string;
  translation_key: string;
  requires_installment: boolean;
  period_format: string;
}

export interface F24DelegationLine {
  id?: string;
  section: F24Section;
  tax_code: string;
  institution_code?: string | null;
  reference_number?: string | null;
  installment?: string | null;
  reference_period?: string | null;
  reference_year?: string | null;
  debit_amount: string;
  credit_amount: string;
}

export interface F24Delegation {
  id: string;
  bank_account_id: string | null;
  taxpayer_fiscal_code: string;
  taxpayer_name: string;
  taxpayer_first_name: string | null;
  taxpayer_birth_date: string | null;
  taxpayer_birth_place: string | null;
  taxpayer_birth_province: string | null;
  taxpayer_gender: string | null;
  payment_date: string;
  status: F24DelegationStatus;
  total_debit: string;
  total_credit: string;
  total_payable: string;
  file_name: string | null;
  file_hash: string | null;
  validated_at: string | null;
  generated_at: string | null;
  lines?: F24DelegationLine[];
  created_at?: string;
}

export interface F24Payload {
  bank_account_id?: string | null;
  taxpayer_fiscal_code: string;
  taxpayer_name: string;
  taxpayer_first_name?: string | null;
  taxpayer_birth_date?: string | null;
  taxpayer_birth_place?: string | null;
  taxpayer_birth_province?: string | null;
  taxpayer_gender?: string | null;
  payment_date: string;
  lines: F24DelegationLine[];
}

export interface F24ValidationIssue {
  path: string;
  code: string;
  params: Record<string, string | number>;
  message: string;
}

export interface F24ValidationResult {
  valid: boolean;
  issues: F24ValidationIssue[];
  delegation: F24Delegation;
}

export type StatementFormat = 'auto' | 'camt053' | 'camt054' | 'cbi' | 'csv';

export type CsvField =
  | 'booking_date'
  | 'value_date'
  | 'amount'
  | 'debit'
  | 'credit'
  | 'fee'
  | 'description'
  | 'reference'
  | 'qr_reference'
  | 'counterpart_name'
  | 'counterpart_iban'
  | 'entry_reference';

export interface CsvMapping {
  account_iban: string;
  currency: string;
  delimiter: string;
  has_header: boolean;
  date_format: string;
  decimal_separator: string;
  thousands_separator: string | null;
  columns: Partial<Record<CsvField, string>>;
}

export interface CsvProfile extends CsvMapping {
  id: string;
  name: string;
}

export interface StatementImportOptions {
  format: StatementFormat;
  autoReconcile: boolean;
  csvProfileId?: string | null;
  csv?: CsvMapping | null;
}

export interface StatementImportSummary {
  statement_id: string;
  format: string;
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
  status: string;
}

export interface OpenBankingStatus {
  driver: string;
  available: boolean;
}

export interface OpenBankingSyncRun {
  id: string;
  consent_id: string;
  driver: string;
  status: 'running' | 'completed' | 'failed';
  from_date: string;
  to_date: string;
  fetched: number;
  imported: number;
  duplicates: number;
  bank_statement_id: string | null;
  error: string | null;
  started_at: string | null;
  finished_at: string | null;
}

export interface OpenBankingConnection {
  id: string;
  driver: string;
  iban: string;
  status: string;
  is_active: boolean;
  expires_at: string | null;
  last_sync: OpenBankingSyncRun | null;
}

export type ProposalRule = 'structured_reference' | 'amount_counterparty' | 'fuzzy_invoice';
export type ProposalKind = 'exact' | 'fee_tolerance' | 'fx' | 'partial';
export type ProposalStatus = 'pending' | 'applied' | 'rejected' | 'superseded';

export interface ReconciliationProposal {
  id: string;
  bank_statement_line_id: string;
  document_type: 'invoice' | 'passive_invoice';
  document_id: string;
  document_number: string | null;
  rule: ProposalRule;
  confidence: number;
  kind: ProposalKind | null;
  reasons: string[];
  matched_amount: string;
  fee_amount: string;
  fx_difference: string;
  residual_amount: string;
  currency: string;
  status: ProposalStatus;
  applied_at: string | null;
}

export interface SmartReconciliationLine {
  id: string;
  bank_statement_id: string;
  line_number: number;
  booking_date: string | null;
  value_date: string | null;
  direction: 'credit' | 'debit';
  amount: string;
  fee_amount: string;
  currency: string | null;
  reference: string | null;
  qr_reference: string | null;
  description: string | null;
  counterpart_name: string | null;
  counterpart_iban: string | null;
  reconciled: boolean;
  reconciliation_type: string | null;
  matched_document_id: string | null;
  proposals: ReconciliationProposal[];
}

export interface SmartReconciliationSummary {
  open_lines: number;
  reconciled_lines: number;
  lines_with_proposals: number;
  high_confidence: number;
  applied_proposals: number;
}

export interface SmartReconciliationFilters {
  status?: 'open' | 'reconciled' | 'all';
  direction?: 'credit' | 'debit' | '';
  statement_id?: string;
  search?: string;
  min_confidence?: number | null;
  with_proposals?: boolean;
  page?: number;
  per_page?: number;
}

export interface SmartRunResult {
  proposed: number;
  applied: number;
  lines_without_proposal: number;
}
