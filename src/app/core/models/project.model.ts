export interface ProjectPhase {
  id?: string;
  name: string;
  sequence_order?: number | null;
  planned_start_date?: string | null;
  planned_end_date?: string | null;
}

export interface ProjectMilestoneResource {
  id: string;
  project_id: string;
  name: string;
  milestone_date: string;
  progress_percentage: string;
  is_completed: boolean;
  completed_at: string | null;
}

export interface ProjectFinancialSummary {
  contract_value: string;
  planned_cost: string;
  actual_cost: string;
  earned_value: string;
  planned_value: string;
  cost_variance: string;
  schedule_variance: string;
  cpi: string;
  spi: string;
  eac: string;
  vac: string;
  profit_margin_percentage: string;
}

export interface ProjectResource {
  id: string;
  project_number: string;
  name: string;
  description: string | null;
  project_type: string;
  status: string;
  billing_method: string;
  revenue_recognition_method: string | null;
  contact_id: string;
  portfolio_id: string | null;
  parent_project_id: string | null;
  project_manager_user_id: string;
  currency: string;
  contract_value: string;
  progress_percentage: string;
  health_status: string;
  planned_start_date: string | null;
  planned_end_date: string | null;
  baseline_start_date: string | null;
  baseline_end_date: string | null;
  actual_start_date: string | null;
  actual_end_date: string | null;
  closed_at: string | null;
  phases?: ProjectPhase[];
  milestones?: ProjectMilestoneResource[];
  financial_summary?: ProjectFinancialSummary | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface StoreProjectPayload {
  contact_id: string;
  project_number: string;
  name: string;
  description?: string | null;
  project_type: string;
  billing_method: string;
  currency?: string | null;
  planned_start_date: string;
  planned_end_date: string;
  project_manager_user_id: string;
  contract_value: number;
}

export interface UpdateProjectPayload extends Partial<StoreProjectPayload> {
  status?: string;
  progress_percentage?: number | string;
  health_status?: string;
}

export interface ProjectTaskAssignment {
  id: string;
  project_task_id: string;
  user_id: string;
  role_description: string | null;
  allocated_hours: string;
}

export interface ProjectTaskResource {
  id: string;
  project_id: string;
  project_phase_id: string | null;
  project_milestone_id: string | null;
  parent_task_id: string | null;
  task_number: string;
  wbs_code: string | null;
  sort_order: number;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  planned_start_date: string;
  planned_end_date: string;
  baseline_start_date: string | null;
  baseline_end_date: string | null;
  actual_start_date: string | null;
  actual_end_date: string | null;
  estimated_hours: string;
  actual_hours: string;
  progress_percentage: string;
  assignments?: ProjectTaskAssignment[];
}

export interface StoreProjectTaskPayload {
  title: string;
  description?: string | null;
  task_number: string;
  status?: string;
  priority?: string;
  planned_start_date?: string;
  planned_end_date?: string;
  estimated_hours?: number;
}

export interface ProjectTimesheetResource {
  id: string;
  project_id: string;
  project_task_id: string | null;
  user_id: string;
  role: string | null;
  work_date: string;
  hours_worked: string;
  overtime_hours: string;
  is_billable: boolean;
  cost_rate: string;
  charge_rate: string;
  total_cost: string;
  total_charge: string;
  status: string;
  submitted_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  work_summary: string | null;
}

export interface StoreProjectTimesheetPayload {
  /** API field name (the resource returns it as `project_task_id`). */
  task_id?: string | null;
  user_id: string;
  work_date: string;
  hours_worked: number;
  overtime_hours?: number;
  is_billable?: boolean;
  work_summary?: string | null;
}
