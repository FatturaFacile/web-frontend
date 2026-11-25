/**
 * Cash flow forecasting and liquidity planning (Mod 017, issue #334): `/api/v1/liquidity-planning`.
 * Amounts are decimal strings, dates are `YYYY-MM-DD`.
 */

export interface LpEnvelope<T> {
  success?: boolean;
  message?: string;
  data: T;
}

export type LpTier = 'certain' | 'probable' | 'estimated';
export type LpJurisdiction = 'CH' | 'IT';
export type LpGranularity = 'daily' | 'weekly';
export type LpHorizonDays = 30 | 60 | 90 | 180;

export interface LpTierFlows {
  inflows: string;
  outflows: string;
}

export type LpTiers = Record<LpTier, LpTierFlows>;

export interface LpPoint {
  /** Day of the point; the first day of the week for the weekly series. */
  date: string;
  week_end?: string;
  inflows: string;
  outflows: string;
  net: string;
  closing: string;
  tiers: LpTiers;
}

export interface LpNegativeBalance {
  first_date: string;
  min_balance: string;
  min_date: string;
}

export interface LpProjection {
  daily: LpPoint[];
  weekly: LpPoint[];
  negative_balance: LpNegativeBalance | null;
}

export interface LpHorizonSummary {
  days: LpHorizonDays;
  until: string;
  inflows: string;
  outflows: string;
  net: string;
  closing_balance: string;
  min_balance: string;
  min_date: string;
  tiers: LpTiers;
}

export interface LpHorizon {
  days: LpHorizonDays;
  baseline: LpHorizonSummary;
  scenario: LpHorizonSummary | null;
}

export type LpDscrStatus = 'critical' | 'warning' | 'healthy' | 'not_applicable';
export type LpDscrLineKind = 'operating_inflow' | 'operating_outflow' | 'principal' | 'interest';

export interface LpDscrLine {
  date: string;
  kind: LpDscrLineKind;
  category: string;
  label_key: string | null;
  label: string | null;
  tier: LpTier;
  amount: string;
}

export interface LpDscr {
  value: string | null;
  status: LpDscrStatus;
  operating_cash_flow: string;
  debt_service: { principal: string; interest: string; total: string };
  thresholds: { critical: string; warning: string };
  horizon_days: number;
  lines: LpDscrLine[];
}

export type LpCapitalStatus = 'ok' | 'watch' | 'half_capital_lost' | 'below_legal_minimum';

export interface LpCapital {
  regime: 'CH_CO_725' | 'IT_CC_2446_2447';
  share_capital: string;
  legal_minimum: string;
  net_equity: string;
  half_capital: string;
  status: LpCapitalStatus;
  coverage_percent: string | null;
  source: string;
}

export type LpPfnStatus = 'ok' | 'watch' | 'breach' | 'not_applicable';

export interface LpPfn {
  financial_debt: string;
  cash: string;
  pfn: string;
  ebitda: string;
  pfn_ebitda: string | null;
  max_ratio: string;
  status: LpPfnStatus;
}

export interface LpLiquidity {
  minimum_balance: string;
  runway_days: number | null;
  first_negative_date: string | null;
  status: 'ok' | 'watch' | 'negative';
}

export interface LpIndicators {
  dscr: LpDscr;
  capital: LpCapital;
  pfn: LpPfn;
  liquidity: LpLiquidity;
}

export type LpAlertType =
  'negative_balance' | 'dscr_below_threshold' | 'capital_loss' | 'covenant_breach' | 'pfn_leverage';
export type LpAlertSeverity = 'info' | 'warning' | 'critical';
export type LpAlertStatus = 'open' | 'acknowledged' | 'resolved';

export interface LpAlert {
  id: string;
  type: LpAlertType;
  severity: LpAlertSeverity;
  status: LpAlertStatus;
  title_key: string;
  message_key: string;
  params: Record<string, string | number>;
  detected_at: string;
  acknowledged_at: string | null;
  resolved_at: string | null;
  last_notified_at: string | null;
}

export interface LpLevers {
  collection_delay_days?: number;
  collection_delay_share_percent?: number;
  inflow_change_percent?: number;
  outflow_change_percent?: number;
  raw_material_increase_percent?: number;
  capex_acceleration_days?: number;
  capex_change_percent?: number;
  additional_financing_amount?: number | string;
  additional_financing_date?: string;
}

export type LpLeverKey = keyof LpLevers;

export interface LpAccount {
  id: string;
  bank_name: string;
  iban: string | null;
  currency: string;
  balance: string;
}

export interface LpScenarioInfo {
  id: string | null;
  name: string | null;
  levers: LpLevers;
}

export interface LpOverview {
  as_of: string;
  currency: string;
  jurisdiction: LpJurisdiction;
  opening_cash: string;
  accounts: LpAccount[];
  baseline: LpProjection;
  scenario: LpProjection | null;
  scenario_info: LpScenarioInfo | null;
  horizons: LpHorizon[];
  indicators: { baseline: LpIndicators; scenario: LpIndicators | null };
  alerts: LpAlert[];
}

export interface LpOverviewParams {
  scenario_id?: string | null;
  levers?: LpLevers;
  as_of?: string;
}

export interface LpPreset {
  code: string;
  name_key: string;
  description_key: string;
  levers: LpLevers;
}

export interface LpScenario {
  id: string;
  name: string;
  description: string | null;
  levers: LpLevers;
  created_at?: string;
}

export interface LpScenarioPayload {
  name: string;
  description?: string | null;
  levers: LpLevers;
}

export type LpItemCategory =
  | 'receivable'
  | 'payable'
  | 'sales_order'
  | 'purchase_order'
  | 'recurring_contract'
  | 'lease'
  | 'payroll'
  | 'tax'
  | 'capex'
  | 'debt_principal'
  | 'debt_interest'
  | 'other';
export type LpFrequency = 'once' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
export type LpDirection = 'inflow' | 'outflow';

export interface LpManualItem {
  id: string;
  label: string;
  tier: LpTier;
  category: LpItemCategory;
  direction: LpDirection;
  amount: string;
  currency: string;
  first_date: string;
  frequency: LpFrequency;
  end_date: string | null;
  is_active: boolean;
  notes: string | null;
}

export type LpManualItemPayload = Omit<LpManualItem, 'id'>;

export interface LpSettings {
  jurisdiction: LpJurisdiction;
  share_capital: string;
  legal_minimum_capital: string;
  minimum_liquidity: string;
  dscr_critical_threshold: string;
  dscr_warning_threshold: string;
  max_pfn_ebitda: string;
  ebitda_override: string | null;
  net_equity_override: string | null;
  alert_cooldown_hours: number;
  notify_emails: string[];
  email_alerts_enabled: boolean;
  collection_behavior_days: number;
  payroll_monthly_override: string | null;
  payroll_pay_day: number;
  tax_monthly_estimate: string | null;
}

export type LpEbaStatus = 'ok' | 'watch' | 'critical';

export interface LpEbaSection {
  key: string;
  title_key: string;
  status: LpEbaStatus;
  summary_key: string;
  params: Record<string, string | number>;
}

export interface LpReport {
  generated_at: string;
  company: { name: string; tax_id: string | null };
  as_of: string;
  currency: string;
  jurisdiction: LpJurisdiction;
  overview: LpOverview;
  eba: { sections: LpEbaSection[] };
}

export type LpExportFormat = 'pdf' | 'xlsx';
