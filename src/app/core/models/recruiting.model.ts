import { LaravelPaginationMeta } from './api.models';

/*
 * Recruiting & ATS (Mod 070, FatturaFacile/FatturaFacile#273).
 * Types mirror the shared REST contract exactly (snake_case field names).
 */

// ---------------------------------------------------------------------------
// Envelopes (HR convention: `{ data }`, paginated lists add `meta`)
// ---------------------------------------------------------------------------

export interface RecruitingEnvelope<T> {
  data: T;
}

export interface RecruitingPaginated<T> {
  data: T[];
  meta: Pick<LaravelPaginationMeta, 'current_page' | 'last_page' | 'per_page' | 'total'> &
    Partial<LaravelPaginationMeta>;
}

/** 409 business-rule violation body. */
export interface RecruitingConflictError {
  message: string;
  error_code: RecruitingErrorCode;
}

// ---------------------------------------------------------------------------
// Enums (string-literal unions + const arrays for dropdowns)
// ---------------------------------------------------------------------------

export const JOB_OPENING_STATUSES = [
  'draft',
  'published',
  'internal_only',
  'closed_filled',
  'cancelled',
] as const;
export type JobOpeningStatus = (typeof JOB_OPENING_STATUSES)[number];

export const EMPLOYMENT_TYPES = [
  'full_time',
  'part_time',
  'contractor',
  'apprentice',
  'seasonal',
] as const;
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];

export const CONTRACT_TYPES = [
  'permanent',
  'fixed_term',
  'apprenticeship',
  'contractor',
  'internship',
] as const;
export type ContractType = (typeof CONTRACT_TYPES)[number];

export const RECRUITING_LOCALES = ['it-CH', 'de-CH', 'fr-CH', 'it-IT', 'en'] as const;
export type RecruitingLocale = (typeof RECRUITING_LOCALES)[number];

/** Pipeline order of all application stages. */
export const RECRUITING_STAGES = [
  'applied',
  'hr_screening',
  'technical_interview',
  'manager_interview',
  'offer_extended',
  'hired',
  'rejected',
] as const;
export type ApplicationStage = (typeof RECRUITING_STAGES)[number];

/** Stages reachable through `move` in forward order (excludes terminal stages). */
export const NON_TERMINAL_STAGES: readonly ApplicationStage[] = [
  'applied',
  'hr_screening',
  'technical_interview',
  'manager_interview',
  'offer_extended',
];

/** Stages that cannot be disabled in the pipeline settings. */
export const MANDATORY_STAGES: readonly ApplicationStage[] = ['applied', 'hired', 'rejected'];

/** Translation keys for every stage label. */
export const APPLICATION_STAGE_LABEL_KEYS: Record<ApplicationStage, string> = {
  applied: 'hr.recruiting.stages.applied',
  hr_screening: 'hr.recruiting.stages.hr_screening',
  technical_interview: 'hr.recruiting.stages.technical_interview',
  manager_interview: 'hr.recruiting.stages.manager_interview',
  offer_extended: 'hr.recruiting.stages.offer_extended',
  hired: 'hr.recruiting.stages.hired',
  rejected: 'hr.recruiting.stages.rejected',
};

export const SCORECARD_STAGES = [
  'hr_screening',
  'technical_interview',
  'manager_interview',
] as const;
export type ScorecardStage = (typeof SCORECARD_STAGES)[number];

export const RECOMMENDATIONS = ['strong_hire', 'hire', 'no_hire'] as const;
export type Recommendation = (typeof RECOMMENDATIONS)[number];

export const OFFER_STATUSES = [
  'draft',
  'sent',
  'signed',
  'declined',
  'expired',
  'cancelled',
] as const;
export type OfferStatus = (typeof OFFER_STATUSES)[number];

export const SIGNATURE_STATUSES = ['not_requested', 'pending', 'signed', 'declined'] as const;
export type SignatureStatus = (typeof SIGNATURE_STATUSES)[number];

export const CV_PARSE_STATUSES = [
  'pending',
  'parsed',
  'partial',
  'failed',
  'not_provided',
] as const;
export type CvParseStatus = (typeof CV_PARSE_STATUSES)[number];

export const REJECTION_REASON_CODES = [
  'not_qualified',
  'salary_mismatch',
  'position_filled',
  'withdrawn',
  'no_show',
  'culture_fit',
  'other',
] as const;
export type RejectionReasonCode = (typeof REJECTION_REASON_CODES)[number];

export const APPLICATION_SOURCES = ['careers_page', 'manual', 'referral', 'job_board'] as const;
export type ApplicationSource = (typeof APPLICATION_SOURCES)[number];

export const EMAIL_STATUSES = ['queued', 'sent', 'failed', 'skipped'] as const;
export type EmailStatus = (typeof EMAIL_STATUSES)[number];

export const ONBOARDING_STATUSES = ['started', 'not_available'] as const;
export type OnboardingStatus = (typeof ONBOARDING_STATUSES)[number];

