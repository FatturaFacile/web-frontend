/** Italian VAT compliance (Mod 029, `api/v1/italian-vat`): registers, plafond, LIPE, annual VAT, Certificazione Unica and F24. Amounts are decimal strings. */

export type ItalianVatRegisterType = 'sales' | 'purchases' | 'receipts' | 'third_party_goods';

/** Registers kept through entries (the goods register has its own movements). */
export type ItalianVatEntryRegisterType = Exclude<ItalianVatRegisterType, 'third_party_goods'>;

export const ITALIAN_VAT_ENTRY_REGISTERS: readonly ItalianVatEntryRegisterType[] = [
  'sales',
  'purchases',
  'receipts',
];

export type ItalianVatDocumentKind =
  'ordinary' | 'deferred' | 'credit_note' | 'debit_note' | 'self_invoice' | 'reverse_charge';

export interface ItalianVatSection {
  id: string;
  register_type: ItalianVatRegisterType;
  code: string;
  name: string;
  document_kind: ItalianVatDocumentKind | null;
  is_active: boolean;
}

export interface ItalianVatEntry {
  id: string;
  section_id: string;
  register_type: ItalianVatRegisterType;
  year: number;
  protocol_number: number | string | null;
  entry_date: string;
  document_date: string | null;
  document_number: string | null;
  document_kind: ItalianVatDocumentKind | null;
  document_type_code: string | null;
  counterparty_name: string | null;
  counterparty_vat: string | null;
  taxable_amount: string;
  vat_rate: string;
  vat_amount: string;
  vat_nature: string | null;
  gross_amount: string;
  deduction_percentage: string;
  deductible_vat: string;
  non_deductible_vat: string;
  non_deductible_reason: 'pro_rata' | 'art_19_bis_1' | 'other' | null;
  print_id: string | null;
  notes: string | null;
  is_locked: boolean;
}

export interface ItalianVatTotals {
  taxable: string;
  vat: string;
  deductible_vat: string;
  non_deductible_vat: string;
  gross: string;
}

export interface ItalianVatRateBreakdown {
  rate: string;
  taxable?: string;
  vat?: string;
  deductible_vat?: string;
  non_deductible_vat?: string;
  [key: string]: unknown;
}

export interface ItalianVatNatureBreakdown {
  nature: string;
  taxable?: string;
  vat?: string;
  [key: string]: unknown;
}

export interface ItalianVatRegisterSummary {
  section: Pick<ItalianVatSection, 'id' | 'code' | 'name' | 'register_type'>;
  entries: ItalianVatEntry[];
  by_rate: ItalianVatRateBreakdown[];
  by_nature: ItalianVatNatureBreakdown[];
  totals: ItalianVatTotals;
}

export interface ItalianVatPeriod {
  from: string;
  to: string;
}

export interface ItalianVatPrint {
  id: string;
  section_id: string;
  year: number;
  period_from: string;
  period_to: string;
  first_protocol: number | null;
  last_protocol: number | null;
  entries_count: number;
  page_from: number;
  page_to: number;
  total_taxable: string;
  total_vat: string;
  total_deductible_vat: string;
  content_hash: string;
  stamp_reference: string | null;
  printed_at: string;
  printed_by: string | null;
}

export interface ItalianVatPrintVerification {
  intact: boolean;
  expected_hash: string;
  actual_hash: string;
  expected_count: number;
  actual_count: number;
}

export interface ItalianVatProRataRate {
  id: string;
  year: number;
  deductible_operations: string;
  total_operations: string;
  provisional_percentage: number | string | null;
  definitive_percentage: number | string | null;
  is_definitive: boolean;
}

export interface ItalianVatProRataState {
  rate: ItalianVatProRataRate | null;
  percentage_in_force: string | number | null;
}

// --- Receipts ventilation ---

export interface VentilationBasisLine {
  rate: string;
  amount: string;
  nature?: string | null;
}

export interface VentilationRequest {
  entry_date: string;
  gross_takings: string;
  purchase_basis: VentilationBasisLine[];
  section_id?: string | null;
}

export interface VentilationLine {
  rate: string;
  nature: string | null;
  share: string;
  gross: string;
  taxable: string;
  vat: string;
}

export interface VentilationPreview {
  lines: VentilationLine[];
  total_taxable: string;
  total_vat: string;
}

// --- Third-party goods ---

export type GoodsMovementType = 'received' | 'returned' | 'processed' | 'sold';

export const GOODS_MOVEMENT_TYPES: readonly GoodsMovementType[] = [
  'received',
  'returned',
  'processed',
  'sold',
];

export interface GoodsMovement {
  id: string;
  protocol_number: number | string | null;
  movement_date: string;
  movement_type: GoodsMovementType;
  contact_id: string;
  description: string;
  unit: string | null;
  quantity: string;
  value: string;
  document_number: string | null;
  document_date: string | null;
  print_id: string | null;
  notes: string | null;
}

