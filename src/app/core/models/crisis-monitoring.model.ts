/**
 * Corporate crisis monitoring, early-warning indicators (CCII IT / Art. 725 CO CH) and DSCR (Mod 357, issue #603):
 * `/api/v1/crisis-monitoring`. Amounts are decimal strings, dates `YYYY-MM-DD`, months `YYYY-MM-01`.
 */

export interface CrisisEnvelope<T> {
  success?: boolean;
  message?: string;
  data: T;
  meta?: Record<string, unknown>;
}

export type CrisisStatus = 'green' | 'yellow' | 'red';
export type CrisisJurisdiction = 'IT' | 'CH';
export type CrisisHorizon = 'm6' | 'm12';
export type CrisisApproach = 'treasury' | 'operating';
export type CrisisBasis = 'going_concern' | 'liquidation';
export type CrisisLocale = 'it' | 'en' | 'de' | 'fr';

export interface CrisisDscr {
  value: string | null;
  status: CrisisStatus;
  applicable: boolean;
  numerator: string;
  denominator: string;
  label_key: string;
}

export type CrisisDscrHorizons = Record<CrisisHorizon, CrisisDscr>;
export type CrisisDscrApproaches = Record<CrisisApproach, CrisisDscrHorizons>;

export interface CrisisTimelineRow {
  month: string;
  operating_inflows: string;
  operating_outflows: string;
  debt_service: string;
  tax_social: string;
  capex: string;
  free_cash_flow: string;
  closing_cash: string;
  cumulative_cash_with_credit: string;
  dscr_treasury: string | null;
  dscr_operating: string | null;
}

export interface CrisisIndicator {
  code: string;
  label_key: string;
  description_key: string;
  kind: 'primary' | 'ratio';
  unit: 'amount' | 'ratio' | 'percent';
  actual: string | null;
  threshold: string | null;
  comparison: 'min' | 'max';
  variance: string | null;
  status: CrisisStatus;
}

export interface CrisisPublicCreditor {
  code: string;
  label_key: string;
  description_key: string;
  overdue_days: number | null;
  measured: string;
  limit: string | null;
  progress_percent: number;
  breached: boolean;
  status: CrisisStatus;
}

export interface CrisisCncCheck {
  code: string;
  label_key: string;
  passed: boolean | null;
}

export interface CrisisCnc {
  ratio: string | null;
  debt_to_restructure: string;
  annual_free_cash_flow: string;
  tier_code: string;
  tier_label_key: string;
  status: CrisisStatus;
  checklist: CrisisCncCheck[];
}

export interface CrisisCcii {
  overall_status: CrisisStatus;
  primary_triggers: string[];
  ateco: { code: string | null; section: string | null; sector_label_key: string | null };
  indicators: CrisisIndicator[];
  public_creditors: CrisisPublicCreditor[];
  cnc: CrisisCnc;
}

export interface CrisisPlanRow {
  month: string;
  inflows: string;
  outflows: string;
  net: string;
  closing_cash: string;
}

export interface CrisisArt725 {
  status: CrisisStatus;
  opening_cash: string;
  committed_credit_lines: string;
  min_cumulative_cash: string;
  min_month: string | null;
  first_negative_month: string | null;
  runway_months: number | null;
  coverage_6m: string | null;
  coverage_12m: string | null;
  plan: CrisisPlanRow[];
}

export interface CrisisArt725a {
  status: CrisisStatus;
  configured: boolean;
  net_assets: string;
  share_capital: string;
  statutory_reserves: string;
  protected_capital: string;
  required_net_assets: string;
  coverage_ratio: string | null;
  meter_percent: number;
  capital_loss: boolean;
}

export interface CrisisBalanceView {
  assets: string;
  liabilities: string;
  net: string;
  overindebted: boolean;
}

export interface CrisisArt725b {
  status: CrisisStatus;
  basis: CrisisBasis;
  going_concern: CrisisBalanceView;
  liquidation: CrisisBalanceView;
  shortfall: string;
  subordinated_covered: string;
  remaining_shortfall: string;
  overindebted: boolean;
  court_notification_required: boolean;
}

export interface CrisisRangruecktritt {
  basis: CrisisBasis;
  horizon_months: number;
  shortfall: string;
  active_claims_covered: string;
  remaining_shortfall: string;
  assumed_rate: string;
  required_claim_amount: string;
  required_principal_amount: string;
  court_notification_required: boolean;
}

export interface CrisisSwiss {
  overall_status: CrisisStatus;
  art725: CrisisArt725;
  art725a: CrisisArt725a;
  art725b: CrisisArt725b;
  subordination: CrisisRangruecktritt;
}

