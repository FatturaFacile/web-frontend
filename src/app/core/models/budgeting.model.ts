/** Planning and budgeting (controlling). Mirrors the API FormRequests of the Budgeting module. */

export type BudgetVersionType = 'budget' | 'revised' | 'forecast' | 'rolling_forecast' | 'scenario';
export type BudgetScenarioKind = 'best_case' | 'worst_case' | 'custom';
export type BudgetGranularity = 'monthly' | 'quarterly';
export type BudgetTrafficLight = 'green' | 'amber' | 'red';
export type BudgetVersionStatus = 'draft' | 'submitted' | 'approved' | 'locked';
export type BudgetSpreadMethod = 'even' | 'seasonal' | 'percentage';
export type BudgetLineSource = 'manual' | 'driver' | 'spread' | 'reforecast' | 'actual';
export type BudgetApprovalAction = 'submit' | 'approve' | 'reject' | 'lock';
export type BudgetReforecastMode = 'keep_annual_target' | 'keep_remaining';
export type BudgetVarianceGroup = 'account' | 'cost_center' | 'project' | 'period';

export const BUDGET_VERSION_TYPES: readonly BudgetVersionType[] = ['budget', 'revised', 'forecast', 'rolling_forecast', 'scenario'];
export const BUDGET_SCENARIO_KINDS: readonly BudgetScenarioKind[] = ['best_case', 'worst_case', 'custom'];
export const BUDGET_GRANULARITIES: readonly BudgetGranularity[] = ['monthly', 'quarterly'];
export const BUDGET_VERSION_STATUSES: readonly BudgetVersionStatus[] = ['draft', 'submitted', 'approved', 'locked'];
export const BUDGET_SPREAD_METHODS: readonly BudgetSpreadMethod[] = ['even', 'seasonal', 'percentage'];
export const BUDGET_REFORECAST_MODES: readonly BudgetReforecastMode[] = ['keep_annual_target', 'keep_remaining'];
export const BUDGET_VARIANCE_GROUPS: readonly BudgetVarianceGroup[] = ['account', 'cost_center', 'project', 'period'];

export interface BudgetingResponse<T> {
  data: T;
  message?: string;
}

export interface BudgetApproval {
  id: string;
  version_id: string;
  action: BudgetApprovalAction;
  from_status: BudgetVersionStatus;
  to_status: BudgetVersionStatus;
  user_id: string | null;
  comment: string | null;
  created_at: string;
}

export interface BudgetVersion {
  id: string;
  name: string;
  description: string | null;
  fiscal_year: number;
  year_start: string;
  version_type: BudgetVersionType;
  scenario_kind?: BudgetScenarioKind | null;
  granularity?: BudgetGranularity;
  revision_number?: number;
  revision_reason?: string | null;
  rolling_horizon_months?: number | null;
  is_formal?: boolean;
  status: BudgetVersionStatus;
  currency: string;
  base_version_id: string | null;
  reforecast_from_period: number | null;
  seasonal_weights: string[] | null;
  submitted_by: string | null;
  submitted_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  locked_by: string | null;
  locked_at: string | null;
  lines_count?: number;
  drivers_count?: number;
  total_amount?: string;
  approvals?: BudgetApproval[];
}

export interface BudgetVersionRequest {
  name: string;
  description: string | null;
  fiscal_year: number;
  year_start: string | null;
  version_type: BudgetVersionType;
  scenario_kind?: BudgetScenarioKind | null;
  granularity?: BudgetGranularity;
  currency: string;
  seasonal_weights: number[] | null;
}

export interface BudgetVersionCopyRequest {
  name: string;
  description?: string | null;
  version_type?: 'budget' | 'forecast';
}

export interface BudgetReforecastRequest {
  name: string;
  description?: string | null;
  from_period: number;
  mode?: BudgetReforecastMode;
  adjustment_percent?: number | null;
}

export interface BudgetApprovalRequest {
  comment?: string | null;
}

export interface BudgetPlanLine {
  id: string;
  version_id: string;
  account_id: string;
  cost_center_id: string | null;
  project_id: string | null;
  period: number;
  amount: string;
  quantity?: string | null;
  unit_price?: string | null;
  source: BudgetLineSource;
  driver_id: string | null;
  notes: string | null;
}

export interface BudgetLineRequest {
  account_id: string;
  cost_center_id: string | null;
  project_id: string | null;
  period: number;
  amount: string;
  notes: string | null;
}

export interface BudgetSpreadRequest {
  account_id: string;
  cost_center_id: string | null;
  project_id: string | null;
  total_amount: string;
  method: BudgetSpreadMethod;
  start_period: number;
  end_period: number;
  percentages: number[] | null;
  notes: string | null;
}

export interface BudgetDriver {
  id: string;
  version_id: string;
  name: string;
  account_id: string;
  cost_center_id: string | null;
  project_id: string | null;
  quantity: string;
  rate: string;
  total_amount: string;
  spread_method: BudgetSpreadMethod;
  percentages: string[] | null;
  start_period: number;
  end_period: number;
  is_active: boolean;
}

export interface BudgetDriverRequest {
  name: string;
  account_id: string;
  cost_center_id: string | null;
  project_id: string | null;
  quantity: string;
  rate: string;
  spread_method: BudgetSpreadMethod;
  percentages: number[] | null;
  start_period: number;
  end_period: number;
  is_active: boolean;
}

export interface BudgetVarianceRow {
  key: string;
  label: string;
  code: string | null;
  budget: string;
  actual: string;
  variance: string;
  variance_percent: string | null;
  is_favorable: boolean;
  status: 'over' | 'under' | 'on_budget';
  traffic_light?: BudgetTrafficLight;
}

export interface BudgetVariance {
  version_id: string;
  through_period: number;
  group_by: BudgetVarianceGroup;
  rows: BudgetVarianceRow[];
  thresholds?: { amber: string; red: string };
  totals: { budget: string; actual: string; variance: string; variance_percent: string | null; adverse: string; favorable: string };
}

export interface BudgetingDashboard {
  versions: { total: number; by_status: Record<BudgetVersionStatus, number>; by_type: Partial<Record<BudgetVersionType, number>> };
  pending_approval: { id: string; name: string; fiscal_year: number; submitted_at: string | null }[];
  selected_version: { id: string; name: string; fiscal_year: number; status: BudgetVersionStatus; version_type: BudgetVersionType; currency: string } | null;
  through_period: number;
  totals: { annual_budget: string; budget: string; actual: string; variance: string; variance_percent: string | null; consumption_percent: string } | null;
  series: { period: number; month: string; budget: string; actual: string | null; cumulative_budget: string; cumulative_actual: string | null }[];
  top_overruns: BudgetVarianceRow[];
  drivers_count: number;
}

export interface BudgetVersionFilters {
  fiscal_year?: number;
  status?: BudgetVersionStatus;
  version_type?: BudgetVersionType;
  per_page?: number;
}

export interface BudgetScenarioRow {
  key: string;
  label: string;
  code: string | null;
  base: string;
  scenario: string;
  delta: string;
  delta_percent: string | null;
}

/** Budget of a version (base) against another version (scenario): `delta` is scenario minus base. */
export interface BudgetScenarioComparison {
  base_version_id: string;
  scenario_version_id: string;
  through_period: number;
  group_by: BudgetVarianceGroup;
  rows: BudgetScenarioRow[];
  totals: { base: string; scenario: string; delta: string; delta_percent: string | null };
}
