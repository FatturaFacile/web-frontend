/**
 * Mod 074 — Leave, Permits & Absences Management domain & wire models.
 * Covers CH (26 Cantons, Art. 329a/329b CO, IJM/KTG, LAINF/SUVA, IPG/EO) &
 * IT (Ferie, ROL, Ex-Festività, INPS PUC, INAIL, Legge 104, Comporto).
 */

export type LeaveCountryCode = 'CH' | 'IT';

export type LeaveTypeEnum =
  | 'AnnualVacation_Ferie_Ferien'
  | 'IT_PermessiROL'
  | 'IT_ExFestivita'
  | 'SickLeave_Malattia'
  | 'Accident_Infortunio_SUVA_INAIL'
  | 'MaternityPaternity_Congedo'
  | 'IT_Legge104_Permessi'
  | 'CH_MilitaryCivilService_EO_APG'
  | 'PaidSpecialLeave_MarriageBereavement'
  | 'UnpaidLeave';

export type LeaveRequestStatusCode =
  'draft' | 'pending_approval' | 'approved' | 'rejected' | 'cancelled';

export type LeaveUnitModeCode = 'days' | 'hours';

export type DeadlineAlertLevelCode = 'none' | 'warning' | 'critical' | 'expired';

export type SundayHolidayRuleCode = 'compensatory_pay_or_day' | 'compensatory_pay' | 'none';

export interface HolidayCatalogEntry {
  date: string;
  name: string;
  scope: string;
  is_sunday: boolean;
  is_half_day: boolean;
  paid_compensation_applicable: boolean;
}

export interface HolidayCatalogResponse {
  country: LeaveCountryCode;
  year: number;
  cantons: readonly string[];
  italian_patron_saints: Readonly<
    Record<string, { month: number; day: number; name: string; province: string }>
  >;
  holidays: HolidayCatalogEntry[];
}

export interface HolidayCalendarRecord {
  id: string;
  code: string;
  name: string;
  country: LeaveCountryCode;
  canton_or_province_code: string | null;
  municipality_name: string | null;
  municipality_patron_saint_date: string | null;
  municipality_patron_saint_name: string | null;
  year: number;
  sunday_holiday_rule: SundayHolidayRuleCode;
  holidays: HolidayCatalogEntry[];
  working_days: string[];
  is_active: boolean;
}

export interface SaveHolidayCalendarPayload {
  code: string;
  name: string;
  country: LeaveCountryCode;
  canton_or_province_code?: string | null;
  municipality_name?: string | null;
  municipality_patron_saint_date?: string | null;
  municipality_patron_saint_name?: string | null;
  year: number;
  sunday_holiday_rule?: SundayHolidayRuleCode;
  is_active?: boolean;
}

export interface LeaveEntitlementPolicyRecord {
  id: string;
  code: string;
  name: string;
  country: LeaveCountryCode;
  leave_type: LeaveTypeEnum;
  ccnl_or_contract_ref: string | null;
  unit_mode: LeaveUnitModeCode;
  annual_entitlement: number;
  annual_entitlement_under_20: number | null;
  annual_entitlement_over_50: number | null;
  hours_per_workday: number;
  accrual_frequency: 'monthly' | 'yearly' | 'none';
  prorate_by_fte: boolean;
  prorate_hire_termination: boolean;
  min_days_worked_in_month_for_accrual: number;
  max_carry_over: number | null;
  expiration_months: number | null;
  inps_18_month_alert_enabled: boolean;
  requires_approval: boolean;
  requires_medical_certificate: boolean;
  requires_inps_puc: boolean;
  waiting_period_days: number;
  employer_indemnity_percent: number;
  insurer_indemnity_percent: number;
  insurer_indemnity_percent_tier2: number | null;
  comporto_max_days: number | null;
  comporto_window_months: number;
  ch_curtailment_grace_months: number;
  ch_curtailment_enabled: boolean;
  legge_104_monthly_days_limit: number | null;
  is_paid: boolean;
  is_active: boolean;
}

