/**
 * Wire types of the GDO trade terms module (Mod 231), served under `/api/v1/gdo-trade-terms`: framework contracts with retail
 * chains, tiered year-end rebates (PFA), trade promotions, monthly accruals and settlements.
 * Amounts travel as decimal strings (a number is accepted on input); dates as `YYYY-MM-DD`, instants as ISO 8601.
 * Every label of these codes is in the dictionary the API serves (`gdoTradeTerms.<group>.<code>`).
 */

export type GdtDecimal = string | number;

export const GDT_CONTRACT_STATUSES = ['draft', 'active', 'suspended', 'closed', 'cancelled'] as const;
export type GdtContractStatus = (typeof GDT_CONTRACT_STATUSES)[number];

export const GDT_JURISDICTIONS = ['IT', 'CH'] as const;
export type GdtJurisdiction = (typeof GDT_JURISDICTIONS)[number];

export const GDT_TIER_MODES = ['retroactive', 'progressive'] as const;
export type GdtTierMode = (typeof GDT_TIER_MODES)[number];

export const GDT_BASES = ['turnover', 'quantity'] as const;
export type GdtBasis = (typeof GDT_BASES)[number];

export const GDT_VOLUME_MODES = ['total', 'incremental'] as const;
export type GdtVolumeMode = (typeof GDT_VOLUME_MODES)[number];

export const GDT_BASELINE_SOURCES = ['manual', 'prior_period'] as const;
export type GdtBaselineSource = (typeof GDT_BASELINE_SOURCES)[number];

export const GDT_PROMOTION_TYPES = [
  'sell_in_flyer',
  'sell_out',
  'new_store_opening',
  'listing_fee',
  'display',
  'cedi_logistics',
] as const;
export type GdtPromotionType = (typeof GDT_PROMOTION_TYPES)[number];

export const GDT_PROMOTION_STATUSES = ['draft', 'active', 'ended', 'cancelled'] as const;
export type GdtPromotionStatus = (typeof GDT_PROMOTION_STATUSES)[number];

export const GDT_DATE_BASES = ['order', 'delivery', 'invoice'] as const;
export type GdtDateBasis = (typeof GDT_DATE_BASES)[number];

export const GDT_CONTRIBUTION_MODES = [
  'percent_of_sales',
  'per_unit',
  'fixed_amount',
  'percent_of_sell_out',
] as const;
export type GdtContributionMode = (typeof GDT_CONTRIBUTION_MODES)[number];

export const GDT_FIXED_ACCRUALS = ['linear', 'on_start'] as const;
export type GdtFixedAccrual = (typeof GDT_FIXED_ACCRUALS)[number];

export const GDT_RUN_STATUSES = ['posted', 'reversed'] as const;
export type GdtRunStatus = (typeof GDT_RUN_STATUSES)[number];

export const GDT_LINE_STATUSES = ['accrued', 'reversed', 'settled'] as const;
export type GdtLineStatus = (typeof GDT_LINE_STATUSES)[number];

export const GDT_SOURCE_TYPES = ['scale', 'promotion'] as const;
export type GdtSourceType = (typeof GDT_SOURCE_TYPES)[number];

export const GDT_SETTLEMENT_KINDS = ['year_end', 'quarterly', 'campaign'] as const;
export type GdtSettlementKind = (typeof GDT_SETTLEMENT_KINDS)[number];

export const GDT_SETTLEMENT_STATUSES = ['proposed', 'disputed', 'settled', 'cancelled'] as const;
export type GdtSettlementStatus = (typeof GDT_SETTLEMENT_STATUSES)[number];

export const GDT_SETTLEMENT_LINE_STATUSES = ['open', 'settled', 'disputed', 'cancelled'] as const;
export type GdtSettlementLineStatus = (typeof GDT_SETTLEMENT_LINE_STATUSES)[number];

export const GDT_TREATMENTS = ['credit_note', 'promo_invoice'] as const;
export type GdtTreatment = (typeof GDT_TREATMENTS)[number];

