/** Workforce shift planning and roster scheduling (Mod 073): wire models of `/api/v1/shift-planning`. */

export type RosterStatus = 'draft' | 'published' | 'locked';
export type RosterPeriodType = 'weekly' | 'monthly';
export type RosterJurisdiction = 'CH' | 'IT';
export type RosterGroupBy = 'employee' | 'role';
export type IssueSeverity = 'blocking_error' | 'warning';
export type SwapStatus =
  'pending_peer_acceptance' | 'pending_manager_approval' | 'approved' | 'rejected';
export type RotationPattern = '5x2' | '6x6';
export type CoverageLevel = 'ok' | 'low' | 'critical';

export const ROSTER_PERIOD_TYPES: readonly RosterPeriodType[] = ['weekly', 'monthly'];
export const ROTATION_PATTERNS: readonly RotationPattern[] = ['5x2', '6x6'];
export const SWAP_STATUSES: readonly SwapStatus[] = [
  'pending_peer_acceptance',
  'pending_manager_approval',
  'approved',
  'rejected',
];

/** `{data}` envelope of every successful call. */
export interface ShiftPlanningResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

/** One finding of the real-time compliance check; the client translates `translation_key` with `params`. */
export interface ComplianceIssue {
  severity: IssueSeverity;
  rule_code: string;
  translation_key: string;
  params: Record<string, string | number | boolean | null>;
}

/** RFC 7807 body of a 422 compliance failure: every finding is in `invalid_params`. */
export interface ShiftProblemDetails {
  title: string;
  detail: string;
  status: number;
  invalid_params?: ComplianceIssue[];
}

export interface SurchargeBreakdown {
  worked_minutes: number;
  night_minutes: number;
  sunday_minutes: number;
  holiday_minutes: number;
  on_call_minutes: number;
  night_wage_surcharge_percent: number | null;
  night_time_compensation_minutes: number;
  sunday_wage_surcharge_percent: number | null;
  holiday_wage_surcharge_percent: number | null;
  on_call_wage_surcharge_percent: number | null;
  tags: SurchargeTag[];
}

export type SurchargeTag = 'night' | 'sunday' | 'holiday' | 'on_call';

export interface ShiftTemplate {
  id: string;
  code: string;
  name: Record<string, string>;
  start_time: string;
  end_time: string;
  break_minutes: number;
  color_hex: string;
  night_surcharge_applicable: boolean;
  is_on_call: boolean;
  is_active: boolean;
}

export interface ShiftTemplatePayload {
  code: string;
  name: Record<'it' | 'de' | 'fr' | 'en', string>;
  start_time: string;
  end_time: string;
  break_minutes?: number;
  color_hex?: string;
  night_surcharge_applicable?: boolean;
  is_on_call?: boolean;
  is_active?: boolean;
}

export interface RosterPeriod {
  id: string;
  location_or_department_id: string | null;
  production_line_id: string | null;
  period_type: RosterPeriodType;
  jurisdiction: RosterJurisdiction;
  start_date: string;
  end_date: string;
  status: RosterStatus;
  published_at: string | null;
  locked_at: string | null;
}

export interface ShiftAssignment {
  id: string;
  roster_schedule_period_id: string;
  employee_id: string | null;
  is_open: boolean;
  shift_date: string;
  shift_template_id: string;
  template?: { code: string; name: Record<string, string>; color_hex: string; is_on_call: boolean };
  start_at: string;
  end_at: string;
  required_role_or_skill_id: string | null;
  /** Absent in the employee self-service views: employees never see the cost of a shift. */
  estimated_labor_cost?: string;
  surcharge_breakdown: SurchargeBreakdown | null;
  compliance_warnings: ComplianceIssue[];
  has_blocking_issue: boolean;
  /** Role rows of the matrix add the name of the assigned employee. */
  employee_name?: string | null;
  claim_warnings?: ComplianceIssue[];
}

export interface RosterMatrixRow {
  key: string;
  employee_id?: string;
  employee_name?: string | null;
  role_or_skill_id?: string | null;
  contract_minutes?: number;
  scheduled_minutes: number;
  utilisation_percent?: number | null;
  labor_cost: string;
  cells: Record<string, ShiftAssignment[]>;
}

export interface CoverageCell {
  date: string;
  shift_template_id: string;
  assigned: number;
  open: number;
  coverage_ratio: number;
  level: CoverageLevel;
}

export interface RosterTotals {
  labor_cost: string;
  labor_cost_by_day: Record<string, string>;
  scheduled_minutes: number;
  open_shifts: number;
  blocking_issues: number;
  warnings: number;
}

export interface RosterMatrix {
  period: RosterPeriod;
  days: string[];
  group_by: RosterGroupBy;
  rows: RosterMatrixRow[];
  open_shifts: ShiftAssignment[];
  coverage: CoverageCell[];
  totals: RosterTotals;
}

export interface AssignShiftPayload {
  roster_schedule_period_id?: string;
  shift_date: string;
  shift_template_id: string;
  employee_id?: string | null;
  required_role_or_skill_id?: string | null;
}

export interface AssignShiftResult {
  assignment: ShiftAssignment;
  warnings: ComplianceIssue[];
  estimated_labor_cost: string;
}

export interface GenerateRosterPayload {
  location_or_department_id?: string | null;
  production_line_id?: string | null;
  period_type: RosterPeriodType;
  start_date: string;
  jurisdiction?: RosterJurisdiction;
  pattern?: RotationPattern;
  source_period_id?: string;
  employee_ids?: string[];
  shift_template_ids?: string[];
  open_slots?: Record<string, number>;
}

export interface GenerateRosterResult {
  period: RosterPeriod;
  created: number;
  open: number;
  blocking: number;
  warnings: number;
}

export interface PublishRosterResult {
  period: RosterPeriod;
  assigned: number;
  open: number;
  warnings: number;
}

export interface SwapImpactSide {
  assignment_id: string;
  current_employee_id: string | null;
  new_employee_id: string;
  current: { compliance_warnings: ComplianceIssue[]; estimated_labor_cost: string };
  after: { compliance_warnings: ComplianceIssue[]; estimated_labor_cost: string };
  has_blocking: boolean;
}

export interface SwapComplianceImpact {
  peer_takes_offered_shift: SwapImpactSide;
  requester_takes_counter_shift: SwapImpactSide | null;
  can_approve: boolean;
}

export interface ShiftSwapRequest {
  id: string;
  requester_employee_id: string;
  target_peer_employee_id: string | null;
  is_broadcast: boolean;
  shift_assignment_id: string;
  target_shift_assignment_id: string | null;
  status: SwapStatus;
  peer_responded_at: string | null;
  reviewed_by_user_id: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  assignment?: ShiftAssignment;
  target_assignment?: ShiftAssignment | null;
  compliance_impact?: SwapComplianceImpact;
  created_at: string | null;
}

export interface SwapDecisionPayload {
  decision: 'approve' | 'reject';
  rejection_reason?: string | null;
}
