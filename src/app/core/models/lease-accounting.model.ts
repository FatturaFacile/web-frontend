/**
 * Lease accounting of the lessee (IFRS 16, OIC, Swiss GAAP FER). Mirrors the FormRequests and resources of the
 * LeaseAccounting module of the API. Amounts are decimal strings with two decimals, rates are percentages as decimal
 * strings: they are never used for arithmetic here.
 */

export const LEASE_STATUSES = ['draft', 'active', 'expired', 'cancelled'] as const;
export type LeaseStatus = (typeof LEASE_STATUSES)[number];

export const LEASE_ASSET_CLASSES = ['real_estate', 'vehicles', 'machinery', 'it_equipment', 'other'] as const;
export type LeaseAssetClass = (typeof LEASE_ASSET_CLASSES)[number];

export const LEASE_STANDARDS = ['ifrs16', 'oic', 'swiss_gaap_fer'] as const;
export type LeaseStandard = (typeof LEASE_STANDARDS)[number];

export const LEASE_CURRENCIES = ['EUR', 'CHF'] as const;
export type LeaseCurrency = (typeof LEASE_CURRENCIES)[number];

export const LEASE_PAYMENT_FREQUENCIES = ['monthly', 'quarterly', 'semiannual', 'annual'] as const;
export type LeasePaymentFrequency = (typeof LEASE_PAYMENT_FREQUENCIES)[number];

export const LEASE_PAYMENT_TIMINGS = ['advance', 'arrears'] as const;
export type LeasePaymentTiming = (typeof LEASE_PAYMENT_TIMINGS)[number];

export const LEASE_ESCALATION_TYPES = ['none', 'fixed', 'index'] as const;
export type LeaseEscalationType = (typeof LEASE_ESCALATION_TYPES)[number];

export const LEASE_EXEMPTIONS = ['none', 'short_term', 'low_value'] as const;
export type LeaseExemption = (typeof LEASE_EXEMPTIONS)[number];

export const LEASE_REMEASURE_REASONS = ['modification', 'index_change', 'reassessment'] as const;
export type LeaseRemeasureReason = (typeof LEASE_REMEASURE_REASONS)[number];

export type LeaseVersionReason = 'initial' | LeaseRemeasureReason;
export type LeaseVersionStatus = 'current' | 'superseded';
export type LeaseLineStatus = 'scheduled' | 'posted' | 'superseded';

/** Months between two payments, per frequency (mirrors `LeaseContract::FrequencyMonths`). */
export const LEASE_FREQUENCY_MONTHS: Readonly<Record<LeasePaymentFrequency, number>> = {
  monthly: 1,
  quarterly: 3,
  semiannual: 6,
  annual: 12,
};

export interface LeaseScheduleVersion {
  id: string;
  lease_contract_id: string;
  version_number: number;
  reason: LeaseVersionReason;
  effective_date: string;
  start_period_number: number;
  end_period_number: number;
  discount_rate_percent: string;
  payment_amount: string;
  liability_before: string;
  liability_after: string;
  rou_before: string;
  rou_after: string;
  liability_adjustment: string;
  rou_adjustment: string;
  result_amount: string;
  total_undiscounted: string;
  journal_entry_id?: string | null;
  status: LeaseVersionStatus;
  notes?: string | null;
  created_at?: string;
}

export interface LeaseContract {
  id: string;
  number: string;
  title: string;
  lessor_name: string;
  lessor_contact_id?: string | null;
  asset_class: LeaseAssetClass;
  asset_description?: string | null;
  fixed_asset_id?: string | null;
  accounting_standard: LeaseStandard;
  currency: LeaseCurrency;
  commencement_date: string;
  term_months: number;
  payment_amount: string;
  payment_frequency: LeasePaymentFrequency;
  payment_timing: LeasePaymentTiming;
  escalation_type: LeaseEscalationType;
  escalation_rate_percent: string;
  incremental_borrowing_rate_percent: string;
  initial_direct_costs: string;
  incentives_received: string;
  purchase_option_price?: string | null;
  purchase_option_reasonably_certain: boolean;
  extension_months?: number | null;
  extension_reasonably_certain: boolean;
  useful_life_months?: number | null;
  exemption: LeaseExemption;
  underlying_asset_value?: string | null;
  rou_asset_account_id?: string | null;
  accumulated_depreciation_account_id?: string | null;
  lease_liability_account_id?: string | null;
  interest_expense_account_id?: string | null;
  depreciation_expense_account_id?: string | null;
  status: LeaseStatus;
  current_version_number: number;
  effective_term_months: number;
  activated_at?: string | null;
  cancelled_at?: string | null;
  cancellation_reason?: string | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
  versions?: LeaseScheduleVersion[];
}