export const GDT_TAX_TREATMENTS = [
  'it_art26_td04',
  'ch_art41_consideration_reduction',
  'standard_vat',
] as const;
export type GdtTaxTreatment = (typeof GDT_TAX_TREATMENTS)[number];

export const GDT_DELIVERY_POINT_TYPES = ['store', 'cedi', 'headquarters'] as const;
export type GdtDeliveryPointType = (typeof GDT_DELIVERY_POINT_TYPES)[number];

export const GDT_TRANSITIONS = ['activate', 'resume', 'suspend', 'close', 'cancel', 'end'] as const;
export type GdtTransition = (typeof GDT_TRANSITIONS)[number];

export const GDT_DISPUTE_REASONS = ['claim_exceeds_earned', 'claim_below_earned'] as const;

/** Codes of the problems the API reports (`gdoTradeTerms.error.<code>`). */
export const GDT_ERROR_CODES = [
  'contact_not_found',
  'period_invalid',
  'period_in_future',
  'invalid_action',
  'invalid_transition',
  'nothing_to_activate',
  'contract_has_accruals',
  'contract_not_deletable',
  'contract_locked',
  'contract_not_live',
  'open_settlements',
  'window_excludes_children',
  'window_outside_contract',
  'tiers_required',
  'tier_invalid',
  'tier_duplicate_threshold',
  'tier_rate_decreasing',
  'scale_overlap',
  'scale_settled',
  'scale_has_accruals',
  'promotion_overlap',
  'promotion_settled',
  'promotion_not_deletable',
  'contribution_value_required',
  'sell_out_mode_requires_sell_out_type',
  'sell_out_type_requires_sell_out_mode',
  'rate_invalid',
  'delivery_point_code_taken',
  'assignment_target_not_found',
  'assignment_contact_mismatch',
  'product_not_found',
  'ledger_account_missing',
  'later_runs_exist',
  'period_before_latest_run',
  'run_not_posted',
  'run_has_settled_lines',
  'nothing_to_settle',
  'open_settlement_exists',
  'credit_note_not_positive',
  'settlement_closed',
  'settlement_not_disputed',
  'settlement_has_settled_lines',
] as const;

// --- Envelopes ---