export const RECRUITING_ERROR_CODES = [
  'invalid_stage_transition',
  'stage_disabled',
  'opening_not_open',
  'no_vacancy',
  'opening_not_publishable',
  'offer_not_signed',
  'offer_already_exists',
  'already_hired',
  'candidate_anonymized',
  'consent_expired',
  'duplicate_application',
] as const;
export type RecruitingErrorCode = (typeof RECRUITING_ERROR_CODES)[number];

export const RETENTION_MONTHS = [6, 12] as const;
export type RetentionMonths = (typeof RETENTION_MONTHS)[number];

/** Slug rule for the public careers page (3-60 chars, enforced separately). */
export const CAREERS_SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Placeholders supported by recruiting email templates. */
export const EMAIL_TEMPLATE_PLACEHOLDERS = [
  '{{candidate_name}}',
  '{{job_title}}',
  '{{company_name}}',
  '{{stage_label}}',
] as const;

export type LocalizedMap<T> = Partial<Record<RecruitingLocale, T>>;

// ---------------------------------------------------------------------------
// Resources
// ---------------------------------------------------------------------------

export interface SalaryRangePublic {
  min: number;
  max: number;
  currency: string;
  period: 'year';
}

export interface JobOpeningTranslation {
  title: string;
  description: string;
  requirements: string;
  benefits: string;
}

export interface JobOpening {
  id: string;
  reference: string;
  position_id: string;
  position_title: string;
  department_id: string | null;
  department_name: string | null;
  location_site: string;
  employment_type: EmploymentType;
  openings_count: number;
  hires_count: number;
  salary_range_public: SalaryRangePublic | null;
  status: JobOpeningStatus;
  published_languages: RecruitingLocale[];
  translations: LocalizedMap<JobOpeningTranslation>;
  published_at: string | null;
  closes_at: string | null;
  closed_at: string | null;
  applications_count: number;
  created_at: string;
  updated_at: string;
}

export interface CandidateApplicationCard {
  id: string;
  job_opening_id: string;
  job_opening_title: string;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  stage: ApplicationStage;
  stage_entered_at: string;
  board_position: number;
  source: ApplicationSource;
  cv_parse_status: CvParseStatus;
  skills: string[];
  average_score: number | null;
  scorecards_count: number;
  privacy_consent_expires_at: string | null;
  is_anonymized: boolean;
  created_at: string;
}

export interface CandidateCv {
  file_name: string;
  mime_type: string;
  size_bytes: number;
  download_url: string;
}

export interface ExtractedProfile {
  education: { institution: string; degree: string; period: string }[];
  experience: { company: string; role: string; period: string; summary: string }[];
  languages: { language: string; level: string }[];
  skills: string[];
}

export interface CandidateConsent {
  given_at: string;
  text_version: string;
  expires_at: string | null;
  extended_at: string | null;
}

export interface CandidateRejection {
  reason_code: RejectionReasonCode;
  note: string | null;
}

export interface CandidateHistoryEntry {
  id: string;
  from_stage: ApplicationStage | null;
  to_stage: ApplicationStage;
  actor_user_id: string | null;
  note: string | null;
  created_at: string;
}

export interface CandidateEmailLog {
  id: string;
  stage: ApplicationStage;
  subject: string;
  status: EmailStatus;
  sent_at: string | null;
}

export interface CandidateApplication extends CandidateApplicationCard {
  cover_letter: string | null;
  notes: string | null;
  locale: RecruitingLocale;
  cv: CandidateCv | null;
  extracted_profile: ExtractedProfile | null;
  consent: CandidateConsent;
  rejection: CandidateRejection | null;
  history: CandidateHistoryEntry[];
  emails: CandidateEmailLog[];
  offer: JobOfferLetter | null;
  hired_employee_id: string | null;
}

export interface CriterionScore {
  criterion: string;
  score: number;
  comment: string | null;
}

export interface InterviewScorecard {
  id: string;
  application_id: string;
  interviewer_user_id: string;
  interviewer_name: string;
  stage: ScorecardStage;
  criteria_scores: CriterionScore[];
  overall_score: number;
  recommendation: Recommendation;
  notes: string | null;
  interviewed_at: string;
  created_at: string;
  updated_at: string;
}

export interface JobOfferLetter {
  id: string;
  application_id: string;
  proposed_salary: number;
  currency: string;
  start_date: string;
  employment_type: EmploymentType;
  contract_type: ContractType;
  weekly_hours: number;
  probation_months: number;
  valid_until: string | null;
  status: OfferStatus;
  signature_status: SignatureStatus;
  signature_provider: string;
  signature_external_id: string | null;
  rendered_body: string;
  sent_at: string | null;
  signed_at: string | null;
  declined_at: string | null;
  created_at: string;
}

export interface EmailTemplate {
  stage: ApplicationStage;
  locale: RecruitingLocale;
  subject: string;
  body: string;
  is_enabled: boolean;
  is_default: boolean;
}

export interface PipelineStageSetting {
  stage: ApplicationStage;
  enabled: boolean;
  auto_email: boolean;
  labels: LocalizedMap<string>;
}

