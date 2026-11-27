/** Wire types of the foreign VAT refund module (Mod 227): ledger, claims (dossiers), threshold monitor, reciprocity matrix and fiscal representative mandates. */

export const FVR_REGIMES = [
  'EU_DIR_2008_9_CE',
  'CH_ESTV_RECIPROCITY',
  'IT_ART_38_TER',
  'XIII_DIR_86_560_CEE',
] as const;
export type FvrRegime = (typeof FVR_REGIMES)[number];

export const FVR_LEDGER_STATUSES = [
  'PENDING_REVIEW',
  'ELIGIBLE_ACCUMULATING',
  'INCLUDED_IN_CLAIM',
  'REFUNDED',
  'PARTIALLY_REJECTED',
  'NON_RECOVERABLE_EXPENSED',
] as const;
export type FvrLedgerStatus = (typeof FVR_LEDGER_STATUSES)[number];

export const FVR_CLAIM_STATUSES = [
  'DRAFT',
  'READY_TO_SUBMIT',
  'SUBMITTED',
  'ADDITIONAL_INFO_REQUESTED',
  'PARTIALLY_APPROVED',
  'APPROVED',
  'REFUNDED',
  'REJECTED',
] as const;
export type FvrClaimStatus = (typeof FVR_CLAIM_STATUSES)[number];

/** The steps of the status timeline of a claim, in the order of the normal lifecycle. */
export const FVR_CLAIM_STEPS = ['DRAFT', 'READY_TO_SUBMIT', 'SUBMITTED', 'DECIDED', 'REFUNDED'] as const;

export const FVR_PERIOD_TYPES = ['ANNUAL', 'QUARTERLY'] as const;
export type FvrPeriodType = (typeof FVR_PERIOD_TYPES)[number];

export const FVR_SOURCE_TYPES = ['PASSIVE_INVOICE', 'EXPENSE_REPORT', 'MANUAL'] as const;
export type FvrSourceType = (typeof FVR_SOURCE_TYPES)[number];

export const FVR_EXPENSE_CATEGORIES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

export const FVR_VAT_BOOKED_ON = ['input_vat', 'expense'] as const;
export type FvrVatBookedOn = (typeof FVR_VAT_BOOKED_ON)[number];

export const FVR_ELIGIBILITY = ['THRESHOLD_MET', 'BELOW_THRESHOLD'] as const;
export type FvrEligibility = (typeof FVR_ELIGIBILITY)[number];

export const FVR_MANDATE_STATUSES = [
  'NOT_REQUIRED',
  'MISSING',
  'CERTIFICATE_MISSING',
  'CERTIFICATE_EXPIRED',
  'CERTIFICATE_EXPIRING',
  'VALID',
] as const;
export type FvrMandateStatus = (typeof FVR_MANDATE_STATUSES)[number];

export const FVR_EXPORT_TYPES = ['eu-xml', 'estv-package', 'iva79-package'] as const;
export type FvrExportType = (typeof FVR_EXPORT_TYPES)[number];

export const FVR_ALERT_LEVELS = ['60', '30', '15', 'EXPIRED'] as const;

export const FVR_KPIS = [
  'accumulating',
  'ready_to_claim',
  'submitted_awaiting_refund',
  'refunded_ytd',
] as const;
export type FvrKpi = (typeof FVR_KPIS)[number];

/** Countries the application knows (ISO 3166-1 alpha-2). */
export const FVR_COUNTRIES = [
  'CH',
  'IT',
  'DE',
  'FR',
  'AT',
  'ES',
  'NL',
  'BE',
  'PT',
  'LU',
  'IE',
  'FI',
  'GR',
  'SI',
  'SK',
  'EE',
  'LV',
  'LT',
  'MT',
  'CY',
  'HR',
  'DK',
  'SE',
  'PL',
  'CZ',
  'HU',
  'RO',
  'BG',
  'GB',
] as const;

/** Event names of the trail of a claim. */
export const FVR_CLAIM_EVENTS = [
  'created',
  'status_changed',
  'export_generated',
  'refund_reconciled',
  'deleted',
] as const;

/** Codes of the refusals of the API (`foreign_vat_refund.errors`) plus the fallback of the UI. */
export const FVR_ERROR_CODES = [
  'domestic_vat',
  'no_procedure',
  'no_reciprocity',
  'period_not_allowed',
  'no_items',
  'below_threshold',
  'deadline_expired',
  'ledger_entry_locked',
  'claim_locked',
  'invalid_transition',
  'fiscal_representative_missing',
  'certificate_missing',
  'certificate_expired',
  'attachments_missing',
  'approved_amount_invalid',
  'refund_amount_required',
  'refund_exceeds_approved',
  'exchange_rate_required',
  'bank_account_not_found',
  'bank_account_without_ledger_account',
  'account_role_missing',
  'not_a_foreign_vat_item',
  'applicant_vat_number_missing',
  'xml_invalid',
  'vat_rate_not_allowed',
  'export_not_supported_for_regime',
  'export_unknown',
  'rule_not_editable',
  'file_not_found',
  'upload_failed',
  'bundle_failed',
  'quarter_required',
  'unknown',
] as const;

