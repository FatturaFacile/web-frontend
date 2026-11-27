/**
 * Wire types of the down-payment chain module (Mod 203), served under `/api/v1/down-payment-chains`: the installment plan wizard,
 * advance invoices (TD02) and pro-forma requests, earnest money and security deposits with their resolution, the final settlement
 * invoice with the multi-rate deduction of the advances and the credit notes (TD04) of the advances.
 * Every label of these codes is in the dictionary the API serves (`down_payments.<group>.<code>`).
 * Decimal amounts travel as strings: they are never rounded in the browser.
 */

export const DP_SOURCE_TYPES = ['sales_order', 'quote', 'contract'] as const;
export type DpSourceType = (typeof DP_SOURCE_TYPES)[number];

export const DP_CHAIN_STATUSES = [
  'draft',
  'active',
  'partially_settled',
  'settled',
  'cancelled',
  'forfeited',
] as const;
export type DpChainStatus = (typeof DP_CHAIN_STATUSES)[number];

export const DP_INSTALLMENT_STATUSES = [
  'planned',
  'requested',
  'invoiced',
  'paid',
  'converted',
  'forfeited',
  'refunded',
  'cancelled',
] as const;
export type DpInstallmentStatus = (typeof DP_INSTALLMENT_STATUSES)[number];

export const DP_LINK_STATUSES = [
  'open',
  'issued',
  'partially_credited',
  'credited',
  'settled',
  'converted',
  'cancelled',
] as const;
export type DpLinkStatus = (typeof DP_LINK_STATUSES)[number];

export const DP_LINK_TYPES = [
  'advance_invoice_td02',
  'proforma_advance_request',
  'earnest_money_deposit',
  'security_deposit',
  'credit_note_td04',
  'final_settlement_td01',
] as const;
export type DpLinkType = (typeof DP_LINK_TYPES)[number];

export const DP_DEPOSIT_TYPES = [
  'earnest_money_caparra_confirmatoria',
  'security_deposit_cauzionale',
] as const;
export type DpDepositType = (typeof DP_DEPOSIT_TYPES)[number];

export const DP_DEPOSIT_STATUSES = [
  'issued_unpaid',
  'held_active',
  'converted_to_advance',
  'deducted_in_final_invoice',
  'forfeited_on_breach',
  'refunded_single',
  'refunded_double_art1385',
] as const;
export type DpDepositStatus = (typeof DP_DEPOSIT_STATUSES)[number];

export const DP_RESOLUTIONS = ['impute_to_price', 'forfeit_breach', 'refund'] as const;
export type DpResolution = (typeof DP_RESOLUTIONS)[number];

export const DP_REFUND_MODES = ['single', 'double'] as const;
export type DpRefundMode = (typeof DP_REFUND_MODES)[number];

export const DP_TRIGGERS = [
  'on_order_confirmation',
  'on_material_delivery',
  'on_milestone_sal',
  'on_commissioning',
  'custom_date',
] as const;
export type DpTrigger = (typeof DP_TRIGGERS)[number];

export const DP_CALCULATION_MODES = ['percentage', 'fixed_net', 'fixed_gross'] as const;
export type DpCalculationMode = (typeof DP_CALCULATION_MODES)[number];

export const DP_INSTRUMENTS = [
  'advance_invoice_immediate',
  'advance_proforma_request',
  'earnest_money_deposit',
  'security_deposit',
] as const;
export type DpInstrument = (typeof DP_INSTRUMENTS)[number];

export const DP_PRESETS = ['30_40_30', '50_50', 'caparra_balance'] as const;
export type DpPresetKey = (typeof DP_PRESETS)[number];

export const DP_CREDIT_MODES = ['total', 'amount', 'lines'] as const;
export type DpCreditMode = (typeof DP_CREDIT_MODES)[number];

export const DP_SETTLEMENT_TYPES = ['TD01', 'TD24'] as const;
export type DpSettlementType = (typeof DP_SETTLEMENT_TYPES)[number];

export const DP_PAYMENT_ACCOUNTS = ['bank', 'cash'] as const;
export type DpPaymentAccount = (typeof DP_PAYMENT_ACCOUNTS)[number];

export const DP_JURISDICTIONS = ['IT', 'CH'] as const;
export type DpJurisdiction = (typeof DP_JURISDICTIONS)[number];

/** Accounts of the Prima Nota previews (giroconto, deposits, closing of the customer advances). */
export const DP_JOURNAL_ACCOUNTS = [
  'receivables',
  'customer_advances',
  'sales_revenue',
  'output_vat',
  'deposits_received',
  'forfeited_deposits_income',
  'deposit_penalties',
  'bank',
  'cash',
] as const;
export type DpJournalAccount = (typeof DP_JOURNAL_ACCOUNTS)[number];

export interface DpEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
  meta?: DpPageMeta;
}

export interface DpPageMeta {
  current_page?: number;
  per_page?: number;
  total?: number;
  last_page?: number;
}

