/** Goals and OKR, offboarding and workforce analytics (`/hr/...`). */

export type GoalLevel = 'company' | 'team' | 'employee';
export type GoalStatus = 'draft' | 'active' | 'completed' | 'cancelled';
export type GoalCycleStatus = 'draft' | 'active' | 'closed';

export interface GoalCycleRecord {
  id: string;
  name: string;
  starts_on: string;
  ends_on: string;
  status: GoalCycleStatus;
  closed_at: string | null;
}

export interface GoalCyclePayload {
  name?: string;
  starts_on?: string;
  ends_on?: string;
  status?: 'draft' | 'active';
}

export interface GoalKeyResultRecord {
  id: string;
  goal_id: string;
  metric: string;
  unit: string | null;
  /** Decimal strings (4 digits). */
  start_value: string;
  target_value: string;
  current_value: string;
  /** Percentage 0-100 as a decimal string. */
  progress: string;
  sort_order: number;
}

export interface GoalKeyResultPayload {
  metric?: string;
  unit?: string | null;
  start_value?: string | null;
  target_value?: string;
  current_value?: string | null;
}

export interface GoalCheckInRecord {
  id: string;
  goal_id: string;
  key_result_id: string | null;
  value: string | null;
  progress: string;
  comment: string | null;
  checked_in_by: string | null;
  checked_in_at: string;
}

export interface GoalRecord {
  id: string;
  goal_cycle_id: string;
  parent_goal_id: string | null;
  level: GoalLevel;
  employee_id: string | null;
  team_id: string | null;
  title: string;
  description: string | null;
  weight: string;
  due_on: string | null;
  status: GoalStatus;
  progress: string;
  key_results?: GoalKeyResultRecord[];
  check_ins?: GoalCheckInRecord[];
  parent?: GoalRecord | null;
  children?: GoalRecord[];
}

export interface GoalPayload {
  goal_cycle_id?: string;
  level?: GoalLevel;
  employee_id?: string | null;
  team_id?: string | null;
  parent_goal_id?: string | null;
  title?: string;
  description?: string | null;
  weight?: string;
  due_on?: string | null;
  status?: GoalStatus;
  key_results?: (GoalKeyResultPayload & { metric: string; target_value: string })[];
}

export interface GoalCheckInPayload {
  key_result_id?: string | null;
  value?: string | null;
  progress?: string | null;
  comment?: string | null;
}

export interface TeamRecord {
  id: string;
  code: string;
  name: string;
}

export interface EmployeeGoalProgress {
  employee_id: string;
  goal_cycle_id: string | null;
  progress: number | null;
}

export type OffboardingTaskCode = 'asset_return' | 'access_revocation' | 'exit_interview' | 'final_settlement' | 'custom';

export interface OffboardingTemplateTask {
  title: string;
  code?: OffboardingTaskCode | null;
  due_after_days?: number | null;
}

export interface OffboardingTemplateRecord {
  id: string;
  name: string;
  kind: 'offboarding';
  tasks: OffboardingTemplateTask[];
}

export interface OffboardingTemplatePayload {
  name?: string;
  tasks?: OffboardingTemplateTask[];
}

export interface OffboardingTaskRecord {
  id: string;
  title: string;
  code: OffboardingTaskCode | null;
  due_on: string | null;
  sort_order: number;
  completed_at: string | null;
  completed_by: string | null;
}

export interface OffboardingChecklistRecord {
  id: string;
  employee_id: string;
  kind: 'offboarding';
  onboarding_template_id: string | null;
  reference_date: string | null;
  completed_at: string | null;
  tasks?: OffboardingTaskRecord[];
  employee?: { id: string; employee_number: string; full_name: string; termination_date: string | null } | null;
}

export interface StartOffboardingPayload {
  employee_id: string;
  template_id?: string | null;
}

export interface ExitReasonOption {
  code: string;
  voluntary: boolean;
}

export interface ExitInterviewRecord {
  id: string;
  employee_id: string;
  conducted_on: string;
  reason_code: string;
  would_recommend: boolean | null;
  eligible_for_rehire: boolean | null;
  satisfaction_rating: number | null;
  feedback: string | null;
  employee?: { id: string; employee_number: string; full_name: string } | null;
}

export interface ExitInterviewPayload {
  employee_id: string;
  conducted_on: string;
  reason_code: string;
  interviewer_employee_id?: string | null;
  would_recommend?: boolean | null;
  eligible_for_rehire?: boolean | null;
  satisfaction_rating?: number | null;
  feedback?: string | null;
}

/** Query of the analytics endpoints: every field is optional. */
export interface HrAnalyticsQuery {
  from?: string;
  to?: string;
  as_of?: string;
  granularity?: 'month' | 'quarter' | 'year';
  days?: number;
}

export interface HeadcountAnalytics {
  as_of: string;
  total: number;
  by_department: { department_id: string | null; department_name: string | null; headcount: number }[];
  by_contract_type: { contract_type: string; headcount: number }[];
  by_employment_type: { employment_type: string; headcount: number }[];
  series: { period: string; date: string; headcount: number }[];
}

export interface TurnoverFigures {
  period: string;
  start: string;
  end: string;
  opening_headcount: number;
  closing_headcount: number;
  hires: number;
  terminations: number;
  average_headcount: number;
  turnover_rate: number | null;
}

export interface TurnoverAnalytics {
  from: string;
  to: string;
  granularity: 'month' | 'quarter' | 'year';
  periods: TurnoverFigures[];
  totals: TurnoverFigures;
  by_reason: { reason_code: string; count: number }[];
  leavers_without_exit_interview: number;
}

export interface TenureAnalytics {
  as_of: string;
  employees: number;
  average_tenure_years: number | null;
  average_tenure_leavers_years: number | null;
  distribution: { bucket: string; employees: number }[];
  by_department: { department_id: string | null; department_name: string | null; average_tenure_years: number | null }[];
}

export interface AbsenteeismAnalytics {
  from: string;
  to: string;
  scheduled_days: number;
  absence_days: number;
  planned_leave_days: number;
  absenteeism_rate: number | null;
  total_leave_rate: number | null;
  by_category: { category: string; planned: boolean; days: number }[];
  by_department: {
    department_id: string | null;
    department_name: string | null;
    absence_days: number;
    scheduled_days: number;
    absenteeism_rate: number | null;
  }[];
}

export interface PositionsAnalytics {
  as_of: string;
  budget: number;
  filled: number;
  open: number;
  open_job_postings: number;
  positions: {
    position_id: string;
    code: string;
    title: string;
    department_id: string | null;
    budget: number;
    filled: number;
    open: number;
    open_postings: number;
  }[];
}

export interface UpcomingExpiriesAnalytics {
  from: string;
  to: string;
  days: number;
  probation_ends: {
    employee_id: string;
    employee_number: string;
    full_name: string;
    department_id: string | null;
    probation_end_date: string;
    days_remaining: number;
  }[];
  contract_expiries: {
    contract_id: string;
    employee_id: string;
    full_name: string | null;
    contract_number: string;
    contract_type: string;
    end_date: string;
    days_remaining: number;
  }[];
}