export interface FvrEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
  meta?: FvrPageMeta;
}

export interface FvrPageMeta {
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
}

/** RFC 7807 problem of a refusal: the `code` picks the translation. */
export interface FvrProblem {
  title?: string;
  detail?: string;
  code?: string;
  context?: Record<string, string | number | null>;
  errors?: Record<string, string[]>;
}

export interface FvrMoney {
  currency: string;
  amount: string;
}

export interface FvrQuarter {
  quarter: number;
  amount: string;
  threshold: string;
  progress_percent: string;
  eligibility_status: FvrEligibility;
}

export interface FvrRepresentativeState {
  status: FvrMandateStatus;
  mandate_id: string | null;
  certificate_expiry_date: string | null;
}

export interface FvrMonitorRow {
  country_code: string;
  fiscal_year: number;
  regime_type: FvrRegime;
  currency_code: string;
  has_reciprocity: boolean;
  items_count: number;
  other_currency_items: number;
  accumulated_amount: string;
  threshold_annual: string | null;
  threshold_quarterly: string | null;
  progress_percent: string;
  eligibility_status: FvrEligibility;
  quarters: FvrQuarter[];
  deadline_date: string;
  days_remaining: number;
  alert_level: number | 'EXPIRED' | null;
  requires_fiscal_representative: boolean;
  requires_taxable_status_certificate: boolean;
  representative: FvrRepresentativeState;
}

export interface FvrDashboard {
  kpis: Record<FvrKpi, FvrMoney[]>;
  monitor: FvrMonitorRow[];
  generated_on: string;
}

export interface FvrLedgerEntry {
  id: string;
  source_type: FvrSourceType;
  source_id: string | null;
  document_number: string;
  document_date: string;
  supplier_name: string | null;
  supplier_vat_number: string | null;
  supplier_country_code: string;
  expense_category_code: number;
  net_amount: string;
  foreign_vat_rate: string;
  foreign_vat_amount: string;
  currency_code: string;
  exchange_rate_to_base: string;
  base_currency_foreign_vat_amount: string;
  eligible_percentage: string;
  recoverable_vat_amount: string;
  non_recoverable_vat_amount: string;
  base_recoverable_vat_amount: string;
  status: FvrLedgerStatus;
  vat_refund_claim_id: string | null;
  claim_number: string | null;
  fiscal_year: number;
  fiscal_quarter: number;
  has_attachment: boolean;
  journal_entry_id: string | null;
  posting_error: string | null;
  editable: boolean;
}

export interface FvrLedgerFilters {
  country?: string | null;
  status?: FvrLedgerStatus | null;
  category?: number | null;
  fiscal_year?: number | null;
  fiscal_quarter?: number | null;
  source_type?: FvrSourceType | null;
  claim_id?: string | null;
  search?: string | null;
  page?: number;
  per_page?: number;
}

export interface FvrManualLedgerPayload {
  document_number: string;
  document_date: string;
  supplier_name?: string | null;
  supplier_vat_number?: string | null;
  supplier_country_code: string;
  expense_category_code: number;
  net_amount: number;
  foreign_vat_rate: number;
  foreign_vat_amount: number;
  currency_code: string;
  exchange_rate_to_base?: number | null;
  vat_booked_on?: FvrVatBookedOn | null;
  post_to_ledger?: boolean;
}

export interface FvrSplitPreview {
  home_country: string;
  country: string;
  expense_category_code: number;
  vat_amount: string;
  applies: boolean;
  reason: 'domestic' | 'no_rule' | 'no_reciprocity' | null;
  has_reciprocity: boolean;
  regime_type: FvrRegime | null;
  deductible_percentage: string;
  recoverable_vat_amount: string;
  non_recoverable_vat_amount: string;
  currency_code: string | null;
}

export interface FvrClaimPreviewItem {
  id: string;
  document_number: string;
  document_date: string;
  supplier_name: string | null;
  expense_category_code: number;
  recoverable_vat_amount: string;
  has_attachment: boolean;
}

export interface FvrClaimPreview {
  home_country_code: string;
  target_country_code: string;
  regime_type?: FvrRegime;
  currency_code?: string;
  period_type?: FvrPeriodType;
  fiscal_year?: number;
  period_start_date?: string;
  period_end_date?: string;
  statutory_deadline_date?: string;
  days_remaining?: number;
  items_count: number;
  items: FvrClaimPreviewItem[];
  total_requested_amount?: string;
  carried_base_amount?: string;
  threshold?: string | null;
  requires_fiscal_representative?: boolean;
  requires_taxable_status_certificate?: boolean;
  representative?: FvrRepresentativeState;
  blockers: string[];
}

