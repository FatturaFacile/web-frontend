/** Wire types of `/api/v1/projects/{id}/evm` and `/api/v1/projects/evm` (Mod 082: profitability and earned value). */

export type TrafficLight = 'green' | 'amber' | 'red';

export type OverheadDriver = 'labor_hours' | 'direct_cost' | 'custom_weights';

export type EvmGranularity = 'day' | 'week' | 'month';

export type CostSourceKey =
  | 'TimesheetLabor'
  | 'EmployeeExpense'
  | 'VendorInvoice'
  | 'WarehouseMaterialIssue'
  | 'OverheadAllocation'
  | 'Adjustment';

export interface Envelope<T, M = never> {
  data: T;
  meta?: M;
}

export interface Reconciliation {
  standard: string | null;
  valuation_method: string | null;
  managerial_actual_cost: string;
  statutory_cumulative_revenue: string;
  statutory_cumulative_cost: string;
  cost_difference: string | null;
  cost_center_overhead: string;
  last_recognition_date: string | null;
  is_reconciled: boolean;
}

/** A stored financial snapshot of the project (or of a WBS node). Amounts are decimal strings. */
export interface FinancialSnapshot {
  id: string;
  project_id: string;
  wbs_node_id: string | null;
  snapshot_date: string;
  currency_code: string;
  budget_at_completion_bac: string;
  planned_value_pv: string;
  earned_value_ev: string;
  actual_cost_ac: string;
  committed_cost: string;
  cost_variance_cv: string;
  schedule_variance_sv: string;
  cost_performance_index_cpi: string | null;
  schedule_performance_index_spi: string | null;
  cpi_light: TrafficLight;
  spi_light: TrafficLight;
  estimate_at_completion_eac: string;
  estimate_to_complete_etc: string;
  variance_at_completion_vac: string;
  budget_absorption_percent: string | null;
  recognized_revenue: string;
  gross_margin_amount: string;
  gross_margin_percent: string | null;
  manual_etc_override: string | null;
  snapshot_trigger: string;
  calculation_version: string;
  reconciliation: Reconciliation | null;
}

/** The figures of one row of the WBS breakdown (the project row or a node). */
export interface BreakdownRow {
  has_snapshot: boolean;
  bac?: string;
  committed?: string;
  actual?: string;
  total_exposure?: string;
  pv?: string;
  ev?: string;
  cv?: string;
  sv?: string;
  cpi?: string | null;
  spi?: string | null;
  cpi_light?: TrafficLight;
  spi_light?: TrafficLight;
  eac?: string;
  etc?: string;
  vac?: string;
  budget_absorption_percent?: string | null;
  recognized_revenue?: string;
  gross_margin_amount?: string;
  gross_margin_percent?: string | null;
  manual_etc_override?: string | null;
}

export interface WbsNode extends BreakdownRow {
  wbs_node_id: string;
  wbs_code: string;
  title: string;
  children: WbsNode[];
}

export interface WbsBreakdown {
  project_id: string;
  currency: string | null;
  snapshot_date: string | null;
  project: BreakdownRow;
  reconciliation: Reconciliation | null;
  nodes: WbsNode[];
}

export interface WaterfallStep {
  key: string;
  amount: string;
  running_total: string;
  kind: 'total' | 'delta';
}

export interface Waterfall {
  project_id: string;
  currency: string | null;
  snapshot_date: string | null;
  recognized_revenue: string;
  total_cost: string;
  gross_margin_amount: string;
  gross_margin_percent: string | null;
  steps: WaterfallStep[];
  variance_bridge: {
    budget_at_completion: string;
    estimate_at_completion: string;
    variance_at_completion: string;
    committed_cost: string;
  };
}

export interface ScurvePoint {
  date: string;
  pv: string;
  ev: string;
  ac: string;
}

export interface Scurve {
  granularity: EvmGranularity;
  currency: string | null;
  budget_at_completion?: string;
  points: ScurvePoint[];
  forecast: { date: string; eac: string }[];
}

export interface ScurveFilters {
  projectIds?: string[];
  granularity: EvmGranularity;
  from?: string;
  to?: string;
}

export interface OverheadAllocationPayload {
  run_key: string;
  cost_center_id: string;
  pool_amount: number;
  period_start: string;
  period_end: string;
  driver: OverheadDriver;
  weights?: Record<string, number>;
  project_ids?: string[];
}

export interface OverheadAllocationResult {
  run_key: string;
  driver: OverheadDriver;
  pool_amount: string;
  allocated_amount: string;
  allocations: { project_id: string; share_percent: string; amount: string }[];
}

export interface ManualEtcPayload {
  wbs_node_id: string | null;
  estimate_to_complete: number | null;
  reason?: string | null;
}