/** RFC 7807 problem of a refused rule: `code` picks `down_payments.error.<code>`. */
export interface DpProblem {
  code?: string;
  detail?: string;
  params?: Record<string, unknown>;
  errors?: Record<string, string[]>;
}

// --- Reads ---

export interface DpChainFilters {
  customer_id?: string;
  status?: DpChainStatus;
  source_type?: DpSourceType;
  source_id?: string;
  country?: DpJurisdiction;
  search?: string;
  page?: number;
  per_page?: number;
}

export interface DpChain {
  id: string;
  chain_number: string;
  source_type: DpSourceType;
  source_id: string;
  source_number: string | null;
  sales_order_id: string | null;
  customer_id: string;
  customer_name: string | null;
  currency: string;
  jurisdiction: DpJurisdiction;
  status: DpChainStatus;
  total_contract_net: string;
  total_contract_vat: string;
  total_contract_gross: string;
  total_earnest_deposits_held: string;
  total_security_deposits_held: string;
  total_advance_invoiced_net: string;
  total_advance_invoiced_vat: string;
  total_advance_invoiced_gross: string;
  total_credited_advances_gross: string;
  residual_order_gross: string;
  final_invoice_id: string | null;
  notes: string | null;
  created_at: string | null;
}

/** Net, VAT and gross of one VAT rate of an installment or of a credit. */
export interface DpVatSlice {
  vat_rate: string;
  net: string;
  vat: string;
  gross: string;
}

export interface DpInstallment {
  id: string;
  sequence: number;
  milestone_label: string | null;
  trigger_type: DpTrigger;
  due_date: string | null;
  calculation_mode: DpCalculationMode;
  percentage: string | null;
  amount_net: string;
  amount_vat: string;
  amount_gross: string;
  instrument_type: DpInstrument;
  status: DpInstallmentStatus;
  vat_breakdown: DpVatSlice[];
  linked_document_id: string | null;
  linked_invoice_id: string | null;
}

export interface DpLinkVatLine {
  id: string;
  vat_rate_id: string | null;
  vat_code: string | null;
  vat_percentage: string;
  net_amount: string;
  vat_amount: string;
  gross_amount: string;
  settled_net_amount: string;
  settled_vat_amount: string;
  settled_gross_amount: string;
  residual_net_amount: string;
  residual_vat_amount: string;
  residual_gross_amount: string;
  credited_net_amount: string;
  credited_vat_amount: string;
  credited_gross_amount: string;
}

export interface DpLink {
  id: string;
  installment_id: string | null;
  link_type: DpLinkType;
  document_id: string | null;
  document_number: string | null;
  document_date: string | null;
  parent_link_id: string | null;
  status: DpLinkStatus;
  net_amount: string;
  vat_amount: string;
  gross_amount: string;
  credited_gross_amount: string;
  settled_gross_amount: string;
  vat_lines: DpLinkVatLine[];
}

export interface DpDeposit {
  id: string;
  chain_id: string;
  installment_id: string | null;
  deposit_type: DpDepositType;
  receipt_number: string | null;
  issue_date: string | null;
  payment_date: string | null;
  amount: string;
  currency: string;
  vat_exemption_code: string | null;
  marca_da_bollo_applied: boolean;
  marca_da_bollo_amount: string;
  payment_account: DpPaymentAccount | null;
  status: DpDepositStatus;
  converted_invoice_id: string | null;
  journal_entry_id: string | null;
  resolution_journal_entry_id: string | null;
  resolution: DpResolution | null;
  resolved_at: string | null;
  penalty_amount: string;
  notes: string | null;
}

export interface DpDeductionLineRecord {
  id: string;
  final_invoice_id: string;
  referenced_link_id: string | null;
  referenced_invoice_number: string | null;
  referenced_invoice_date: string | null;
  vat_percentage: string;
  deducted_net: string;
  deducted_vat: string;
  deducted_gross: string;
}

/** One row of the multi-VAT analytical matrix: the contract, what was requested, invoiced, credited, settled and what is left, per rate. */
export interface DpMatrixRow {
  vat_rate: string;
  contract_net: string;
  contract_vat: string;
  contract_gross: string;
  requested_net: string;
  requested_vat: string;
  requested_gross: string;
  invoiced_net: string;
  invoiced_vat: string;
  invoiced_gross: string;
  credited_net: string;
  credited_vat: string;
  credited_gross: string;
  settled_net: string;
  settled_vat: string;
  settled_gross: string;
  deductible_net: string;
  deductible_vat: string;
  deductible_gross: string;
  residual_net: string;
  residual_vat: string;
  residual_gross: string;
}

export interface DpJournalEntryRef {
  source: string;
  document_id: string;
  document_number: string | null;
  journal_entry_id: string;
}

export interface DpChainDetail extends DpChain {
  installments: DpInstallment[];
  links: DpLink[];
  deposits: DpDeposit[];
  deduction_lines: DpDeductionLineRecord[];
  vat_matrix: DpMatrixRow[];
  journal_entries: DpJournalEntryRef[];
}

// --- Plan wizard ---

