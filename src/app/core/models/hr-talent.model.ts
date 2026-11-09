/** Talent, training, certifications and recruiting (`/hr/...`). */

export type ReviewType = 'annual' | 'mid_year' | 'probation' | 'promotion_readiness';
export type SuccessorReadiness = 'ready_now' | 'ready_1_2_years' | 'not_ready';

export interface PerformanceReviewResource {
  id: string;
  review_number: string;
  employee_id: string;
  review_period: string;
  review_type: ReviewType | string;
  overall_rating: number;
  goals_score: number;
  competencies_score: number;
  status: string;
  promotion_recommended: boolean;
  successor_readiness: SuccessorReadiness | string | null;
  is_locked: boolean;
  completed_at: string | null;
}

export interface SubmitPerformanceReviewPayload {
  employee_id: string;
  review_period: string;
  /** Decimal strings (scores). */
  goals_score: string;
  competencies_score: string;
  reviewer_employee_id?: string | null;
  review_type?: ReviewType | null;
  promotion_recommended?: boolean | null;
  recommended_job_grade_id?: string | null;
  recommended_salary_increase_percent?: string | null;
  successor_readiness?: SuccessorReadiness | null;
  strengths?: string | null;
  improvement_areas?: string | null;
  career_path_notes?: string;
}

export interface TrainingCourseResource {
  id: string;
  company_id: string | null;
  course_code: string;
  title: string;
  category: string;
  provider: string;
  duration_hours: string;
  cost_per_participant: string;
  currency: string;
  validity_months: number | null;
  is_mandatory_compliance: boolean;
  is_active: boolean;
}

/** The OpenAPI lacks a body for this operation: fields follow the controller. */
export interface TrainingCoursePayload {
  course_code: string;
  title: string;
  category?: string;
  provider?: string;
  duration_hours?: string;
  cost_per_participant?: string;
  validity_months?: number;
  is_mandatory_compliance?: boolean;
}

export interface TrainingRecordResource {
  id: string;
  enrollment_number: string;
  employee_id: string;
  course_id: string;
  status: string;
  assigned_date: string | null;
  completed_date: string | null;
  score: number | null;
  cost_amount: number;
  certificate_issued: boolean;
}

export interface AssignTrainingPayload {
  employee_id: string;
  course_id: string;
  scheduled_date?: string | null;
  /** Decimal string. */
  override_cost?: string | null;
  notes?: string | null;
}

export interface CertificationResource {
  id: string;
  company_id: string | null;
  employee_id: string | null;
  course_id: string | null;
  code: string;
  name: string;
  certificate_number: string | null;
  issuing_authority: string;
  issue_date: string | null;
  expiry_date: string | null;
  status: string;
  is_mandatory: boolean;
  renewal_alert_sent_at: string | null;
}

/** Recruiting resources are untyped in the OpenAPI: fields follow the server tables. */
export interface JobPostingRecord {
  id: string;
  title: string;
  description: string | null;
  department_id: string | null;
  position_id: string | null;
  location: string | null;
  employment_type: string;
  status: string;
  opens_on: string | null;
  closes_on: string | null;
}

export interface JobPostingPayload {
  title: string;
  description?: string | null;
  department_id?: string | null;
  position_id?: string | null;
  location?: string | null;
  employment_type?: string;
  status?: 'draft' | 'open';
  opens_on?: string | null;
  closes_on?: string | null;
}

export interface PipelineStageRecord {
  id: string;
  name: string;
  sort_order: number;
  outcome: string | null;
}

export interface JobApplicationRecord {
  id: string;
  job_posting_id: string;
  pipeline_stage_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  cover_note: string | null;
  source: string | null;
  status: string;
  consent_until: string | null;
  retention_until: string | null;
  decided_at: string | null;
  employee_id: string | null;
}

export interface JobApplicationPayload {
  job_posting_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string | null;
  cover_note?: string | null;
  source?: string | null;
  consent_until?: string | null;
}

export interface HireCandidatePayload {
  /** Decimal string. */
  base_annual_salary: string;
  hire_date: string;
  work_email?: string | null;
  department_id?: string | null;
  position_id?: string | null;
  employment_type?: string | null;
  contract_type?: string | null;
  /** Decimal string. */
  weekly_hours?: string | null;
  probation_months?: number | null;
  onboarding_template_id?: string | null;
}

export interface OnboardingTemplatePayload {
  name: string;
  tasks: { title: string; due_after_days?: number | null }[];
}

export interface OnboardingChecklistRecord {
  id: string;
  employee_id: string;
  onboarding_template_id: string | null;
  completed_at: string | null;
  tasks?: { id: string; title: string; due_on: string | null; completed_at: string | null }[];
}
