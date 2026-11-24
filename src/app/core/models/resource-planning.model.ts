/** Resource planning and capacity saturation (Mod 079): wire models of `/api/v1/resource-planning`. */

export type BookingType = 'SoftTentative' | 'HardCommitted';
export type CapacityBand = 'none' | 'green' | 'yellow' | 'red';
export type HeatmapGranularity = 'week' | 'day';
export type RebalanceStrategy = 'shift' | 'reassign' | 'split' | 'resize';
export type CertificationStatus = 'not_required' | 'valid' | 'missing' | 'expired';
export type UtilizationGroupBy = 'resource' | 'department' | 'cost_center';
export type UtilizationStatus = 'on_target' | 'below_target' | 'above_target';

export const BOOKING_TYPES: readonly BookingType[] = ['SoftTentative', 'HardCommitted'];
export const HEATMAP_GRANULARITIES: readonly HeatmapGranularity[] = ['week', 'day'];
export const UTILIZATION_GROUP_BYS: readonly UtilizationGroupBy[] = [
  'resource',
  'department',
  'cost_center',
];
export const PROFICIENCY_LEVELS: readonly number[] = [1, 2, 3, 4, 5];

/** `{data}` envelope of every successful call. */
export interface ResourcePlanningResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

/** A domain violation or warning: the client translates `resourcePlanning.error.<code>` / `warning.<code>`. */
export interface PlanningIssue {
  code: string;
  params?: Record<string, string | number | boolean | null>;
}

/** RFC 7807 body of a refused change: every violated rule is in `invalid_params`. */
export interface ResourcePlanningProblem {
  title?: string;
  detail?: string;
  status?: number;
  invalid_params?: PlanningIssue[];
}

// --- Skills ---

export interface Skill {
  id: string;
  category: string;
  skill_name: string;
  requires_certification: boolean;
  certification_code: string | null;
}

export interface SkillPayload {
  category: string;
  skill_name: string;
  requires_certification?: boolean;
  certification_code?: string | null;
}

export interface EmployeeSkillProfile {
  id: string;
  employee_id: string;
  employee_name: string;
  skill_id: string;
  skill_name: string;
  category: string;
  proficiency_level: number;
  valid_until_date: string | null;
  is_valid: boolean;
  requires_certification: boolean;
  certification_code: string | null;
  certification_status: CertificationStatus;
  certification_valid_until: string | null;
}

export interface EmployeeSkillProfilePayload {
  employee_id: string;
  skill_id: string;
  proficiency_level: number;
  valid_until_date?: string | null;
}

export interface EmployeeSkillProfileFilter {
  employee_id?: string;
  skill_id?: string;
}

// --- Resources ---

export interface CapacityResource {
  employee_id: string;
  full_name: string;
  department_id: string | null;
  department_name: string | null;
  cost_center_id: string | null;
  cost_center_name: string | null;
  weekly_contract_hours: number;
  fte_ratio: number;
  hourly_cost: number;
  country: string | null;
  region: string | null;
}

// --- Allocations ---

export interface ResourceAllocation {
  id: string;
  project_id: string | null;
  project_name: string | null;
  wbs_node_id: string | null;
  wbs_node_title: string | null;
  employee_id: string;
  employee_name: string;
  role_id: string | null;
  booking_type: BookingType;
  start_date: string;
  end_date: string;
  allocated_hours_per_day: number;
  total_allocated_hours: number;
  is_billable: boolean;
  crm_opportunity_id: string | null;
  crm_opportunity_name: string | null;
  is_overloaded: boolean;
  peak_load_percent: number;
  notes: string | null;
}

export interface AllocationFilter {
  from: string;
  to: string;
  employee_id?: string;
  project_id?: string;
  booking_type?: BookingType;
}

export interface AllocationPayload {
  project_id?: string | null;
  wbs_node_id?: string | null;
  employee_id: string;
  role_id?: string | null;
  booking_type: BookingType;
  start_date: string;
  end_date: string;
  allocated_hours_per_day: number;
  is_billable?: boolean;
  crm_opportunity_id?: string | null;
  notes?: string | null;
  allow_overload?: boolean;
  /** Skills the booking needs: a lapsed or missing skill or certificate comes back as a warning. */
  required_skill_ids?: string[];
}