export interface SaveLeaveEntitlementPolicyPayload {
  code: string;
  name: string;
  country: LeaveCountryCode;
  leave_type: LeaveTypeEnum;
  ccnl_or_contract_ref?: string | null;
  unit_mode: LeaveUnitModeCode;
  annual_entitlement: number;
  annual_entitlement_under_20?: number | null;
  annual_entitlement_over_50?: number | null;
  hours_per_workday?: number;
  accrual_frequency: 'monthly' | 'yearly' | 'none';
  prorate_by_fte?: boolean;
  prorate_hire_termination?: boolean;
  min_days_worked_in_month_for_accrual?: number;
  max_carry_over?: number | null;
  expiration_months?: number | null;
  inps_18_month_alert_enabled?: boolean;
  requires_approval?: boolean;
  requires_medical_certificate?: boolean;
  requires_inps_puc?: boolean;
  waiting_period_days?: number;
  employer_indemnity_percent?: number;
  insurer_indemnity_percent?: number;
  insurer_indemnity_percent_tier2?: number | null;
  comporto_max_days?: number | null;
  comporto_window_months?: number;
  ch_curtailment_grace_months?: number;
  ch_curtailment_enabled?: boolean;
  legge_104_monthly_days_limit?: number | null;
  is_paid?: boolean;
  is_active?: boolean;
}

export interface EmployeeLeaveAccrualLedgerRecord {
  id: string;
  employee_id: string;
  employee_name?: string | null;
  employee_number?: string | null;
  policy_id: string | null;
  fiscal_year: number;
  country: LeaveCountryCode;
  leave_type: LeaveTypeEnum;
  unit_mode: LeaveUnitModeCode;
  prior_year_carry_over: number;
  accrued_ytd: number;
  curtailment_reduction_ytd: number;
  taken_ytd: number;
  planned_approved_future: number;
  pending_approval_amount: number;
  projected_year_end_balance: number;
  annual_entitlement_target: number;
  expiration_deadline_date: string | null;
  expiring_carry_over_amount: number;
  deadline_alert_level: DeadlineAlertLevelCode;
  last_accrued_period: string | null;
}

export interface IndemnityBreakdownData {
  country: LeaveCountryCode;
  regime: string;
  total_calendar_days: number;
  employer_waiting_days: number;
  employer_indemnity_percent: number;
  tier1_insurer_days: number;
  tier1_insurer_percent: number;
  tier2_insurer_days: number;
  tier2_insurer_percent: number;
  notes: string;
}

export interface StaffingCheckResultData {
  breached: boolean;
  department_id: string | null;
  department_name: string | null;
  total_active_employees: number;
  min_present_count: number;
  min_present_percent: number;
  effective_min_required: number;
  enforce_hard_block: boolean;
  critical_days: {
    date: string;
    present_count: number;
    absent_count: number;
    required_min: number;
  }[];
}

export interface Mod074LeaveRequestRecord {
  id: string;
  request_number: string;
  employee_id: string;
  employee_name?: string | null;
  employee_number?: string | null;
  department_id: string | null;
  department_name?: string | null;
  policy_id: string | null;
  ledger_id: string | null;
  country: LeaveCountryCode;
  leave_type: LeaveTypeEnum;
  start_date: string;
  end_date: string;
  half_day_or_hourly_duration: string | null;
  duration_unit: LeaveUnitModeCode;
  requested_days: number;
  requested_hours: number;
  status: LeaveRequestStatusCode;
  inps_medical_certificate_protocol_number: string | null;
  suva_claim_number: string | null;
  inail_claim_number: string | null;
  medical_certificate_doc_id: string | null;
  certificate_issue_date: string | null;
  is_accident_occupational: boolean | null;
  is_fault_absence: boolean;
  is_pregnancy_related: boolean;
  ijm_ktg_waiting_days: number | null;
  ipg_eo_allowance_code: string | null;
  legge_104_beneficiary_ref: string | null;
  indemnity_breakdown: IndemnityBreakdownData | null;
  staffing_check_result: StaffingCheckResultData | null;
  is_locked: boolean;
  approved_at: string | null;
  rejection_reason: string | null;
  notes: string | null;
}

