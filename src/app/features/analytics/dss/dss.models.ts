/** Wire contract of `/api/v1/analytics/dss` (Issue #214: Executive DSS). Amounts are in the reporting currency of the filter. */

export type ReportingCurrency = 'CHF' | 'EUR';
export type PeriodPreset = 'MTD' | 'QTD' | 'YTD' | 'L12M' | 'CUSTOM';
export type ComparisonBaseline = 'PRIOR_PERIOD' | 'PRIOR_YEAR' | 'BUDGET';
export type ProfitabilityDimension =
  'customer' | 'product' | 'channel' | 'cost_center' | 'legal_entity';
export type DrillMetric =
  'revenue' | 'cogs' | 'opex' | 'depreciation' | 'cash' | 'receivable' | 'payable' | 'inventory';
export type DrillEntityType = 'customer' | 'cost_center' | 'legal_entity';
export type BoardPackFormat = 'pdf' | 'xlsx';

/** The global strategic filter shared by every view of the command center. */
export interface DssFilterState {
  legalEntityIds: string[];
  reportingCurrency: ReportingCurrency;
  periodPreset: PeriodPreset;
  /** `[from, to]` as `YYYY-MM-DD`, used when the preset is CUSTOM. */
  customDateRange: [string, string] | null;
  comparisonBaseline: ComparisonBaseline;
  costCenterIds: string[];
}

export type KpiGroup = 'financial' | 'customer' | 'efficiency';
export type KpiUnit = 'currency' | 'percent' | 'days' | 'ratio';

export interface BalancedScorecardKpi {
  key: string;
  group: KpiGroup;
  unit: KpiUnit;
  /** False while the source of the indicator has no data (the value is then null). */
  available: boolean;
  value: number | null;
  comparison_value: number | null;
  delta: number | null;
  delta_pct: number | null;
  /** Whether the change is an improvement; null without a comparison. */
  favorable: boolean | null;
  sparkline: number[];
  target: number | null;
}

export type AlertSeverity = 'CRITICAL' | 'WARNING' | 'INFO';
export type AlertCode =
  | 'margin_erosion'
  | 'dso_spike'
  | 'customer_concentration'
  | 'budget_overrun'
  | 'statistical_outlier';

export interface ExecutiveAlert {
  code: AlertCode;
  severity: AlertSeverity;
  metric: string;
  value: number;
  threshold: number;
  context: Record<string, unknown>;
}

export interface WorkingCapital {
  dso_days: number;
  dio_days: number;
  dpo_days: number;
  ccc_days: number;
  working_capital: number;
  working_capital_ratio: number | null;
  free_cash_flow: number;
  free_cash_flow_yield_pct: number | null;
  burn_rate_monthly: number;
  runway_months: number | null;
}

export interface DssOverviewResponse {
  meta: {
    currency: ReportingCurrency;
    period: { preset: PeriodPreset; from: string; to: string };
    comparison: {
      baseline: ComparisonBaseline;
      from: string;
      to: string;
      budget_found: boolean | null;
    };
    fx: { CHF_EUR: number | null; EUR_CHF: number | null; as_of: string };
    legal_entities: string[];
  };
  scorecard: Record<KpiGroup, BalancedScorecardKpi[]>;
  alerts: ExecutiveAlert[];
  working_capital: WorkingCapital;
  operations: {
    billable_hours: number;
    non_billable_hours: number;
    value_out: number;
    unit_cost_variance_value: number;
  };
}

export interface ProfitabilityMatrixRow {
  key: string;
  label: string;
  rank: number;
  gross_revenue: number;
  discounts: number;
  net_revenue: number;
  cogs: number;
  gross_margin: number;
  gross_margin_pct: number;
  contribution_margin_1: number;
  contribution_margin_2: number;
  ebitda: number;
  payment_delay_cost: number;
  net_operating_profit: number;
  net_margin_pct: number;
  in_pareto_core: boolean;
  is_value_destroying: boolean;
}

export interface WhaleCurvePoint {
  rank: number;
  key: string;
  label: string;
  net_operating_profit: number;
  cumulative_profit: number;
  cumulative_profit_pct: number;
  cumulative_revenue_pct: number;
  entity_pct: number;
}

export interface ProfitabilityMatrixResponse {
  dimension: ProfitabilityDimension;
  currency: ReportingCurrency;
  period: { from: string; to: string };
  rows: ProfitabilityMatrixRow[];
  whale_curve: WhaleCurvePoint[];
  totals: Record<string, number>;
  pareto_cutoff_rank: number;
  entity_count: number;
}

export type VarianceStepKey = 'baseline' | 'volume' | 'price' | 'cogs' | 'opex' | 'fx' | 'actual';

export interface VarianceBridgeStep {
  key: VarianceStepKey;
  type: 'total' | 'delta';
  value: number;
  cumulative: number;
}

export interface VarianceBridgeResponse {
  currency: ReportingCurrency;
  baseline: { type: ComparisonBaseline; from: string; to: string; budget_found: boolean | null };
  volume_basis: 'invoice_items' | 'unit_fallback';
  ebitda_bridge: VarianceBridgeStep[];
  revenue_bridge: VarianceBridgeStep[];
  summary: Record<string, number>;
  line_variances: Record<string, { delta: number; delta_pct: number | null }>;
}

/** The six sliders of the what-if simulator; percentages are whole numbers (5 = +5%). */
export interface WhatIfScenario {
  price_pct: number;
  cogs_pct: number;
  opex_pct: number;
  dso_days_delta: number;
  fx_shift_pct: number;
  fte_delta: number;
}

export interface WhatIfSimulationRequest {
  filter: DssFilterState;
  scenario: WhatIfScenario;
}

export interface WhatIfFigures {
  revenue: number;
  cogs: number;
  opex: number;
  ebitda: number;
  ebitda_margin_pct: number;
  net_cash_flow: number;
  break_even_revenue: number | null;
  break_even_headroom_pct: number | null;
}

export interface WhatIfSimulationResult {
  currency: ReportingCurrency;
  period: { from: string; to: string };
  inputs: Record<string, number>;
  scenario: WhatIfScenario;
  baseline: WhatIfFigures;
  simulated: WhatIfFigures;
  delta: {
    revenue: number;
    ebitda: number;
    ebitda_margin_pct: number;
    net_cash_flow: number;
    break_even_revenue: number | null;
  };
}

export interface DrillDownRecord {
  id: string;
  posting_date: string;
  account_code: string | null;
  category: string;
  counterparty: { id: string; name: string | null } | null;
  cost_center_id: string | null;
  legal_entity_id: string | null;
  transaction_currency: string;
  amount_transaction: number;
  amount_reporting: number | null;
  source: { type: string; id: string };
  links: { source: string; report_builder: string };
}

export interface DrillDownResponse {
  metric: DrillMetric;
  currency: ReportingCurrency;
  data: DrillDownRecord[];
  pagination: { page: number; per_page: number; total: number; last_page: number };
  total_amount: number;
  links: { kpi_dashboards: string; report_builder: string };
}

export interface DssLegalEntity {
  id: string;
  name: string;
  currency: string;
}

/** What a drill-down was opened for: a metric, optionally narrowed to one entity of a dimension. */
export interface DrillTarget {
  metric: DrillMetric;
  entityType: DrillEntityType | null;
  entityId: string | null;
  /** Shown as the title of the drawer. */
  label: string;
}
