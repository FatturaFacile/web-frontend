export type EmploymentStatus = 'active' | 'probation' | 'terminated' | 'on_leave' | string;
export type EmploymentType = 'full_time' | 'part_time' | 'contractor' | 'apprentice' | 'seasonal';

export interface EmployeeResource {
  id: string;
  tenant_id?: string;
  employee_number: string;
  first_name: string;
  last_name: string;
  full_name: string;
  work_email: string;
  department_id?: string | null;
  department_name?: string | null;
  team_id?: string | null;
  business_unit_id?: string | null;
  cost_center_id?: string | null;
  position_id?: string | null;
  position_name?: string | null;
  job_grade_id?: string | null;
  manager_id?: string | null;
  employment_status: EmploymentStatus;
  employment_type: EmploymentType;
  hire_date: string;
  probation_end_date?: string | null;
  termination_date?: string | null;
  base_annual_salary: number | string;
  hourly_cost_rate?: number;
  currency: string;
  fte_ratio?: number;
  approval_status?: string;
  is_locked?: boolean;
  equipment_assigned?: unknown;
  created_at?: string;
}

export interface HireEmployeePayload {
  first_name: string;
  last_name: string;
  work_email: string;
  base_annual_salary: number;
  hire_date?: string;
  department_id?: string | null;
  employment_type?: EmploymentType;
  /** 'permanent', 'fixed_term', 'apprenticeship', 'contractor' or 'internship'. */
  contract_type?: string;
  weekly_hours?: number;
  probation_months?: number;
}

export interface TerminateEmployeePayload {
  termination_date: string;
  reason: string;
}

export interface PromoteEmployeePayload {
  position_id?: string;
  job_grade_id?: string;
  base_annual_salary?: number;
  effective_date?: string;
}

export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled' | string;

export interface LeaveRequestResource {
  id: string;
  request_number: string;
  employee_id: string;
  employee_name?: string;
  leave_type_id: string;
  leave_type_name?: string;
  start_date: string;
  end_date: string;
  total_hours: number;
  total_days: number;
  status: LeaveStatus;
  is_locked?: boolean;
  reason?: string | null;
  approved_at?: string | null;
  created_at?: string;
}

export interface SubmitLeaveRequestPayload {
  employee_id: string;
  leave_type_id: string;
  start_date: string;
  end_date: string;
  total_hours: number;
  reason?: string | null;
}

export type TimesheetStatus = 'draft' | 'submitted' | 'approved' | 'rejected' | string;

export interface TimesheetResource {
  id: string;
  timesheet_number: string;
  employee_id: string;
  employee_name?: string;
  project_id?: string | null;
  work_date: string;
  regular_hours: number;
  overtime_hours: number;
  total_hours: number;
  billable_hours: number;
  hourly_cost_rate?: number;
  total_labor_cost?: number;
  status: TimesheetStatus;
}

export interface SubmitTimesheetPayload {
  employee_id: string;
  work_date: string;
  regular_hours: number;
  overtime_hours?: number;
  billable_hours?: number;
  project_id?: string | null;
  task_id?: string | null;
  cost_center_id?: string | null;
  description?: string | null;
}

export interface PayrollRunResource {
  id: string;
  month: number;
  year: number;
  country?: 'IT' | 'CH' | string;
  status: 'draft' | 'calculated' | 'approved' | 'paid' | string;
  total_net?: number | string;
  total_gross?: number | string;
  total_employer_cost?: number | string;
  employees_count?: number;
  created_at?: string;
}

export interface FrontierWorkerResource {
  id: string;
  employee_id: string;
  employee_name?: string;
  canton?: string;
  italian_municipality?: string;
  tax_regime?: string;
  status: string;
}

// Backward-compatible aliases
export type Employee = EmployeeResource | {
  id?: string;
  name?: string;
  role?: string;
  type?: string;
  regime?: string;
  pension?: string;
  status?: string;
};

export interface CrossBorderEmployee {
  id: string;
  user_id: string;
  is_cross_border_commuter: boolean;
  job_title: string | null;
  department: string | null;
  hire_date: string | null;
  termination_date: string | null;
  name: string;
  email: string;
}

/** Swiss companies get the canton block, Italian ones the INPS/INAIL block. */
export type WithholdingTaxParameters = Record<string, string>;

export type PositionReadinessLevel = 'ready_now' | 'ready_1_2_years' | 'developing';

export interface PayrollForecast {
  period_code: string;
  active_headcount: number;
  estimated_payroll_outflow: number;
  accrual_amount: number;
}