export interface GdtEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface GdtPageMeta {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

export interface GdtPage<T> extends GdtEnvelope<T[]> {
  meta: GdtPageMeta;
}

/** RFC 7807 problem of a refused rule: `code` picks the translated text, 422 brings the field errors. */
export interface GdtProblem {
  code?: string;
  detail?: string;
  errors?: Record<string, string[]>;
}

// --- Reference data ---

export interface GdtNamedRef {
  id: string;
  name: string;
}

export interface GdtCustomerRef extends GdtNamedRef {
  country: string | null;
}

export interface GdtCategoryRef extends GdtNamedRef {
  parent_id: string | null;
}

export interface GdtAccountRef {
  id: string;
  code: string | null;
  name: string;
}

export interface GdtProductRef {
  id: string;
  sku: string | null;
  name: string;
}

export interface GdtLookups {
  enums: Record<string, string[]>;
  promotion_treatments: Record<string, GdtTreatment>;
  tax_rates: Record<GdtJurisdiction, string>;
  tolerance_percent: string;
  customers: GdtCustomerRef[];
  categories: GdtCategoryRef[];
  brands: GdtNamedRef[];
  accounts: GdtAccountRef[];
}

// --- Contracts, scales, promotions ---

export interface GdtTier {
  id?: string;
  position?: number;
  threshold: GdtDecimal;
  rate_percent: GdtDecimal;
  flat_amount: GdtDecimal | null;
  label: string | null;
}

export interface GdtScope {
  category_ids: string[];
  brand_ids: string[];
  product_ids: string[];
  delivery_point_ids: string[];
}

export interface GdtScale extends GdtScope {
  id: string;
  contract_id: string;
  code: string;
  name: string;
  tier_mode: GdtTierMode;
  basis: GdtBasis;
  volume_mode: GdtVolumeMode;
  baseline_source: GdtBaselineSource;
  baseline_value: GdtDecimal;
  starts_on: string | null;
  ends_on: string | null;
  is_active: boolean;
  notes: string | null;
  tiers: GdtTier[];
}

export interface GdtPromotion extends GdtScope {
  id: string;
  contract_id: string;
  code: string;
  name: string;
  promotion_type: GdtPromotionType;
  treatment: GdtTreatment;
  date_basis: GdtDateBasis;
  starts_on: string;
  ends_on: string;
  contribution_mode: GdtContributionMode;
  rate_percent: GdtDecimal | null;
  unit_amount: GdtDecimal | null;
  fixed_amount: GdtDecimal | null;
  fixed_accrual: GdtFixedAccrual;
  cap_amount: GdtDecimal | null;
  status: GdtPromotionStatus;
  notes: string | null;
  contract?: { id: string; code: string; name: string };
}

export interface GdtContract {
  id: string;
  code: string;
  name: string;
  contact_id: string;
  contact: { id: string; name: string; country: string | null } | null;
  include_child_contacts: boolean;
  jurisdiction: GdtJurisdiction;
  currency: string;
  starts_on: string;
  ends_on: string;
  status: GdtContractStatus;
  discount_1_percent: GdtDecimal;
  discount_2_percent: GdtDecimal;
  discount_3_percent: GdtDecimal;
  cedi_discount_percent: GdtDecimal;
  pallet_discount_amount: GdtDecimal;
  effective_on_invoice_discount_percent: GdtDecimal;
  tolerance_percent: GdtDecimal;
  expense_account_id: string | null;
  provision_account_id: string | null;
  payable_account_id: string | null;
  vat_account_id: string | null;
  notes: string | null;
  activated_at: string | null;
  closed_at: string | null;
  scales?: GdtScale[];
  promotions?: GdtPromotion[];
}

export interface GdtContractFilters {
  status?: GdtContractStatus;
  contact_id?: string;
  jurisdiction?: GdtJurisdiction;
  q?: string;
  per_page?: number;
  page?: number;
}

export interface GdtContractPayload {
  code: string;
  name: string;
  contact_id: string;
  include_child_contacts?: boolean;
  jurisdiction?: GdtJurisdiction | null;
  currency?: string | null;
  starts_on: string;
  ends_on: string;
  discount_1_percent?: GdtDecimal | null;
  discount_2_percent?: GdtDecimal | null;
  discount_3_percent?: GdtDecimal | null;
  cedi_discount_percent?: GdtDecimal | null;
  pallet_discount_amount?: GdtDecimal | null;
  tolerance_percent?: GdtDecimal | null;
  expense_account_id?: string | null;
  provision_account_id?: string | null;
  payable_account_id?: string | null;
  vat_account_id?: string | null;
  notes?: string | null;
}

export interface GdtScalePayload extends Partial<GdtScope> {
  code: string;
  name: string;
  tier_mode: GdtTierMode;
  basis: GdtBasis;
  volume_mode: GdtVolumeMode;
  baseline_source?: GdtBaselineSource | null;
  baseline_value?: GdtDecimal | null;
  starts_on?: string | null;
  ends_on?: string | null;
  is_active?: boolean;
  notes?: string | null;
  tiers: GdtTier[];
}

export interface GdtPromotionPayload extends Partial<GdtScope> {
  code: string;
  name: string;
  promotion_type: GdtPromotionType;
  date_basis: GdtDateBasis;
  starts_on: string;
  ends_on: string;
  contribution_mode: GdtContributionMode;
  rate_percent?: GdtDecimal | null;
  unit_amount?: GdtDecimal | null;
  fixed_amount?: GdtDecimal | null;
  fixed_accrual?: GdtFixedAccrual | null;
  cap_amount?: GdtDecimal | null;
  notes?: string | null;
}

export interface GdtPromotionFilters {
  contract_id?: string;
  status?: GdtPromotionStatus;
  q?: string;
  per_page?: number;
  page?: number;
}

// --- Progress and simulator ---

export interface GdtNextTier {
  position: number;
  threshold: string;
  rate_percent: string;
  flat_amount: string | null;
}

export interface GdtProjection {
  elapsed_days: number;
  total_days: number;
  remaining_days: number;
  time_progress_percent: string;
  volume_to_date: string;
  projected_volume: string;
  qualifying_to_date: string;
  projected_qualifying: string;
  earned_to_date: string;
  tier_to_date: number | null;
  projected_rebate: string;
  projected_tier: number | null;
  projected_rate_percent: string | null;
  projected_effective_percent: string;
  next_tier: GdtNextTier | null;
  gap_to_next: string | null;
  required_daily_volume: string | null;
  attainment_percent: string;
  baseline: string;
  basis: GdtBasis;
}

export interface GdtScaleProgress {
  id: string;
  code: string;
  name: string;
  is_active: boolean;
  tier_mode: GdtTierMode;
  basis: GdtBasis;
  volume_mode: GdtVolumeMode;
  window_start: string;
  window_end: string;
  tiers: { threshold: string; rate_percent: string; flat_amount: string | null }[];
  earned_to_date: string;
  accrued: string;
  projection: GdtProjection;
}

export interface GdtPromotionProgress {
  id: string;
  code: string;
  name: string;
  promotion_type: GdtPromotionType;
  status: GdtPromotionStatus;
  starts_on: string;
  ends_on: string;
  earned_to_date: string;
  base_value: string;
  cap_amount: string | null;
  accrued: string;
}

export interface GdtProgress {
  contract_id: string;
  as_of: string;
  currency: string;
  effective_on_invoice_discount_percent: string;
  scales: GdtScaleProgress[];
  promotions: GdtPromotionProgress[];
  totals: {
    earned_scales: string;
    earned_promotions: string;
    earned_total: string;
    projected_scales: string;
    accrued_total: string;
  };
}

export interface GdtEarning {
  rebate: string;
  rate_percent: string | null;
  tier: number | null;
}

export interface GdtSimulationRow {
  volume: string;
  qualifying: string;
  retroactive: GdtEarning;
  progressive: GdtEarning;
  selected: GdtEarning;
  effective_percent: string;
}

export interface GdtSimulation {
  tier_mode: GdtTierMode;
  volume_mode: GdtVolumeMode;
  baseline: string;
  rows: GdtSimulationRow[];
  cliffs: { threshold: string; rebate_below: string; rebate_at: string; jump: string }[];
}

export interface GdtSimulationPayload {
  tier_mode: GdtTierMode;
  volume_mode: GdtVolumeMode;
  baseline_value: GdtDecimal;
  tiers: { threshold: GdtDecimal; rate_percent: GdtDecimal; flat_amount: GdtDecimal | null }[];
  volumes: GdtDecimal[];
}

// --- Accruals ---

export interface GdtAccrualLine {
  id?: string;
  contract_id: string;
  contract_code: string | null;
  source_type: GdtSourceType;
  source_id: string;
  source_label: string | null;
  currency: string;
  base_value: string;
  earned_cumulative: string;
  previously_accrued: string;
  delta_amount: string;
  applied_rate_percent: string | null;
  status?: GdtLineStatus;
}

export interface GdtAccrualRun {
  id: string;
  period_key: string;
  period_start: string;
  period_end: string;
  status: GdtRunStatus;
  total_accrued: string;
  contracts_count: number;
  journal_entry_id: string | null;
  reversal_journal_entry_id: string | null;
  posted_at: string | null;
  reversed_at: string | null;
  reversal_reason: string | null;
  lines?: GdtAccrualLine[];
}

export interface GdtAccrualResult {
  status: 'preview' | 'posted' | 'already_posted';
  run: GdtAccrualRun | null;
  period_key: string;
  period_start: string;
  period_end: string;
  lines: GdtAccrualLine[];
  total_accrued: string;
  contracts_count: number;
}

export interface GdtAccrualPayload {
  period: string;
  recalculate?: boolean;
}

// --- Settlements ---

export interface GdtSettlementLine {
  id: string;
  source_type: GdtSourceType;
  source_id: string;
  source_label: string | null;
  treatment: GdtTreatment;
  base_value: string;
  accrued_amount: string;
  earned_amount: string;
  variance_amount: string;
  cumulative_earned: string;
  status: GdtSettlementLineStatus;
}

export interface GdtSettlement {
  id: string;
  contract_id: string;
  contract?: {
    id: string;
    code: string;
    name: string;
    currency: string;
    jurisdiction: GdtJurisdiction;
    tolerance_percent: string;
  };
  code: string;
  kind: GdtSettlementKind;
  period_start: string;
  period_end: string;
  status: GdtSettlementStatus;
  tax_treatment: GdtTaxTreatment;
  currency: string;
  accrued_total: string;
  earned_total: string;
  variance_total: string;
  credit_note_amount: string;
  promo_amount: string;
  tax_rate: string | null;
  credit_note_id: string | null;
  claim_invoice_number: string | null;
  claim_invoice_date: string | null;
  claim_net: string | null;
  claim_tax: string | null;
  claim_variance: string | null;
  dispute_reason: string | null;
  release_journal_entry_id: string | null;
  set_off_journal_entry_id: string | null;
  settled_on: string | null;
  notes: string | null;
  lines?: GdtSettlementLine[];
}

export interface GdtSettlementFilters {
  status?: GdtSettlementStatus;
  contract_id?: string;
  per_page?: number;
  page?: number;
}

export interface GdtProposePayload {
  contract_id: string;
  kind: GdtSettlementKind;
  period_start: string;
  period_end: string;
}

export interface GdtCreditNotePayload {
  tax_rate: GdtDecimal;
  settled_on?: string | null;
}

export interface GdtPromoInvoicePayload {
  invoice_number: string;
  invoice_date: string;
  net: GdtDecimal;
  tax?: GdtDecimal | null;
  notes?: string | null;
}

export type GdtDisputeResolution = 'accept_claim' | 'reject';

// --- Delivery points ---

export interface GdtDeliveryPoint {
  id: string;
  contact_id: string;
  code: string;
  name: string;
  point_type: GdtDeliveryPointType;
  city: string | null;
  postal_code: string | null;
  country: string;
  is_active: boolean;
}

export interface GdtDeliveryPointPayload {
  contact_id: string;
  code: string;
  name: string;
  point_type?: GdtDeliveryPointType | null;
  city?: string | null;
  postal_code?: string | null;
  country?: string | null;
  is_active?: boolean;
}

// --- Dashboard and margin ---

export interface GdtDashboard {
  as_of: string;
  contracts_by_status: Record<GdtContractStatus, number>;
  active_promotions: number;
  accrued_unsettled: { scales: string; promotions: string };
  open_settlements: number;
  disputed_settlements: number;
  latest_run: { id: string; period_key: string; total_accrued: string; posted_at: string | null } | null;
  projections: {
    contract_id: string;
    code: string;
    name: string;
    currency: string;
    ends_on: string;
    earned_to_date: string;
    projected_scales: string;
    accrued: string;
  }[];
}

export interface GdtMarginRow {
  key: string;
  label: string;
  contract_id: string | null;
  product_id: string | null;
  quantity: string;
  gross_sales: string;
  net_sales: string;
  cost: string;
  off_invoice_rebates: string;
  promotion_contributions: string;
  on_invoice_discount: string;
  gross_margin: string;
  net_net_margin: string;
  on_invoice_discount_percent: string;
  gross_margin_percent: string;
  net_net_margin_percent: string;
}

export interface GdtMargin {
  from: string;
  to: string;
  group_by: 'product' | 'contract';
  estimated: boolean;
  rows: GdtMarginRow[];
  totals: GdtMarginRow;
}

export interface GdtMarginFilters {
  from: string;
  to: string;
  contract_id?: string;
  contact_id?: string;
  group_by?: 'product' | 'contract';
}