export interface FvrClaimPeriodPayload {
  target_country_code: string;
  fiscal_year: number;
  period_type: FvrPeriodType;
  quarter?: number | null;
  ledger_ids?: string[];
}

export interface FvrCreateClaimPayload extends FvrClaimPeriodPayload {
  notes?: string | null;
}

export interface FvrClaimEvent {
  id: string;
  event: string;
  from_status: FvrClaimStatus | null;
  to_status: FvrClaimStatus | null;
  note: string | null;
  payload: Record<string, unknown> | null;
  user_id: string | null;
  created_at: string | null;
}

export interface FvrClaim {
  id: string;
  claim_number: string;
  home_country_code: string;
  target_country_code: string;
  regime_type: FvrRegime;
  period_type: FvrPeriodType;
  fiscal_year: number;
  period_start_date: string;
  period_end_date: string;
  statutory_deadline_date: string;
  currency_code: string;
  total_requested_amount: string;
  total_approved_amount: string;
  total_rejected_amount: string;
  total_refunded_amount: string;
  carried_base_amount: string;
  refund_exchange_rate: string | null;
  fiscal_representative_mandate_id: string | null;
  status: FvrClaimStatus;
  allowed_transitions: FvrClaimStatus[];
  locked: boolean;
  submission_date: string | null;
  protocol_number: string | null;
  has_xml: boolean;
  has_pdf_dossier: boolean;
  has_zip_bundle: boolean;
  bank_account_id: string | null;
  refunded_on: string | null;
  notes: string | null;
  items_count?: number;
  items?: FvrLedgerEntry[];
  events?: FvrClaimEvent[];
}

export interface FvrSubmitPayload {
  protocol_number?: string | null;
  submitted_on?: string | null;
}

export interface FvrDecidePayload {
  approved_amount: number;
  note?: string | null;
}

export interface FvrReconcilePayload {
  refunded_amount: number;
  bank_account_id: string;
  exchange_rate?: number | null;
  received_on?: string | null;
  note?: string | null;
}

export interface FvrRule {
  id: string;
  is_global: boolean;
  home_country_code: string;
  refund_country_code: string;
  regime_type: FvrRegime;
  has_reciprocity: boolean;
  expense_category_code: number;
  sub_code: string | null;
  deductible_percentage: string;
  min_annual_amount: string | null;
  min_quarterly_amount: string | null;
  currency_code: string;
  filing_deadline_month: number;
  filing_deadline_day: number;
  vat_rates: string[] | null;
  requires_fiscal_representative: boolean;
  requires_taxable_status_certificate: boolean;
  notes_key: string | null;
  is_active: boolean;
}

export interface FvrRulePayload {
  home_country_code: string;
  refund_country_code: string;
  regime_type: FvrRegime;
  has_reciprocity: boolean;
  expense_category_code: number;
  sub_code?: string | null;
  deductible_percentage: number;
  min_annual_amount?: number | null;
  min_quarterly_amount?: number | null;
  currency_code: string;
  filing_deadline_month: number;
  filing_deadline_day: number;
  vat_rates?: string[] | null;
  requires_fiscal_representative?: boolean;
  requires_taxable_status_certificate?: boolean;
  notes_key?: string | null;
  is_active?: boolean;
}

export interface FvrRulesMeta {
  home_country: string;
  countries: string[];
}

export interface FvrMandate {
  id: string;
  country_code: string;
  representative_name: string;
  representative_tax_id: string | null;
  address: string | null;
  postal_code: string | null;
  city: string | null;
  email: string | null;
  phone: string | null;
  mandate_start_date: string;
  mandate_end_date: string | null;
  has_power_of_attorney: boolean;
  has_certificate: boolean;
  certificate_expiry_date: string | null;
  certificate_valid: boolean;
  is_active: boolean;
}

export interface FvrMandatePayload {
  country_code: string;
  representative_name: string;
  representative_tax_id?: string | null;
  address?: string | null;
  postal_code?: string | null;
  city?: string | null;
  email?: string | null;
  phone?: string | null;
  mandate_start_date: string;
  mandate_end_date?: string | null;
  certificate_expiry_date?: string | null;
  is_active?: boolean;
}

export interface FvrSettings {
  auto_intercept: boolean;
  receivable_account_id: string | null;
  non_recoverable_expense_account_id: string | null;
}

export interface FvrReference {
  home_country: string;
  refund_countries: string[];
  countries: { code: string; currency_code: string; eu_member_state: boolean }[];
  expense_categories: number[];
  regimes: FvrRegime[];
  ledger_statuses: FvrLedgerStatus[];
  claim_statuses: FvrClaimStatus[];
  period_types: FvrPeriodType[];
  source_types: FvrSourceType[];
}
