/**
 * Wire types of the withholding taxes module (Mod 356: commissions, royalties, occasional work, amateur sports; CU, F24, AVS),
 * served under `/api/v1/withholding-recipients`. Amounts and rates travel as decimal strings; dates as `YYYY-MM-DD`.
 */

export const WR_REGIMES = [
  'agent_25bis',
  'author_royalty',
  'occasional_worker',
  'amateur_sports',
  'swiss_foreign_artist',
  'swiss_de_minimis',
] as const;
export type WrRegime = (typeof WR_REGIMES)[number];

export const WR_JURISDICTIONS = ['IT', 'CH'] as const;
export type WrJurisdiction = (typeof WR_JURISDICTIONS)[number];

export const WR_ACTIVITY_TYPES = ['artist', 'athlete', 'speaker'] as const;
export type WrActivityType = (typeof WR_ACTIVITY_TYPES)[number];

export const WR_ENASARCO_MANDATES = ['mono', 'pluri'] as const;
export type WrEnasarcoMandate = (typeof WR_ENASARCO_MANDATES)[number];

export const WR_CU_CAUSALS = ['A', 'M', 'M1', 'B', 'N', 'Q', 'R', 'V'] as const;
export type WrCuCausal = (typeof WR_CU_CAUSALS)[number];

export const WR_CERT_STATUSES = ['active', 'expiring', 'expired', 'upcoming'] as const;
export type WrCertStatus = (typeof WR_CERT_STATUSES)[number];

export const WR_INL_STATUSES = ['draft', 'sent', 'cancelled'] as const;
export type WrInlStatus = (typeof WR_INL_STATUSES)[number];

export const WR_INL_FORMATS = ['pdf', 'xml', 'json'] as const;
export type WrInlFormat = (typeof WR_INL_FORMATS)[number];

export const WR_THRESHOLD_KEYS = [
  'occasional_5000',
  'sports_5000',
  'sports_15000',
  'avs_2300',
  'enasarco_ceiling',
] as const;
export type WrThresholdKey = (typeof WR_THRESHOLD_KEYS)[number];

export const WR_ALERT_CODES = [
  'agent_certificate_missing',
  'agent_certificate_expiring',
  'enasarco_mandate_missing',
  'birth_date_missing',
  'inl_notification_missing',
  'occasional_threshold_reached',
  'sports_threshold_reached',
  'avs_de_minimis_exceeded',
] as const;

export const WR_WARNING_CODES = [
  'enasarco_mandate_missing',
  'enasarco_ceiling_reached',
  'birth_date_missing',
  'inps_threshold_exceeded',
  'sports_irpef_threshold_exceeded',
  'sports_inps_threshold_exceeded',
  'avs_de_minimis_exceeded',
] as const;

export const WR_NOTE_CODES = [
  'agent_reduced_base_20',
  'agent_standard_base_50',
  'agent_certificate_missing',
  'royalty_under_35',
  'royalty_35_and_over',
  'out_of_vat_scope_art_3_c4_a',
  'revenue_stamp_applied',
  'sports_inps_full_base',
  'sports_inps_half_base',
  'avs_cultural_sector_from_first_franc',
  'avs_de_minimis_exempt',
  'source_tax_documented_expenses',
  'source_tax_flat_expenses',
] as const;

/** Problem `code`s the API answers with; each has a translation `withholdingRecipients.error.<code>`. */
export const WR_ERROR_CODES = [
  'inl_not_applicable',
  'inl_cancelled',
  'inl_notification_missing',
  'inl_notification_late',
  'inl_notification_expired',
  'recipient_inactive',
  'service_after_payment',
  'net_not_positive',
  'regime_locked',
  'recipient_has_settlements',
  'certificate_not_applicable',
] as const;

// --- Envelopes ---

export interface WrEnvelope<T, M = Record<string, unknown>> {
  success: boolean;
  message: string;
  data: T;
  meta?: M;
}