export interface SubmitMod074LeaveRequestPayload {
  employee_id: string;
  country?: LeaveCountryCode;
  leave_type: LeaveTypeEnum;
  start_date: string;
  end_date: string;
  half_day_or_hourly_duration?: string | null;
  duration_unit?: LeaveUnitModeCode;
  requested_days?: number;
  requested_hours?: number;
  legge_104_beneficiary_ref?: string | null;
  notes?: string | null;
}

export interface RegisterSickLeaveInpsPayload {
  employee_id: string;
  country: LeaveCountryCode;
  leave_type: LeaveTypeEnum;
  start_date: string;
  end_date: string;
  half_day_or_hourly_duration?: string | null;
  inps_medical_certificate_protocol_number?: string | null;
  suva_claim_number?: string | null;
  inail_claim_number?: string | null;
  medical_certificate_doc_id?: string | null;
  certificate_issue_date?: string | null;
  is_accident_occupational?: boolean | null;
  is_fault_absence?: boolean;
  is_pregnancy_related?: boolean;
  ijm_ktg_waiting_days?: number | null;
  ipg_eo_allowance_code?: string | null;
  auto_approve?: boolean;
  notes?: string | null;
}

export interface DepartmentStaffingThresholdRecord {
  id: string;
  department_id: string;
  department_name?: string | null;
  min_present_count: number;
  min_present_percent: number;
  enforce_hard_block: boolean;
  effective_from: string | null;
  effective_to: string | null;
  notes: string | null;
  is_active: boolean;
}

export interface UpsertStaffingThresholdPayload {
  min_present_count: number;
  min_present_percent: number;
  enforce_hard_block: boolean;
  notes?: string | null;
  is_active?: boolean;
}

export interface GanttDayColumn {
  date: string;
  weekday: string;
  is_weekend: boolean;
  holiday: HolidayCatalogEntry | null;
  absent_count: number;
  present_count: number;
  required_min: number;
  threshold_breached: boolean;
}

export interface GanttAbsenceSpan {
  id: string;
  request_number: string;
  leave_type: LeaveTypeEnum;
  start_date: string;
  end_date: string;
  half_day_or_hourly_duration: string | null;
  requested_days: number;
  requested_hours: number;
  status: LeaveRequestStatusCode;
}

export interface GanttEmployeeRow {
  employee_id: string;
  employee_number: string;
  employee_name: string;
  department_id: string | null;
  department_name: string | null;
  fte_ratio: number;
  absences: GanttAbsenceSpan[];
}

export interface DepartmentGanttResponse {
  from: string;
  to: string;
  department_id: string | null;
  country: LeaveCountryCode;
  canton_or_province_code: string | null;
  total_employees: number;
  threshold: {
    min_present_count: number;
    min_present_percent: number;
    effective_min_required: number;
    enforce_hard_block: boolean;
  } | null;
  days: GanttDayColumn[];
  employees: GanttEmployeeRow[];
}

export interface ComportoOrCurtailmentEvaluationData {
  employee_id: string;
  employee_name: string;
  fiscal_year: number;
  country: LeaveCountryCode;
  italian_comporto: {
    applicable: boolean;
    window_months: number;
    max_days: number;
    sick_days_in_window: number;
    remaining_days: number;
    utilization_percent: number;
    status: 'ok' | 'warning_75' | 'critical_90' | 'exceeded';
  };
  swiss_curtailment: {
    applicable: boolean;
    art329a_base_entitlement_days: number;
    grace_months: number;
    qualifying_absence_days: number;
    full_absence_months: number;
    reducible_months: number;
    reduction_fraction: string;
    reduction_days: number;
    net_entitlement_days: number;
    applied_to_ledger: boolean;
  };
  vacation_deadline_alerts: {
    leave_type: LeaveTypeEnum;
    fiscal_year: number;
    deadline_date: string;
    expiring_amount: number;
    alert_level: DeadlineAlertLevelCode;
  }[];
}

export interface PayrollAbsenceSummaryRow {
  employee_id: string;
  employee_number: string | null;
  employee_name: string | null;
  country: LeaveCountryCode;
  year: number;
  month: number;
  total_absence_days: number;
  total_absence_hours: number;
  by_leave_type: Record<string, number>;
  inps_puc_protocols: string[];
  suva_claims: string[];
  inail_claims: string[];
  curtailment_reduction_days: number;
}
