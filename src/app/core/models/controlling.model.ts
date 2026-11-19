/** Controlling and corporate performance management (cost accounting, margins, working capital, budgets). */

export const MARGIN_DIMENSIONS = ['product', 'product_family', 'customer', 'geography', 'agent', 'production_department', 'cost_center', 'job'] as const;
export type MarginDimension = (typeof MARGIN_DIMENSIONS)[number];

export const MARGIN_TIERS = ['gross', 'commercial', 'full_industrial'] as const;
export type MarginTier = (typeof MARGIN_TIERS)[number];

export const COMPARE_MODES = ['none', 'prior_period', 'prior_year', 'active_budget', 'rolling_forecast'] as const;
export type CompareMode = (typeof COMPARE_MODES)[number];

export type AbcClass = 'A' | 'B' | 'C';

export interface ControllingResponse<T> {
  data: T;
}

export interface MarginMetrics {
  quantity: string;
  gross_revenue: string;
  discounts: string;
  credit_notes: string;
  net_revenue: string;
  direct_cogs: string;
  allocated_overheads: string;
  commissions: string;
  logistics: string;
  gross_margin: string;
  gross_margin_percent: string;
  commercial_margin: string;
  full_industrial_margin: string;
  margin: string;
  margin_percent: string;
  credit_note_incidence_percent: string;
  average_selling_price: string;
  unit_cost: string;
  unit_margin: string;
}

export interface MetricDelta {
  delta: string;
  delta_percent: string;
}

export type MarginDeltas = Record<string, MetricDelta>;

export interface MarginSummary {
  date_from: string;
  date_to: string;
  margin_tier: MarginTier;
  compare_mode: CompareMode;
  totals: MarginMetrics;
  baseline: MarginMetrics | null;
  deltas: MarginDeltas | null;
}

export interface MarginRow {
  key: string;
  label: string;
  dimension: MarginDimension;
  metrics: MarginMetrics;
  cumulative_share: string;
  abc_class: AbcClass;
  baseline?: MarginMetrics | null;
  deltas?: MarginDeltas | null;
}

export interface DrillStep {
  dimension: MarginDimension;
  value: string;
}

export interface MarginExplore {
  group_by: MarginDimension;
  margin_tier: MarginTier;
  drill_path: DrillStep[];
  next_dimensions: MarginDimension[];
  totals: MarginMetrics;
  data: MarginRow[];
  meta: { total: number; page: number; per_page: number; last_page: number };
}

export interface MarginMatrix {
  row_dimension: MarginDimension;
  col_dimension: MarginDimension;
  measure: string;
  rows: { key: string; label: string }[];
  columns: { key: string; label: string }[];
  cells: { row: string; col: string; value: string }[];
}

export interface MarginPareto {
  class_counts: Record<AbcClass, number>;
  curve: { key: string; label: string; net_revenue: string; cumulative_share: string; abc_class: AbcClass }[];
  outliers: { key: string; label: string; net_revenue: string; margin: string; margin_percent: string }[];
}

export interface MarginQuery {
  date_from?: string;
  date_to?: string;
  margin_tier?: MarginTier;
  compare_mode?: CompareMode;
  group_by?: MarginDimension;
  row_dimension?: MarginDimension;
  col_dimension?: MarginDimension;
  drill_path?: DrillStep[];
  sort?: string;
  direction?: 'asc' | 'desc';
  page?: number;
  per_page?: number;
  cost_center_id?: string;
  job_id?: string;
  product_family_id?: string;
  customer_id?: string;
  country_code?: string;
  sales_agent_id?: string;
  production_department_id?: string;
}

export interface FinancialPoint {
  snapshot_date: string;
  days_in_period: number;
  accounts_receivable: string;
  accounts_payable: string;
  inventory: string;
  cash: string;
  overdue_receivables_percent: string;
  dso: string;
  dpo: string;
  dio: string;
  inventory_turnover: string;
  ccn: string;
  ccc: string;
  warnings: string[];
}

