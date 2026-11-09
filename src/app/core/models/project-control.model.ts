/** Project controlling: budgets, milestones, change orders, costs, expenses, billing, revenue recognition, forecast, planning, resources. */

export interface ProjectBudgetCategoryRow {
  category: string;
  budget: string;
  committed: string;
  actual: string;
  available: string;
  consumed_percentage: string | null;
}

export interface ProjectBudgetCategoryReport {
  categories: ProjectBudgetCategoryRow[];
  totals: Omit<ProjectBudgetCategoryRow, 'category'>;
}

export interface ProjectBudgetLine {
  id: string;
  project_phase_id: string | null;
  cost_category: string;
  description: string;
  planned_quantity: string;
  planned_unit_cost: string;
  planned_total_cost: string;
  planned_revenue_amount: string;
}

export interface ProjectBudgetVersion {
  version_number: number;
  revision_reason: string | null;
  total_cost_budget: string;
  total_revenue_budget: string;
  is_baseline: boolean;
  approved_by: string | null;
  created_at: string | null;
}

export interface ProjectBudget {
  id: string;
  project_id: string;
  status: string;
  current_version_number: number;
  total_revenue_budget: string;
  total_cost_budget: string;
  categories: Record<string, unknown>;
  projected_margin_amount: string;
  projected_margin_percentage: string;
  approved_by: string | null;
  approved_at: string | null;
  lines?: ProjectBudgetLine[];
  versions?: ProjectBudgetVersion[];
  category_report?: ProjectBudgetCategoryReport;
}

export interface ProjectBudgetPayload {
  total_revenue_budget: number;
  labour_budget?: number | null;
  material_budget?: number | null;
  supplier_budget?: number | null;
  fleet_budget?: number | null;
  expense_budget?: number | null;
  contingency_budget?: number | null;
  revision_reason?: string | null;
}

export interface ProjectMilestone {
  id: string;
  project_id: string;
  project_phase_id: string | null;
  name: string;
  milestone_date: string;
  billing_percentage: string;
  billing_amount: string;
  is_completed: boolean;
  completed_at: string | null;
  is_billed: boolean;
  invoice_id: string | null;
}

export interface ProjectMilestonePayload {
  name?: string;
  milestone_date?: string;
  project_phase_id?: string | null;
  billing_amount?: number;
  billing_percentage?: number;
}

export interface ProjectChangeOrder {
  id: string;
  project_id: string;
  order_number: string;
  title: string;
  scope_description: string;
  cost_impact_amount: string;
  revenue_impact_amount: string;
  schedule_impact_days: number;
  status: string;
  approved_at: string | null;
  rejection_reason: string | null;
}

export interface ProjectChangeOrderPayload {
  order_number: string;
  title: string;
  scope_description: string;
  cost_impact_amount: number;
  revenue_impact_amount?: number | null;
  schedule_impact_days?: number | null;
}

export type ProjectCostCategory = 'labour' | 'material' | 'supplier' | 'fleet' | 'expense' | 'equipment';

export type ProjectExpenseCategory =
  | 'travel_lodging'
  | 'meals_subsistence'
  | 'licensing_permits'
  | 'site_rentals'
  | 'laboratory_testing'
  | 'expense'
  | 'subcontractor'
  | 'equipment';

export interface ProjectCostEntry {
  id: string;
  project_id: string;
  project_phase_id: string | null;
  project_task_id: string | null;
  cost_source_type: string;
  cost_source_id: string;
  cost_category: string;
  description: string | null;
  quantity: string;
  uom: string;
  unit_cost: string;
  total_cost: string;
  is_billable: boolean;
  invoice_id: string | null;
  incurred_date: string;
  approval_status: string;
  rejection_reason: string | null;
}

export interface ProjectCostPayload {
  cost_category: ProjectCostCategory;
  cost_source_type: string;
  cost_source_id: string;
  description?: string | null;
  quantity: number;
  unit_cost: number;
  total_cost?: number | null;
  incurred_date: string;
  phase_id?: string | null;
  task_id?: string | null;
  uom?: string | null;
  is_billable?: boolean | null;
}

export interface ProjectExpensePayload {
  expense_category: ProjectExpenseCategory;
  description: string;
  amount: number;
  incurred_date: string;
  phase_id?: string | null;
  task_id?: string | null;
  receipt_document_id?: string | null;
  is_billable?: boolean | null;
}