export interface CrisisDashboard {
  as_of: string;
  currency: string;
  jurisdiction: CrisisJurisdiction;
  overall_status: CrisisStatus;
  dscr: CrisisDscrApproaches;
  timeline: CrisisTimelineRow[];
  ccii: CrisisCcii;
  swiss: CrisisSwiss;
}

export interface CrisisTimelineResponse {
  horizon: number;
  approach: CrisisApproach;
  months: CrisisTimelineRow[];
  dscr: CrisisDscr;
}

export interface CrisisRequirementParams {
  horizon_months?: number;
  interest_rate?: string | number | null;
  basis?: CrisisBasis;
}

// --- Stress test ---

export interface CrisisStressInput {
  revenue_drop_percent: number;
  dso_delay_days: number;
  interest_rate_bps: number;
  one_off_outflow_amount: number;
}

export interface CrisisStressLite {
  dscr: CrisisDscrApproaches;
  liquidity: {
    min_cumulative_cash: string;
    first_negative_month: string | null;
    liquidity_gap: string;
  };
  capital: { net_assets: string; coverage_ratio: string | null; status: CrisisStatus };
  ccii_overall: CrisisStatus;
  swiss_overall: CrisisStatus;
}

export interface CrisisStressDeltas {
  dscr_treasury_m6: string | null;
  dscr_treasury_m12: string | null;
  dscr_operating_m6: string | null;
  dscr_operating_m12: string | null;
  min_cumulative_cash: string | null;
  coverage_ratio: string | null;
}

export interface CrisisStressResult {
  /** Echo of the applied shock (the API treats omitted levers as 0). */
  shock?: Partial<CrisisStressInput>;
  baseline: CrisisStressLite;
  stressed: CrisisStressLite;
  deltas: CrisisStressDeltas;
}

// --- Profile and metadata ---

export type CrisisLegalForm = 'corporation' | 'partnership' | 'sole_proprietorship';

export interface CrisisProfile {
  jurisdiction: CrisisJurisdiction;
  ateco_code: string | null;
  ateco_section: string | null;
  legal_form: CrisisLegalForm;
  employees_count: number;
  share_capital: string | null;
  statutory_reserves: string | null;
  legal_minimum_capital: string | null;
  prior_year_revenue: string | null;
  prior_year_inps_contributions: string | null;
  available_credit_lines: string | null;
  variable_debt_amount: string | null;
  total_assets_override: string | null;
  current_assets_override: string | null;
  current_liabilities_override: string | null;
  total_debt_override: string | null;
  net_equity_override: string | null;
  revenue_override: string | null;
  financial_expenses_override: string | null;
  cash_flow_override: string | null;
  tax_social_debt_override: string | null;
  payroll_overdue_30d_amount: string | null;
  supplier_overdue_90d_amount: string | null;
  inps_overdue_90d_amount: string | null;
  inail_overdue_90d_amount: string | null;
  vat_lipe_unpaid_amount: string | null;
  ader_entrusted_amount: string | null;
  assets_going_concern: string | null;
  assets_liquidation: string | null;
  total_liabilities_override: string | null;
  going_concern_probable: boolean;
}

/** Money keys of the profile (nullable decimal strings). */
export type CrisisProfileMoneyKey = Exclude<
  keyof CrisisProfile,
  | 'jurisdiction'
  | 'ateco_code'
  | 'ateco_section'
  | 'legal_form'
  | 'employees_count'
  | 'going_concern_probable'
>;

export interface CrisisMetadata {
  ateco_sections: { section: string; label_key: string }[];
  legal_forms: { code: CrisisLegalForm; label_key: string }[];
  jurisdictions: { code: CrisisJurisdiction; label_key: string }[];
  dscr_bands: { red_below: string; yellow_below: string };
}

// --- Subordinated loans (Rangruecktritt) ---

export type CrisisCreditorType = 'shareholder' | 'third_party';
export type CrisisInterestTreatment = 'deferred' | 'paid_current';
export type CrisisLoanScope = 'principal' | 'principal_and_interest';
export type CrisisLoanStatus = 'draft' | 'active' | 'released';

export interface CrisisLoanPayload {
  creditor_name: string;
  creditor_type: CrisisCreditorType;
  principal: string;
  interest_rate: string;
  interest_treatment: CrisisInterestTreatment;
  agreement_date: string;
  effective_from: string;
  deferral_end_date: string | null;
  scope: CrisisLoanScope;
  status: CrisisLoanStatus;
  notes: string | null;
}

export interface CrisisLoan extends CrisisLoanPayload {
  id: string;
  /** Read-only: claim at the horizon of the calculation. */
  claim_at_horizon: string;
  accrued_interest: string;
}
