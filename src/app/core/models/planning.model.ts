/** Sales and operations planning (S&OP). Mirrors the API FormRequests of the Planning module. */

export type PlanningScenarioType = 'baseline' | 'what_if';
export type PlanningScenarioStatus = 'draft' | 'review' | 'approved' | 'locked';
export type PlanningLineType = 'demand' | 'supply';
export type PlanningLineSource = 'manual' | 'forecast' | 'copied';
export type PlanningApprovalAction = 'submit' | 'approve' | 'reject' | 'lock' | 'publish';

export const PLANNING_SCENARIO_TYPES: readonly PlanningScenarioType[] = ['baseline', 'what_if'];
export const PLANNING_SCENARIO_STATUSES: readonly PlanningScenarioStatus[] = ['draft', 'review', 'approved', 'locked'];
export const PLANNING_LINE_TYPES: readonly PlanningLineType[] = ['demand', 'supply'];

export interface PlanningResponse<T> {
  data: T;
  message?: string;
}

export interface PlanningApproval {
  id: string;
  scenario_id: string;
  action: PlanningApprovalAction;
  from_status: PlanningScenarioStatus;
  to_status: PlanningScenarioStatus;
  user_id: string | null;
  comment: string | null;
  created_at: string;
}

export interface PlanningScenario {
  id: string;
  name: string;
  description: string | null;
  scenario_type: PlanningScenarioType;
  base_scenario_id: string | null;
  status: PlanningScenarioStatus;
  horizon_start: string;
  horizon_end: string;
  submitted_by: string | null;
  submitted_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  locked_by: string | null;
  locked_at: string | null;
  published_version: number;
  published_at: string | null;
  lines_count?: number;
  approvals?: PlanningApproval[];
}

export interface PlanningScenarioRequest {
  name: string;
  description: string | null;
  scenario_type: PlanningScenarioType;
  horizon_start: string;
  horizon_end: string;
}

export interface PlanningScenarioCopyRequest {
  name: string;
  description?: string | null;
  demand_adjustment_percent?: number | null;
  supply_adjustment_percent?: number | null;
}

export interface PlanningCycleRequest {
  comment?: string | null;
  accept_overload?: boolean;
}

export interface PlanningLine {
  id: string;
  scenario_id: string;
  line_type: PlanningLineType;
  item_id: string | null;
  item_code: string;
  item_name: string | null;
  period: string;
  quantity: string;
  source: PlanningLineSource;
  notes: string | null;
}

export interface PlanningLineRequest {
  line_type: PlanningLineType;
  item_id?: string | null;
  item_code: string | null;
  item_name: string | null;
  period: string;
  quantity: string;
  notes: string | null;
}

export interface PlanningImportResult {
  created: number;
  updated: number;
  skipped: number;
}

export interface PlanningRate {
  id: string;
  resource_id: string;
  item_code: string;
  load_per_unit: string;
}

export interface PlanningResource {
  id: string;
  code: string;
  name: string;
  work_center_id: string | null;
  unit: string;
  default_capacity: string;
  is_active: boolean;
  rates?: PlanningRate[];
}

export interface PlanningResourceRequest {
  code: string;
  name: string;
  work_center_id: string | null;
  unit: string;
  default_capacity: string;
  is_active: boolean;
}

export interface PlanningRateRequest {
  item_code: string;
  load_per_unit: string;
}

export interface PlanningConstraint {
  id: string;
  scenario_id: string;
  resource_id: string;
  resource_code: string | null;
  period: string;
  available_capacity: string;
  notes: string | null;
}

export interface PlanningConstraintRequest {
  resource_id: string;
  period: string;
  available_capacity: string;
  notes: string | null;
}

export interface PlanningPublication {
  id: string;
  scenario_id: string;
  version: number;
  is_current: boolean;
  snapshot: Record<string, unknown>;
  published_by: string | null;
  published_at: string;
}

export type PlanningBalanceStatus = 'shortage' | 'balanced' | 'surplus';

export interface PlanningBalancePeriod {
  period: string;
  demand: string;
  supply: string;
  gap: string;
  balance: string;
  status: PlanningBalanceStatus;
}

export interface PlanningBalanceItem {
  item_code: string;
  item_name: string | null;
  total_demand: string;
  total_supply: string;
  total_gap: string;
  ending_gap: string;
  max_shortage: string;
  shortage_periods: number;
  periods: PlanningBalancePeriod[];
}

export interface PlanningBalanceTotals {
  total_demand: string;
  total_supply: string;
  total_gap: string;
  shortage_items: number;
  surplus_items: number;
  max_shortage: string;
}

export interface PlanningBalance {
  scenario_id: string;
  carry_over: boolean;
  periods: string[];
  items: PlanningBalanceItem[];
  totals: PlanningBalanceTotals;
}

export interface PlanningCapacityRow {
  resource_id: string;
  resource_code: string;
  resource_name: string;
  unit: string;
  period: string;
  load: string;
  available: string;
  source: 'constraint' | 'default';
  utilization_percent: string | null;
  overload: string;
  is_overloaded: boolean;
}

export interface PlanningCapacitySummary {
  feasible: boolean;
  overloaded_count: number;
  max_utilization_percent: string | null;
  resources: number;
}

export interface PlanningCapacity {
  scenario_id: string;
  periods: string[];
  rows: PlanningCapacityRow[];
  summary: PlanningCapacitySummary;
}

export interface PlanningComparisonSide {
  id: string;
  name: string;
  status: PlanningScenarioStatus;
  totals: PlanningBalanceTotals;
  capacity: PlanningCapacitySummary;
}

export interface PlanningComparisonItem {
  item_code: string;
  item_name: string | null;
  base: { total_demand: string; total_supply: string; total_gap: string; max_shortage: string };
  other: { total_demand: string; total_supply: string; total_gap: string; max_shortage: string };
  delta: { total_demand: string; total_supply: string; total_gap: string; max_shortage: string };
}

export interface PlanningComparison {
  base: PlanningComparisonSide;
  other: PlanningComparisonSide;
  delta: { total_demand: string; total_supply: string; total_gap: string; overloaded_periods: number };
  items: PlanningComparisonItem[];
}

export interface PlanningDashboardGap {
  item_code: string;
  item_name: string | null;
  total_gap: string;
  ending_gap: string;
  max_shortage: string;
  shortage_periods: number;
}

export interface PlanningDashboardResource {
  resource_id: string;
  resource_code: string;
  resource_name: string;
  unit: string;
  peak_utilization_percent: string | null;
  overloaded_periods: number;
  periods: { period: string; load: string; available: string; utilization_percent: string | null; is_overloaded: boolean }[];
}

export interface PlanningDashboard {
  scenarios: { total: number; by_status: Record<PlanningScenarioStatus, number> };
  pending_approval: { id: string; name: string; submitted_at: string | null }[];
  current_publication: { version: number; scenario_id: string; published_at: string } | null;
  selected_scenario: { id: string; name: string; status: PlanningScenarioStatus; scenario_type: PlanningScenarioType } | null;
  totals: PlanningBalanceTotals | null;
  top_gaps: PlanningDashboardGap[];
  capacity: { summary: PlanningCapacitySummary; resources: PlanningDashboardResource[] };
}

export interface PlanningScenarioFilters {
  status?: PlanningScenarioStatus;
  scenario_type?: PlanningScenarioType;
  per_page?: number;
}
