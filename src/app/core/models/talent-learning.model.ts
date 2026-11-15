/** Talent and learning module (succession, compensation planning, LMS, engagement surveys). */

export interface TalentResponse<T> {
  data: T;
  meta?: { current_page: number; last_page: number; per_page: number; total: number };
}

export type TalentCriticality = 'low' | 'medium' | 'high' | 'critical';
export type TalentLevel = 'low' | 'medium' | 'high';
export type TalentReadiness = 'ready_now' | 'ready_1_2_years' | 'ready_3_plus_years';
export type TalentCoverage = 'covered' | 'at_risk' | 'uncovered';

export const TALENT_CRITICALITIES: readonly TalentCriticality[] = ['low', 'medium', 'high', 'critical'];
export const TALENT_LEVELS: readonly TalentLevel[] = ['low', 'medium', 'high'];
export const TALENT_READINESS_LEVELS: readonly TalentReadiness[] = ['ready_now', 'ready_1_2_years', 'ready_3_plus_years'];

/** Employee of the HR directory as exposed by the module lookup. */
export interface TalentEmployee {
  id: string;
  full_name: string;
  employee_number: string | null;
  position_id: string | null;
  position_title: string | null;
  department_id: string | null;
  department_name: string | null;
  is_active: boolean;
}

export interface TalentPositionLookup {
  id: string;
  code: string | null;
  title: string;
  department_id: string | null;
  department_name: string | null;
}

export interface TalentSuccessionCandidate {
  id: string;
  succession_position_id: string;
  employee_id: string;
  employee?: TalentEmployee | null;
  readiness: TalentReadiness;
  risk_of_loss: TalentLevel;
  potential: TalentLevel;
  ranking: number;
  development_plan: string | null;
}

export interface TalentSuccessionCandidateRequest {
  employee_id?: string;
  readiness: TalentReadiness;
  risk_of_loss: TalentLevel;
  potential: TalentLevel;
  ranking: number;
  development_plan: string | null;
}

export interface TalentSuccessionPosition {
  id: string;
  position_id: string | null;
  title: string;
  incumbent_employee_id: string | null;
  incumbent?: TalentEmployee | null;
  criticality: TalentCriticality;
  vacancy_risk: TalentLevel;
  status: 'active' | 'archived';
  notes: string | null;
  coverage?: TalentCoverage;
  candidates?: TalentSuccessionCandidate[];
}

export interface TalentSuccessionPositionRequest {
  position_id: string | null;
  title: string | null;
  incumbent_employee_id: string | null;
  criticality: TalentCriticality;
  vacancy_risk: TalentLevel;
  status: 'active' | 'archived';
  notes: string | null;
}

export type TalentCycleStatus = 'draft' | 'open' | 'closed';
export type TalentProposalStatus = 'draft' | 'submitted' | 'approved' | 'rejected';

export interface TalentGuideline {
  performance_rating: number;
  min_percent: string;
  max_percent: string;
}

export interface TalentCompCycle {
  id: string;
  name: string;
  fiscal_year: number;
  currency: string;
  starts_on: string;
  ends_on: string;
  effective_on: string;
  status: TalentCycleStatus;
  closed_at: string | null;
  notes: string | null;
  guidelines?: TalentGuideline[];
}

export interface TalentCompCycleRequest {
  name: string;
  fiscal_year: number;
  currency: string;
  starts_on: string;
  ends_on: string;
  effective_on: string;
  notes: string | null;
}

export interface TalentBudgetPool {
  id: string;
  cycle_id: string;
  name: string;
  department_id: string | null;
  budget_amount: string;
  notes: string | null;
}

export interface TalentBudgetPoolRequest {
  cycle_id?: string;
  name: string;
  budget_amount: string;
}

export interface TalentCycleSummaryPool {
  pool_id: string;
  name: string;
  budget_amount: string;
  committed_amount: string;
  approved_amount: string;
  remaining_amount: string;
  utilization_percent: number;
  proposals_count: number;
}

export interface TalentCycleSummary {
  cycle_id: string;
  currency: string;
  budget_amount: string;
  committed_amount: string;
  approved_amount: string;
  remaining_amount: string;
  approved_increase_percent: number;
  proposals_by_status: Record<TalentProposalStatus, number>;
  exceptions_count: number;
  pools: TalentCycleSummaryPool[];
}

export interface TalentMeritProposal {
  id: string;
  cycle_id: string;
  budget_pool_id: string;
  pool?: { id: string; name: string };
  employee_id: string;
  employee?: TalentEmployee | null;
  performance_rating: number;
  current_salary: string;
  increase_percent: string;
  increase_amount: string;
  new_salary: string;
  is_exception: boolean;
  justification: string | null;
  status: TalentProposalStatus;
  decision_note: string | null;
}

export interface TalentMeritProposalRequest {
  cycle_id?: string;
  employee_id?: string;
  budget_pool_id: string;
  performance_rating: number;
  increase_percent: string;
  justification: string | null;
}

export type TalentDelivery = 'online' | 'classroom' | 'blended';
export type TalentCourseStatus = 'draft' | 'published' | 'archived';
export const TALENT_DELIVERIES: readonly TalentDelivery[] = ['online', 'classroom', 'blended'];

export interface TalentCourse {
  id: string;
  code: string;
  title: string;
  description: string | null;
  delivery: TalentDelivery;
  duration_hours: string;
  is_mandatory: boolean;
  validity_months: number | null;
  pass_score: number | null;
  status: TalentCourseStatus;
}