export interface WrPageMeta {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

export interface WrPage<T> extends WrEnvelope<T[], WrPageMeta> {
  meta: WrPageMeta;
}

/** RFC 7807 problem the module answers with; `code` is the suffix of `withholdingRecipients.error.<code>`. */
export interface WrProblem {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  code?: string;
  message?: string;
  errors?: Record<string, string[]>;
}

// --- Lookups ---

export interface WrRegimeLookup {
  value: WrRegime;
  jurisdiction: WrJurisdiction;
  currency: string;
  cu_causal: string;
}

export interface WrParameters {
  occasional_inps_threshold: string;
  stamp_threshold: string;
  stamp_amount: string;
  sports_exempt_threshold: string;
  sports_irpef_threshold: string;
  swiss_de_minimis: string;
  enasarco_ceiling: { mono: string; pluri: string };
}

export interface WrLookups {
  regimes: WrRegimeLookup[];
  cu_causals: string[];
  activity_types: WrActivityType[];
  enasarco_mandates: WrEnasarcoMandate[];
  parameters: WrParameters;
}

// --- Thresholds and dashboard ---

export interface WrThreshold {
  key: WrThresholdKey;
  current: string;
  limit: string;
  percent: number;
}

export interface WrDashboardFilters {
  regime?: WrRegime | null;
  jurisdiction?: WrJurisdiction | null;
  cu_causal?: string | null;
  search?: string | null;
  year?: number | null;
  only_alerts?: boolean | null;
}

export interface WrDashboardRow {
  id: string;
  display_name: string;
  regime: WrRegime;
  jurisdiction: WrJurisdiction;
  cu_causal: string;
  currency: string;
  tax_code: string | null;
  is_active: boolean;
  ytd_gross: string;
  ytd_withheld: string;
  payments: number;
  alerts: string[];
  thresholds: WrThreshold[];
}

export interface WrDashboardMeta {
  year: number;
  recipients: number;
  with_alerts: number;
  ytd_gross_eur: string;
  ytd_gross_chf: string;
  pending_inl: number;
}

// --- Recipients ---

export interface WrCertificate {
  id: string;
  recipient_profile_id: string;
  fiscal_year: number;
  received_on: string;
  valid_from: string;
  valid_to: string;
  pec_message_id: string | null;
  pec_archive_reference: string | null;
  notes: string | null;
  status: WrCertStatus;
  received_in_time: boolean;
}

export interface WrCertificatePayload {
  fiscal_year: number;
  received_on: string;
  valid_from: string;
  valid_to: string;
  pec_message_id: string | null;
  pec_archive_reference: string | null;
  notes: string | null;
}

export interface WrInlNotification {
  id: string;
  recipient_profile_id: string;
  status: WrInlStatus;
  work_start_date: string;
  work_end_date: string;
  activity_description: string;
  work_place: string | null;
  estimated_compensation: string | null;
  sent_at: string | null;
  sent_before_start: boolean;
  protocol_reference: string | null;
  payload?: unknown;
}

export interface WrInlPayload {
  work_start_date: string;
  work_end_date: string;
  activity_description: string;
  work_place: string | null;
  estimated_compensation: number | null;
}

export interface WrMarkSentPayload {
  protocol_reference?: string | null;
  sent_at?: string | null;
}

export interface WrRecipient {
  id: string;
  contact_id: string | null;
  display_name: string;
  regime: WrRegime;
  jurisdiction: WrJurisdiction;
  currency: string;
  tax_code: string | null;
  vat_number: string | null;
  avs_number: string | null;
  birth_date: string | null;
  country_of_residence: string | null;
  canton: string | null;
  enasarco_mandate: WrEnasarcoMandate | null;
  firr_enabled: boolean;
  is_cultural_sector: boolean;
  activity_type: WrActivityType | null;
  cu_causal: string | null;
  third_party_ytd_income: string | null;
  third_party_income_year: number | null;
  third_party_declared_on: string | null;
  is_active: boolean;
  notes: string | null;
  certificates?: WrCertificate[];
  inl_notifications?: WrInlNotification[];
}

export interface WrRecipientPayload {
  display_name?: string;
  regime?: WrRegime;
  contact_id?: string | null;
  tax_code?: string | null;
  vat_number?: string | null;
  avs_number?: string | null;
  birth_date?: string | null;
  country_of_residence?: string | null;
  canton?: string | null;
  enasarco_mandate?: WrEnasarcoMandate | null;
  firr_enabled?: boolean;
  is_cultural_sector?: boolean;
  activity_type?: WrActivityType | null;
  cu_causal?: string | null;
  third_party_ytd_income?: number | null;
  third_party_income_year?: number | null;
  third_party_declared_on?: string | null;
  is_active?: boolean;
  notes?: string | null;
}

// --- Simulation and settlements ---

export interface WrSimulatePayload {
  recipient_profile_id?: string | null;
  regime?: WrRegime | null;
  gross_amount: number;
  payment_date: string;
  service_date?: string | null;
  performance_days?: number | null;
  acquisition_expenses?: number | null;
  birth_date?: string | null;
  tax_code?: string | null;
  enasarco_mandate?: WrEnasarcoMandate | null;
  firr_enabled?: boolean;
  is_cultural_sector?: boolean;
  activity_type?: WrActivityType | null;
  has_reduced_certificate?: boolean;
  prior_company_income?: number | null;
  third_party_income?: number | null;
  prior_avs_base?: number | null;
  canton?: string | null;
}

/** The figures of a calculation: the same names in a simulation and in a posted settlement. */
export interface WrCalculation {
  currency: string;
  gross_amount: string;
  flat_rate_deduction: string;
  taxable_base: string;
  withholding_rate: string;
  effective_withholding_rate: string;
  irpef_withholding: string;
  inps_base: string;
  inps_total: string;
  inps_worker: string;
  inps_company: string;
  stamp_duty: string;
  enasarco_base: string;
  enasarco_agent: string;
  enasarco_company: string;
  firr_accrual: string;
  avs_base: string;
  avs_employee: string;
  avs_employer: string;
  acquisition_expenses: string;
  source_tax: string;
  non_taxable_amount: string;
  non_taxable_code: string | null;
  cu_causal: string | null;
  net_payable: string;
  company_cost: string;
}

export interface WrSimulation extends WrCalculation {
  thresholds: WrThreshold[];
  warnings: string[];
  notes: string[];
}

export interface WrF24Line {
  tax_code: string;
  reference_month: string | number | null;
  reference_year: number | null;
  amount: string;
  section: string;
}

export interface WrSettlement extends WrCalculation {
  id: string;
  recipient_profile_id: string;
  recipient_name: string;
  regime: WrRegime;
  jurisdiction: WrJurisdiction;
  document_number: string | null;
  service_date: string | null;
  payment_date: string;
  tax_year: number;
  accrual_month: string;
  status: string;
  f24_due_date: string | null;
  f24_lines: WrF24Line[];
  uniemens_required: boolean;
  inl_notification_id: string | null;
  payment_reference: string | null;
  breakdown?: unknown;
  warnings: string[];
  notes: string[];
}

export interface WrSettlementFilters {
  recipient_profile_id?: string | null;
  regime?: WrRegime | null;
  jurisdiction?: WrJurisdiction | null;
  tax_year?: number | null;
  accrual_month?: string | null;
  per_page?: number | null;
  page?: number | null;
}

export interface WrPaymentPayload {
  recipient_profile_id: string;
  gross_amount: number;
  payment_date: string;
  service_date?: string | null;
  document_number?: string | null;
  payment_reference?: string | null;
  performance_days?: number | null;
  acquisition_expenses?: number | null;
  notes?: string | null;
}

// --- Flows and annual returns ---

export interface WrF24Preview {
  month: string;
  due_date: string | null;
  lines: {
    section: string;
    tax_code: string;
    reference_month: string | number | null;
    reference_year: number | null;
    amount: string;
    settlements: number;
  }[];
  total: string;
}

export type WrReturnType = 'CU' | 'AVS_QST';

export interface WrAnnualRecord {
  id: string;
  recipient_profile_id: string;
  recipient_name: string;
  tax_code: string | null;
  tax_year: number;
  return_type: WrReturnType;
  causal: string | null;
  currency: string;
  gross_total: string;
  non_taxable_total: string;
  non_taxable_code: string | null;
  taxable_total: string;
  withholding_total: string;
  inps_worker_total: string;
  inps_company_total: string;
  enasarco_total: string;
  avs_total: string;
  source_tax_total: string;
  settlement_count: number;
  status: string;
  generated_at: string | null;
}