export interface ProjectBillingInvoice {
  id: string;
  invoice_number: string | null;
  status: string | null;
  project_id: string | null;
  contact_id: string | null;
  total_net: string;
  total_tax: string;
  total_gross: string;
}

export interface ProjectRevenueRecognition {
  id: string;
  project_id: string;
  accounting_period_date: string;
  recognition_method: string | null;
  contract_value: string;
  cumulative_actual_cost: string;
  estimated_total_cost: string;
  completion_percentage: string;
  cumulative_recognized_revenue: string;
  period_revenue: string;
  cumulative_billed_revenue: string;
  contract_asset_balance: string;
  period_contract_asset_adjustment: string;
  cumulative_cost_of_revenue: string;
  period_cost_of_revenue: string;
  is_posted_to_gl: boolean;
}

export interface ProjectProfitability {
  project_id: string;
  project_number: string;
  currency: string;
  revenue_recognition_method: string | null;
  contract_value: string;
  budget: { status: string | null; revenue: string; cost: string; margin: string };
  revenue: {
    billed: string;
    draft_billing: string;
    recognised: string;
    unbilled_time_and_materials: string;
    contract_asset_balance: string;
  };
  cost: { by_category: unknown[]; actual: string; committed: string; work_in_progress: string };
  margin: { gross_margin: string; gross_margin_percentage: string | null };
  forecast: {
    estimate_at_completion: string;
    estimate_to_complete: string;
    forecast_revenue: string;
    forecast_margin: string;
    forecast_margin_percentage: string | null;
    is_loss_forecast: boolean;
  };
  hours: { approved: string; billable: string; billable_ratio_percentage: string | null };
}

export interface ProjectClosureChecks {
  can_close: boolean;
  blockers: { code: string; message: string }[];
  warnings: { code: string; message: string }[];
}

export interface ProjectGanttTask {
  id: string;
  task_number: string;
  wbs_code: string | null;
  title: string;
  status: string;
  progress_percentage: string;
  planned_start_date: string;
  planned_end_date: string;
  baseline_start_date: string | null;
  baseline_end_date: string | null;
  finish_variance_days: number | null;
  dependencies: { id: string; predecessor_task_id: string; type: string; lag_days: number }[];
}

export interface ProjectGantt {
  project_id: string;
  project_name: string;
  planned_start_date: string | null;
  planned_end_date: string | null;
  baseline_start_date: string | null;
  baseline_end_date: string | null;
  progress_percentage: string;
  schedule_finish: string | null;
  critical_path: string[];
  milestones: { id: string; name: string; milestone_date: string; is_completed: boolean }[];
  tasks: ProjectGanttTask[];
}

export interface ProjectCriticalPath {
  project_start: string | null;
  project_finish: string | null;
  duration_days: number;
  critical_path: string[];
  tasks: unknown[];
}

export interface ProjectPaged<T> {
  data: T[];
  meta: { current_page: number; last_page: number; per_page: number; total: number };
}

export interface ProjectResourceProfile {
  id: string;
  user_id: string | null;
  name: string;
  resource_type: string;
  internal_hourly_cost: string;
  billing_hourly_rate: string;
  weekly_capacity_hours: string | null;
  is_active: boolean;
}

export interface ProjectResourceProfilePayload {
  name?: string | null;
  internal_hourly_cost: number;
  billing_hourly_rate: number;
  weekly_capacity_hours?: number | null;
  is_active?: boolean | null;
}

export interface ProjectCapacityWeek {
  week: string;
  week_start: string;
  capacity_hours: string;
  allocated_hours: string;
  available_hours: string;
  utilisation_percentage: string | null;
  is_over_allocated: boolean;
}

export interface ProjectCapacityRow {
  user_id: string;
  user_name: string | null;
  capacity_source: 'resource_profile' | 'default';
  weeks: ProjectCapacityWeek[];
  over_allocated_weeks: number;
}

export interface ProjectRateCard {
  id: string;
  project_id: string | null;
  user_id: string | null;
  role: string | null;
  cost_rate: string;
  bill_rate: string;
  valid_from: string | null;
  valid_to: string | null;
}

export interface ProjectRateCardPayload {
  project_id?: string | null;
  user_id?: string | null;
  role?: string | null;
  cost_rate: number;
  bill_rate: number;
  valid_from?: string | null;
  valid_to?: string | null;
}

export type ProjectDependencyType = 'finish_to_start' | 'start_to_start' | 'finish_to_finish' | 'start_to_finish';
