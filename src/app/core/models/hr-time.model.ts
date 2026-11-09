/** Leave accruals/calendar and time tracking (`/hr/time/*`, overtime rules, monthly closings). */

export interface LeaveAccrualPolicyResource {
  id: string;
  leave_type_id: string;
  code: string;
  name: string;
  employment_type: string | null;
  annual_entitlement_hours: string;
  accrual_frequency: string;
  prorate_by_fte: boolean;
  max_balance_hours: string | null;
  max_carryover_hours: string | null;
  valid_from: string;
  valid_to: string | null;
  is_active: boolean;
  source_reference: string | null;
}

export interface LeaveAccrualPolicyPayload {
  leave_type_id: string;
  code: string;
  name: string;
  employment_type?: string | null;
  annual_entitlement_hours: string;
  accrual_frequency?: 'monthly' | 'yearly';
  prorate_by_fte?: boolean;
  max_balance_hours?: string | null;
  max_carryover_hours?: string | null;
  valid_from: string;
  valid_to?: string | null;
  is_active?: boolean;
  source_reference?: string | null;
}

export interface LeaveBalanceResource {
  id: string;
  employee_id: string;
  leave_type_id: string;
  fiscal_year: number;
  entitlement_hours: string;
  carryover_hours: string;
  accrued_hours: string;
  used_hours: string;
  pending_hours: string;
  available_hours: string;
}

export interface LeaveCalendarEntry {
  id: string;
  employee_id: string;
  employee_name: string;
  department_id: string | null;
  leave_type_code: string;
  leave_type_name: string;
  start_date: string;
  end_date: string;
  total_hours: string;
  status: string;
}

export interface LeaveCalendarParams {
  from: string;
  to: string;
  department_id?: string;
  employee_id?: string;
  user_id?: string;
}

export type TimeEventType = 'In' | 'Out' | 'BreakStart' | 'BreakEnd';
export type TimeEventSource = 'badge' | 'terminal' | 'web' | 'mobile' | 'spreadsheet' | 'paper' | 'manual';

export interface TimeEventResource {
  id: string;
  employee_id: string;
  occurred_at: string;
  event_type: TimeEventType;
  source: TimeEventSource;
  note: string | null;
  created_by: string | null;
  deleted_by: string | null;
  deletion_reason: string | null;
}

export interface CreateTimeEventPayload {
  employee_id?: string | null;
  event_type: TimeEventType;
  source?: TimeEventSource | null;
  occurred_at?: string | null;
  note?: string | null;
  reason?: string | null;
}

/** A closed month rejects edits with 409. The reason is mandatory. */
export interface UpdateTimeEventPayload {
  occurred_at?: string;
  event_type?: TimeEventType;
  source?: TimeEventSource;
  note?: string | null;
  reason: string;
}

export interface TimeEventFilterParams {
  employee_id?: string;
  from?: string;
  to?: string;
  include_deleted?: boolean;
  page?: number;
  per_page?: number;
}

export interface DailyTimeRecordPayload {
  employee_id?: string | null;
  date: string;
  worked_minutes: number;
  start_time?: string | null;
  end_time?: string | null;
  note?: string | null;
  reason?: string | null;
}

export interface TimeReportParams {
  employee_id?: string;
  from: string;
  to: string;
}

export interface TimeReport {
  employee_id: string;
  employee_name: string;
  recording_mode: 'Detailed' | 'Simplified' | 'Waived';
  from: string;
  to: string;
  days: unknown[];
  weeks: unknown[];
  worked_minutes: number;
  target_minutes: number;
  credited_minutes: number;
  balance_minutes: number;
  balance: string;
  statutory_overtime_minutes: number;
  statutory_overtime_before_minutes: number;
  statutory_overtime_year_minutes: number;
  statutory_overtime_cap_minutes: number;
  days_with_issues: number;
  issues: string[];
}

export interface TimeAuditEntry {
  id: string;
  employee_id: string | null;
  entity_type: string;
  entity_id: string | null;
  action: string;
  reason: string | null;
  actor_id: string | null;
  actor_name: string;
  occurred_at: string;
}

export interface OvertimeRuleResource {
  id: string;
  code: string;
  name: string;
  basis: 'daily' | 'weekly' | string;
  threshold_minutes: number;
  /** Decimal string. */
  premium_percent: string;
  wage_type_code: string | null;
  priority: number;
  valid_from: string | null;
  valid_to: string | null;
  is_active: boolean;
  source_reference: string | null;
}

export interface OvertimeRulePayload {
  code: string;
  name: string;
  basis: 'daily' | 'weekly';
  threshold_minutes: number;
  premium_percent: string;
  wage_type_code?: string | null;
  priority?: number;
  valid_from?: string | null;
  valid_to?: string | null;
  is_active?: boolean;
  source_reference?: string | null;
}

export interface OvertimeSummary {
  employee_id: string;
  from: string;
  to: string;
  days: { date: string; worked_minutes: string; overtime: unknown[] }[];
  weeks: { week: string; worked_minutes: string; daily_overtime_minutes: string; overtime: unknown[] }[];
  totals: unknown[];
}

export interface TimeClosingResource {
  id: string;
  year: number;
  month: number;
  status: string;
  closed_at: string | null;
  closed_by: string | null;
  reopened_at: string | null;
  reopened_by: string | null;
  reopen_reason: string | null;
  reopen_count: number;
  summary: unknown[] | null;
}

export type TimeRecordingMode = 'Detailed' | 'Simplified' | 'Waived';

export interface TimeProfileResource {
  employee_id: string;
  is_configured: string;
  mode: TimeRecordingMode;
  agreement_date: string | null;
  agreement_valid_from: string | null;
  agreement_valid_to: string | null;
  agreement_basis: string | null;
  autonomy_percent: number | null;
  collective_agreement_reference: string | null;
  salary_threshold_met: boolean;
  legal_max_weekly_hours: number;
  weekly_hours: string;
  work_days_per_week: number;
  hire_date: string | null;
  termination_date: string | null;
  canton: string | null;
}

export interface TimeProfilePayload {
  mode: TimeRecordingMode;
  agreement_date?: string | null;
  agreement_valid_from?: string | null;
  agreement_valid_to?: string | null;
  agreement_basis?: 'collective' | 'individual' | null;
  autonomy_percent?: number | null;
  collective_agreement_reference?: string | null;
  /** Decimal string. */
  annual_gross_salary?: string | null;
  legal_max_weekly_hours: '45' | '50';
  /** Decimal string. */
  weekly_hours: string;
  work_days_per_week: number;
  hire_date?: string | null;
  termination_date?: string | null;
  canton?: string | null;
  reason?: string | null;
}