export interface ConvertToHardPayload {
  project_id?: string | null;
  wbs_node_id?: string | null;
}

export interface RebalancePayload {
  strategy: RebalanceStrategy;
  employee_id?: string;
  start_date?: string;
  end_date?: string;
  split_date?: string;
  shift_days?: number;
  allocated_hours_per_day?: number;
}

export interface OverloadWeek {
  week_start: string;
  load_percent: number;
}

export interface OverloadSummary {
  is_overloaded: boolean;
  peak_load_percent: number;
  weeks: OverloadWeek[];
}

/** Result of every allocation mutation: all the affected rows, the overload verdict and the soft warnings. */
export interface AllocationMutationResult {
  allocation: ResourceAllocation;
  allocations: ResourceAllocation[];
  overload: OverloadSummary;
  warnings: PlanningIssue[];
}

// --- Capacity heatmap ---

export interface CapacityThresholds {
  yellow: number;
  red: number;
}

export interface CapacityCell {
  period_start: string;
  contractual_hours: number;
  leave_and_holiday_hours: number;
  net_available_hours: number;
  hard_booked_hours: number;
  soft_booked_hours: number;
  billable_booked_hours: number;
  internal_booked_hours: number;
  load_percent: number;
  band: CapacityBand;
  is_overloaded: boolean;
}

export interface CapacityRow {
  employee_id: string;
  employee_name: string;
  department_id: string | null;
  department_name: string | null;
  cost_center_id: string | null;
  weekly_contract_hours: number;
  cells: CapacityCell[];
}

export interface CapacityHeatmap {
  from: string;
  to: string;
  granularity: HeatmapGranularity;
  thresholds: CapacityThresholds;
  periods: string[];
  rows: CapacityRow[];
}

export interface HeatmapFilter {
  from: string;
  to: string;
  granularity: HeatmapGranularity;
  department_id?: string;
  employee_ids?: string[];
}

// --- Candidate matching ---

export interface SkillRequirement {
  skill_id: string;
  min_level: number;
}

export interface CandidateSearchPayload {
  start_date: string;
  end_date: string;
  allocated_hours_per_day: number;
  requirements: SkillRequirement[];
  project_id?: string | null;
  wbs_node_id?: string | null;
  department_id?: string | null;
  require_valid_certificates?: boolean;
  include_ineligible?: boolean;
  limit?: number;
}

export interface MatchedSkill {
  skill_id: string;
  skill_name: string;
  level: number;
  min_level: number;
  valid_until_date: string | null;
  certification_status: CertificationStatus;
}

export interface CandidateBlocker {
  code: string;
  skill_id: string | null;
  params?: Record<string, string | number | boolean | null>;
}

export interface ResourceCandidate {
  employee_id: string;
  employee_name: string;
  department_name: string | null;
  score: number;
  eligible: boolean;
  matched_skills: MatchedSkill[];
  blockers: CandidateBlocker[];
  available_hours: number;
  requested_hours: number;
  residual_hours_per_day: number;
  peak_load_after_percent: number;
  hourly_cost: number;
}

// --- Billable utilization ---

export interface UtilizationRow {
  key_id: string | null;
  key_name: string;
  net_available_hours: number;
  billable_committed_hours: number;
  billable_booked_hours: number;
  internal_booked_hours: number;
  tentative_booked_hours: number;
  actual_billable_percent: number;
  forecast_billable_percent: number;
  target_percent: number;
  gap_percent: number;
  status: UtilizationStatus;
}

export interface UtilizationReport {
  from: string;
  to: string;
  group_by: UtilizationGroupBy;
  default_target_percent: number;
  rows: UtilizationRow[];
  totals: UtilizationRow;
}

export interface UtilizationTarget {
  id: string;
  department_id: string | null;
  cost_center_id: string | null;
  target_percent: number;
}

export interface UtilizationTargetPayload {
  department_id?: string | null;
  cost_center_id?: string | null;
  target_percent: number;
}