export interface FinancialKpis {
  as_of: string | null;
  current: FinancialPoint | null;
  previous: FinancialPoint | null;
  deltas: Record<string, string> | null;
  countback_dso: string | null;
  history: FinancialPoint[];
  formulas: Record<string, string>;
}

export interface CostCenterNode {
  id: string;
  code: string;
  name: string;
  center_type: string;
  parent_id: string | null;
  own: CostCenterFigures;
  rollup: CostCenterFigures;
  children: CostCenterNode[];
}

export interface CostCenterFigures {
  revenue: string;
  direct_costs: string;
  allocations_in: string;
  allocations_out: string;
  net_result: string;
}

export interface AnalyticalJob {
  id: string;
  code: string;
  name: string;
  status: string;
  contract_value: string;
  estimated_cost_budget: string;
}

export interface JobPnl {
  job_id: string;
  code: string;
  name: string;
  contract_value: string;
  invoiced_to_date: string;
  direct_material: string;
  direct_labor: string;
  allocated_overheads: string;
  actual_cost: string;
  estimated_cost_budget: string;
  cost_consumed_percent: string;
  open_commitments: string;
  actual_margin: string;
  estimated_margin: string;
  projected_final_margin: string;
  completion_percent: string;
}

export interface AllocationTransfer {
  rule_id: string;
  step_order: number;
  source_cost_center_id: string;
  recipient_type: 'cost_center' | 'job';
  recipient_id: string;
  driver_type: string;
  driver_weight: string;
  amount: string;
}

export interface AllocationPreview {
  transfers: AllocationTransfer[];
  skipped: { rule_id: string; reason: string }[];
  total_allocated: string;
}

export interface AllocationRun {
  id: string;
  fiscal_year: number;
  fiscal_month: number;
  status: 'draft' | 'posted' | 'reversed';
  total_allocated_amount: string;
  executed_at: string | null;
}

export interface AllocationRule {
  id: string;
  name: string;
  source_cost_center_id: string;
  driver_type: string;
  step_order: number;
}

export const BUDGET_PLAN_STATUSES = ['draft', 'submitted', 'approved', 'locked', 'archived'] as const;
export type BudgetPlanStatus = (typeof BUDGET_PLAN_STATUSES)[number];
export type BudgetPlanType = 'annual_budget' | 'rolling_forecast' | 'what_if_scenario';

export interface BudgetPlanLine {
  id: string;
  nature_type: string;
  cost_center_id: string | null;
  job_id: string | null;
  product_family_id: string | null;
  annual_total: string;
  target_quantity: string;
  distribution_driver: string;
  [month: `month_${string}`]: string;
}

export interface BudgetPlan {
  id: string;
  code: string;
  name: string;
  fiscal_year: number;
  plan_type: BudgetPlanType;
  version_number: number;
  parent_plan_id: string | null;
  cutoff_month: number | null;
  status: BudgetPlanStatus;
  currency_code: string;
  lines_count?: number;
  lines?: BudgetPlanLine[];
}

export interface VarianceTotals {
  revenue: string;
  cost: string;
  margin: string;
}

export interface VarianceRow {
  key: string;
  label: string;
  actual: VarianceTotals;
  budget: VarianceTotals;
  forecast: VarianceTotals;
  prior_year: VarianceTotals;
  eac: VarianceTotals;
  variance: string;
  variance_percent: string;
  favorable: boolean;
}

export interface VarianceReport {
  group_by: string;
  period_mode: string;
  data: VarianceRow[];
  totals: { actual_margin: string; budget_margin: string; forecast_margin: string; prior_year_margin: string; eac_margin: string };
}

export interface WaterfallStep {
  key: string;
  label: string;
  value: string;
  type: 'total' | 'delta';
  favorable?: boolean;
}

export interface VarianceQuery {
  budget_id?: string;
  forecast_id?: string;
  group_by?: string;
  period_mode?: 'monthly' | 'ytd' | 'full_year_eac';
  month?: number;
}