export interface TalentCourseRequest {
  code: string;
  title: string;
  description: string | null;
  delivery: TalentDelivery;
  duration_hours: string;
  is_mandatory: boolean;
  validity_months: number | null;
  pass_score: number | null;
}

export interface TalentLearningPath {
  id: string;
  name: string;
  description: string | null;
  status: TalentCourseStatus;
  courses?: { position: number; course: { id: string; code: string; title: string; duration_hours: string; status: string } | null }[];
}

export interface TalentLearningPathRequest {
  name: string;
  description: string | null;
  course_ids: string[];
}

export interface TalentPathEnrolmentRequest {
  employee_ids: string[];
  due_on: string | null;
}

export type TalentEnrolmentStatus = 'enrolled' | 'in_progress' | 'completed' | 'cancelled';

export interface TalentEnrolment {
  id: string;
  course_id: string;
  course?: { id: string; code: string; title: string; is_mandatory: boolean; pass_score: number | null };
  employee_id: string;
  employee?: TalentEmployee | null;
  learning_path_id: string | null;
  status: TalentEnrolmentStatus;
  progress_percent: number;
  due_on: string | null;
  is_overdue: boolean;
  completed_at: string | null;
  score: string | null;
  certificate?: { id: string; certificate_number: string; expires_on: string | null } | null;
}

export interface TalentEnrolmentRequest {
  course_id: string;
  employee_id: string;
  due_on: string | null;
}

export type TalentComplianceState = 'compliant' | 'in_progress' | 'overdue' | 'expired' | 'missing';

export interface TalentComplianceCourse {
  course: { id: string; code: string; title: string };
  employees_total: number;
  compliant: number;
  in_progress: number;
  overdue: number;
  expired: number;
  missing: number;
  compliance_percent: number;
  non_compliant?: { employee: TalentEmployee; state: TalentComplianceState; due_on: string | null }[];
}

export interface TalentCompliance {
  courses: TalentComplianceCourse[];
  compliance_percent: number;
}

export type TalentSurveyStatus = 'draft' | 'open' | 'closed';
export type TalentQuestionType = 'rating' | 'enps' | 'text';
export const TALENT_QUESTION_TYPES: readonly TalentQuestionType[] = ['rating', 'enps', 'text'];

export interface TalentSurveyQuestion {
  id?: string;
  prompt: string;
  question_type: TalentQuestionType;
  is_required: boolean;
}

export interface TalentSurvey {
  id: string;
  title: string;
  description: string | null;
  status: TalentSurveyStatus;
  is_anonymous: boolean;
  min_group_size: number;
  opens_on: string | null;
  closes_on: string | null;
  has_answered?: boolean;
  questions?: (TalentSurveyQuestion & { id: string; position: number })[];
}

export interface TalentSurveyRequest {
  title: string;
  description: string | null;
  is_anonymous: boolean;
  min_group_size: number;
  opens_on: string | null;
  closes_on: string | null;
  questions: TalentSurveyQuestion[];
}

export interface TalentSurveyAnswerRequest {
  question_id: string;
  value: number | null;
  text: string | null;
}

export interface TalentSurveyQuestionResult {
  question_id: string;
  position: number;
  prompt: string;
  question_type: TalentQuestionType;
  answers_count: number;
  average?: number | null;
  distribution?: Record<string, number>;
  promoters?: number;
  passives?: number;
  detractors?: number;
  enps?: number | null;
  texts?: string[];
  segments?: { segment: string | null; is_other: boolean; answers_count: number; average?: number | null; enps?: number | null }[];
}

export interface TalentSurveyResults {
  survey_id: string;
  status: TalentSurveyStatus;
  is_anonymous: boolean;
  min_group_size: number;
  invited_count: number;
  responses_count: number;
  participation_rate_percent: number;
  results_visible: boolean;
  hidden_segments: boolean;
  questions: TalentSurveyQuestionResult[];
  segments: { segment: string | null; is_other: boolean; responses_count: number }[];
}

export interface TalentPlanningDashboard {
  succession: {
    positions_total: number;
    coverage: Record<TalentCoverage, number>;
    candidates_by_readiness: Record<TalentReadiness, number>;
    high_risk_of_loss_candidates: number;
    positions_needing_attention: { id: string; title: string; criticality: TalentCriticality; vacancy_risk: TalentLevel; coverage: TalentCoverage }[];
  };
  compensation: {
    cycles_total: number;
    open_cycles: number;
    current_cycle: (TalentCycleSummary & { id: string; name: string; status: TalentCycleStatus }) | null;
  };
}

export interface TalentLearningDashboard {
  learning: {
    courses_published: number;
    learning_paths_published: number;
    enrolments_by_status: Record<TalentEnrolmentStatus, number>;
    completion_rate_percent: number;
    overdue_enrolments: number;
    certificates_issued: number;
    certificates_expired: number;
    certificates_expiring_90_days: number;
    mandatory_compliance_percent: number;
  };
  engagement: {
    survey_id: string;
    title: string;
    status: TalentSurveyStatus;
    responses_count: number;
    participation_rate_percent: number;
    results_visible: boolean;
    enps: { score: number | null; promoters: number; passives: number; detractors: number } | null;
  } | null;
  surveys_open: number;
}

export interface TalentListFilters {
  status?: string;
  cycle_id?: string;
  budget_pool_id?: string;
  employee_id?: string;
  course_id?: string;
  coverage?: string;
  search?: string;
  per_page?: number;
}