export interface GoodsMovementPayload {
  movement_date: string;
  movement_type: GoodsMovementType;
  contact_id: string;
  description: string;
  unit?: string | null;
  quantity: number;
  value?: number | null;
  document_number?: string | null;
  document_date?: string | null;
  notes?: string | null;
}

export interface GoodsBalance {
  contact_id: string;
  description: string;
  unit: string | null;
  held_quantity: string;
  held_value: string;
}

// --- Plafond ---

export type PlafondStatus = 'active' | 'exhausted' | 'expired' | 'revoked' | 'not_yet_valid';
export type PlafondAlert = 'ok' | 'warning' | 'critical';

export interface PlafondRow {
  id: string;
  contact_id: string;
  contact_name: string;
  protocol_number: string;
  valid_from: string;
  valid_to: string;
  plafond: string;
  consumed: string;
  residual: string;
  usage_percentage: string;
  status: PlafondStatus;
  alert: PlafondAlert;
  days_to_expiry: number;
}

export interface PlafondMonitor {
  year: number;
  as_of: string;
  declarations: PlafondRow[];
  totals: { plafond: string; consumed: string; residual: string; [key: string]: unknown };
}

export interface PlafondCheckPayload {
  contact_id: string;
  date: string;
  amount: number;
  declaration_id?: string | null;
}

/** Outcome of the plafond guard: `covered` operations may be invoiced without VAT. */
export interface PlafondAssessment {
  covered: boolean;
  /** Error code of the refusal (plafond_exceeded, declaration_expired, plafond_no_declaration ...). */
  error_code: string | null;
  declaration_id: string | null;
  protocol_number: string | null;
  plafond: string | null;
  consumed: string | null;
  residual: string | null;
  requested: string;
  residual_after: string | null;
}

// --- LIPE ---

export type LipeStatus = 'draft' | 'validated' | 'signed' | 'ready' | 'transmitted' | 'rejected';
export type LipeSignatureStatus = 'unsigned' | 'signed' | 'invalid';

export interface LipeReconciliationRow {
  settlement_id: string;
  period: string;
  expected: string;
  ledger: string | null;
  difference: string | null;
  status: string;
}

export interface LipeReconciliation {
  status: 'balanced' | 'unbalanced';
  rows: LipeReconciliationRow[];
  total_expected: string;
  total_ledger: string;
  total_difference: string;
}

export interface LipeTotals {
  active_operations: string;
  passive_operations: string;
  output_vat: string;
  input_vat: string;
  difference: string;
  previous_debit: string;
  previous_credit: string;
  interest: string;
  balance: string;
}

export interface LipeCommunication {
  id: string;
  year: number;
  quarter: number;
  status: LipeStatus;
  settlement_ids: string[];
  totals: LipeTotals;
  file_name: string;
  xsd_errors: string[];
  reconciliation_status: 'balanced' | 'unbalanced' | null;
  reconciliation: LipeReconciliation | null;
  signature_status: LipeSignatureStatus;
  signature_digest: string | null;
  signer_fingerprint: string | null;
  signed_at: string | null;
  transmission_protocol: string | null;
  transmitted_at: string | null;
  rejection_reason: string | null;
}

// --- Annual VAT ---

export interface AnnualDiagnostic {
  code: string;
  params: Record<string, string | number>;
}

export interface AnnualVat {
  id: string;
  year: number;
  status: string;
  periods: unknown;
  total_output_vat: string;
  total_input_vat: string;
  pro_rata_percentage: number | string | null;
  pro_rata_adjustment: string;
  prior_year_credit: string;
  interest_total: string;
  paid_total: string;
  annual_debit: string;
  annual_credit: string;
  ledger_balance: string;
  difference: string;
  is_reconciled: boolean;
  diagnostics: AnnualDiagnostic[] | null;
  finalized_at: string | null;
}

// --- Certificazione Unica and F24 ---

export type CuStatus = 'draft' | 'validated' | 'issued';

export interface CuCertification {
  id: string;
  year: number;
  supplier_id: string | null;
  recipient_name: string;
  recipient_tax_code: string | null;
  recipient_vat_number: string | null;
  recipient_kind: string;
  reason_code: string | null;
  gross_amount: string;
  non_taxable_amount: string;
  taxable_amount: string;
  withheld_amount: string;
  contributions_amount: string;
  payments_count: number;
  status: CuStatus;
  validation_errors: string[] | null;
  issued_at: string | null;
}

export interface CuValidation {
  valid: boolean;
  errors: unknown[];
}

export type F24Status = 'due' | 'partial' | 'paid' | 'overpaid';

export interface F24Payment {
  id: string;
  year: number;
  month: number;
  tax_code: string;
  amount_due: string;
  amount_paid: string;
  due_date: string;
  paid_at: string | null;
  f24_reference: string | null;
  withholding_settlement_id: string | null;
  status: F24Status;
}

export interface F24PaymentPayload {
  amount: number;
  paid_at: string;
  reference?: string | null;
}

export interface F24Reconciliation {
  year: number;
  certified_withheld: string;
  f24_due: string;
  f24_paid: string;
  due_difference: string;
  [key: string]: unknown;
}