/** Payload of `LeaseContractRequest`: required on creation, every field optional on a change of a draft. */
export interface LeaseContractRequest {
  title: string;
  lessor_name: string;
  lessor_contact_id?: string | null;
  asset_class: LeaseAssetClass;
  asset_description?: string | null;
  fixed_asset_id?: string | null;
  accounting_standard?: LeaseStandard;
  currency: LeaseCurrency;
  commencement_date: string;
  term_months: number;
  payment_amount: string;
  payment_frequency?: LeasePaymentFrequency;
  payment_timing?: LeasePaymentTiming;
  escalation_type?: LeaseEscalationType;
  escalation_rate_percent?: string | null;
  incremental_borrowing_rate_percent: string;
  initial_direct_costs?: string;
  incentives_received?: string;
  purchase_option_price?: string | null;
  purchase_option_reasonably_certain?: boolean;
  extension_months?: number | null;
  extension_reasonably_certain?: boolean;
  useful_life_months?: number | null;
  exemption?: LeaseExemption;
  underlying_asset_value?: string | null;
  rou_asset_account_id?: string | null;
  accumulated_depreciation_account_id?: string | null;
  lease_liability_account_id?: string | null;
  interest_expense_account_id?: string | null;
  depreciation_expense_account_id?: string | null;
  notes?: string | null;
}

export interface LeaseScheduleLine {
  id?: string;
  schedule_version_id?: string;
  period_number: number;
  period_start: string;
  period_end: string;
  opening_liability: string;
  payment: string;
  interest: string;
  principal: string;
  closing_liability: string;
  rou_opening: string;
  depreciation: string;
  rou_closing: string;
  status?: LeaseLineStatus;
}

export interface LeaseMeasurementPreview {
  discount_rate_percent: string;
  payment_amount: string;
  lease_liability: string;
  rou_asset: string;
  total_undiscounted: string;
  end_period_number: number;
  lines: LeaseScheduleLine[];
}

export interface LeaseActivateRequest {
  post_recognition?: boolean;
}

export interface LeaseRemeasureRequest {
  effective_date: string;
  reason: LeaseRemeasureReason;
  new_payment_amount?: string | null;
  remaining_term_months?: number | null;
  new_discount_rate_percent?: string | null;
  post_journal?: boolean;
  notes?: string | null;
}

export interface LeaseCancelRequest {
  reason: string;
}

export interface LeasePostPeriodsRequest {
  through_date: string;
}

export interface LeasePeriodPosting {
  id: string;
  lease_contract_id: string;
  period_number: number;
  posting_date: string;
  journal_entry_id: string;
  interest: string;
  depreciation: string;
  payment: string;
}

export interface LeasePostingRunResult {
  contract_id: string;
  number: string;
  posted_periods: number;
  error: string | null;
}

export interface LeaseMaturityBuckets {
  within_one_year: string;
  one_to_five_years: string;
  over_five_years: string;
}

export interface LeaseMaturityRow extends LeaseMaturityBuckets {
  contract_id: string;
  number: string;
  title: string;
  lessor_name: string;
  asset_class: LeaseAssetClass;
  accounting_standard: LeaseStandard;
  currency: LeaseCurrency;
  total_undiscounted: string;
  total_discounted: string;
  unearned_interest: string;
  current_liability: string;
  non_current_liability: string;
  rou_carrying_amount: string;
}

export interface LeaseMaturityTotals extends LeaseMaturityBuckets {
  total_undiscounted: string;
  total_discounted: string;
  unearned_interest: string;
  current_liability: string;
  non_current_liability: string;
  rou_carrying_amount: string;
}

export interface LeaseMaturitySection {
  currency: LeaseCurrency;
  leases: LeaseMaturityRow[];
  totals: LeaseMaturityTotals;
  exempt_commitments: LeaseMaturityBuckets;
}

export interface LeaseMaturityReport {
  as_of: string;
  currencies: LeaseMaturitySection[];
}