export interface DpPresetInstallment {
  trigger_type: DpTrigger;
  calculation_mode: DpCalculationMode;
  percentage?: string | null;
  amount?: string | null;
  instrument_type: DpInstrument;
}

export interface DpLookups {
  presets: Record<string, DpPresetInstallment[]>;
}

export interface DpInstallmentInput {
  milestone_label?: string;
  trigger_type: DpTrigger;
  due_date?: string;
  calculation_mode: DpCalculationMode;
  percentage?: string;
  amount?: string;
  instrument_type: DpInstrument;
}

export interface DpContractLine {
  description?: string;
  vat_rate: string;
  net: string;
}

export interface DpPlanPayload {
  source_type: DpSourceType;
  source_id: string;
  template?: DpPresetKey | string;
  installments?: DpInstallmentInput[];
  contract?: { customer_id?: string; number?: string; currency?: string; lines?: DpContractLine[] };
}

export interface DpCreatePayload extends DpPlanPayload {
  notes?: string;
}

export interface DpPlanRow {
  sequence: number;
  milestone_label: string;
  trigger_type: DpTrigger;
  due_date: string | null;
  calculation_mode: DpCalculationMode;
  percentage: string | null;
  amount_net: string;
  amount_vat: string;
  amount_gross: string;
  instrument_type: DpInstrument;
  vat_breakdown: DpVatSlice[];
  rounding_drift: string;
}

export interface DpPlanPreview {
  source: {
    type: DpSourceType;
    id: string;
    number: string | null;
    customer_id: string;
    customer_name: string | null;
    currency: string;
    jurisdiction: DpJurisdiction;
  };
  contract_net: string;
  contract_gross: string;
  vat_bases: Record<string, string>;
  installments: DpPlanRow[];
  planned_gross: string;
  rounding_drift: string;
  presets: string[];
}

// --- Emission and payments ---

export interface DpEmitPayload {
  date?: string;
  due_date?: string;
  payment_date?: string;
  payment_account?: DpPaymentAccount;
}

export interface DpEmitResult {
  instrument: DpInstrument;
  link_id: string | null;
  document_id: string | null;
  deposit_id: string | null;
  chain: DpChainDetail;
}

export interface DpConfirmPaymentPayload {
  paid_at: string;
  reference?: string;
  payment_method?: string;
  payment_account?: DpPaymentAccount;
}

// --- Deposit resolution ---

export interface DpResolvePayload {
  resolution: DpResolution;
  date?: string;
  refund_mode?: DpRefundMode;
  payment_account?: DpPaymentAccount;
  notes?: string;
}

export interface DpJournalLine {
  account: string;
  debit: string;
  credit: string;
}

export interface DpResolutionPreview {
  resolution: DpResolution;
  vat_applies: boolean;
  lines: DpJournalLine[];
  penalty_amount: string;
}

// --- Final settlement ---

export interface DpSettlementSupplyLine {
  description: string;
  quantity: string;
  unit_price: string;
  vat_rate: string;
}

export interface DpSettlementDeduction {
  link_id: string;
  advance_item_id: string;
  advance_invoice_number: string;
  advance_invoice_date: string;
  vat_rate: string;
  net: string;
  vat: string;
  gross: string;
}

export interface DpLinkedDocument {
  id_documento: string;
  data: string;
  riferimento_numero_linea: number;
  num_item: string | number | null;
}

export interface DpSettlementBlocker {
  code: 'open_proforma' | 'held_earnest_money' | string;
  id: string;
}

export interface DpSettlementTotals {
  supply_net: string;
  supply_vat: string;
  supply_gross: string;
  deducted_net: string;
  deducted_vat: string;
  deducted_gross: string;
  final_net: string;
  final_vat: string;
  final_gross: string;
  vat_rounding_difference: string;
}

export interface DpSettlementPreview {
  chain_id: string;
  currency: string;
  supply_lines: DpSettlementSupplyLine[];
  deduction_lines: DpSettlementDeduction[];
  totals: DpSettlementTotals;
  linked_documents: DpLinkedDocument[];
  journal_preview: DpJournalLine[];
  blockers: DpSettlementBlocker[];
}

export interface DpSettlementPayload {
  date?: string;
  due_date?: string;
  document_type?: DpSettlementType;
  payment_method?: string;
  impute_deposit_ids?: string[];
}

export interface DpSettlementResult {
  invoice_id: string;
  invoice_number: string;
  chain: DpChainDetail;
}

// --- Credit note of an advance ---

export interface DpCreditNotePayload {
  mode: DpCreditMode;
  amount?: string;
  lines?: { vat_rate: string; net: string }[];
  date?: string;
  reason?: string;
}

export interface DpCreditNotePreview {
  slices: DpVatSlice[];
  credited_net: string;
  credited_vat: string;
  credited_gross: string;
  residual_before_gross: string;
  residual_after_gross: string;
  advance_residual_after_gross: string;
}

export interface DpCreditNoteResult {
  credit_note_id: string | null;
  credit_note_number: string | null;
  chain: DpChainDetail;
}