export interface RecruitingSettings {
  careers: {
    enabled: boolean;
    slug: string | null;
    company_name: string;
    intro: LocalizedMap<string>;
    privacy_notice: LocalizedMap<string>;
    privacy_policy_url: string | null;
    consent_text_version: string;
  };
  retention: { default_months: RetentionMonths };
  pipeline: { stages: PipelineStageSetting[] };
}

export interface RecruitingSettingsUpdate {
  careers?: Partial<RecruitingSettings['careers']>;
  retention?: RecruitingSettings['retention'];
  pipeline?: RecruitingSettings['pipeline'];
}

export interface BoardStageColumn {
  stage: ApplicationStage;
  label: string;
  enabled: boolean;
  count: number;
  applications: CandidateApplicationCard[];
}

export interface RecruitingBoard {
  job_opening: JobOpening;
  stages: BoardStageColumn[];
}

export interface HiredEmployeeSummary {
  id: string;
  employee_number: string;
  full_name: string;
  hire_date: string;
}

export interface HireResult {
  application: CandidateApplication;
  employee: HiredEmployeeSummary;
  job_opening: JobOpening;
  onboarding: { status: OnboardingStatus; checklist_id: string | null };
}

/** Minimal HR position option used by the opening editor (`GET /hr/positions`). */
export interface RecruitingPositionOption {
  id: string;
  title: string;
  department_id?: string | null;
  department_name?: string | null;
}

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------

export interface JobOpeningListParams {
  status?: JobOpeningStatus;
  department_id?: string;
  search?: string;
  page?: number;
  per_page?: number;
}

export interface JobOpeningPayload {
  position_id: string;
  location_site: string;
  employment_type: EmploymentType;
  openings_count?: number;
  salary_range_public?: SalaryRangePublic | null;
  published_languages: RecruitingLocale[];
  translations: LocalizedMap<JobOpeningTranslation>;
  closes_at?: string | null;
}

export type JobOpeningUpdatePayload = Partial<JobOpeningPayload>;

export interface CloseJobOpeningPayload {
  outcome: 'filled' | 'cancelled';
}

export interface ApplicationListParams {
  job_opening_id?: string;
  stage?: ApplicationStage;
  search?: string;
  consent_expiring_within_days?: number;
  page?: number;
  per_page?: number;
}

export interface ManualApplicationPayload {
  job_opening_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string | null;
  cover_letter?: string | null;
  locale?: RecruitingLocale;
  source?: ApplicationSource;
  retention_months?: RetentionMonths;
  cv?: File | null;
}

export interface UpdateApplicationPayload {
  notes?: string | null;
  phone?: string | null;
}

export interface MoveApplicationPayload {
  stage: Exclude<ApplicationStage, 'hired'>;
  board_position?: number;
  rejection_reason_code?: RejectionReasonCode;
  rejection_note?: string | null;
  send_email?: boolean;
  note?: string | null;
}

export interface ScorecardPayload {
  stage: ScorecardStage;
  criteria_scores: CriterionScore[];
  recommendation: Recommendation;
  notes?: string | null;
  interviewed_at?: string | null;
}

export interface OfferPayload {
  proposed_salary: number;
  currency?: string;
  start_date: string;
  employment_type?: EmploymentType;
  contract_type?: ContractType;
  weekly_hours?: number;
  probation_months?: number;
  valid_until?: string | null;
  send?: boolean;
}

export interface HirePayload {
  hire_date?: string;
  work_email?: string;
  manager_id?: string;
  start_onboarding?: boolean;
}

export interface EmailTemplateUpdatePayload {
  subject: string;
  body: string;
  is_enabled: boolean;
}

// ---------------------------------------------------------------------------
// Public careers portal
// ---------------------------------------------------------------------------

export interface PublicCareersPage {
  company_name: string;
  intro: string;
  privacy_notice: string;
  privacy_policy_url: string | null;
  consent_text_version: string;
  available_locales: RecruitingLocale[];
  retention_months: RetentionMonths;
}

export interface PublicJob {
  id: string;
  reference: string;
  title: string;
  description: string;
  requirements: string;
  benefits: string;
  department_name: string | null;
  location_site: string;
  employment_type: EmploymentType;
  salary_range_public: SalaryRangePublic | null;
  locale: RecruitingLocale;
  available_locales: RecruitingLocale[];
  published_at: string;
  closes_at: string | null;
  apply_url: string;
}

export interface PublicJobListParams {
  locale?: RecruitingLocale;
  department_id?: string;
  employment_type?: EmploymentType;
  location_site?: string;
  search?: string;
  page?: number;
  per_page?: number;
}

export interface PublicApplyPayload {
  first_name: string;
  last_name: string;
  email: string;
  phone?: string | null;
  cover_letter?: string | null;
  locale: RecruitingLocale;
  consent_accepted: boolean;
  consent_text_version: string;
  cv: File;
  /** Honeypot: always empty for humans. */
  website?: string;
}

export interface PublicApplyResult {
  reference: string;
  message: string;
}
