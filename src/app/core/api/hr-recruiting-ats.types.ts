/** Typed shapes of the recruiting ATS API (`/hr/recruiting/*`), derived from the backend FormRequests and Resources. */

export type AtsStage =
  | 'applied'
  | 'hr_screening'
  | 'technical_interview'
  | 'manager_interview'
  | 'offer_extended'
  | 'hired'
  | 'rejected';
export const ATS_STAGES: AtsStage[] = [
  'applied',
  'hr_screening',
  'technical_interview',
  'manager_interview',
  'offer_extended',
  'hired',
  'rejected',
];
export const ATS_INTERVIEW_STAGES: AtsStage[] = ['hr_screening', 'technical_interview', 'manager_interview'];

export type AtsLocale = 'it-CH' | 'de-CH' | 'fr-CH' | 'it-IT' | 'en';
export const ATS_LOCALES: AtsLocale[] = ['it-CH', 'de-CH', 'fr-CH', 'it-IT', 'en'];

export type AtsEmploymentType = 'full_time' | 'part_time' | 'contractor' | 'apprentice' | 'seasonal';
export const ATS_EMPLOYMENT_TYPES: AtsEmploymentType[] = ['full_time', 'part_time', 'contractor', 'apprentice', 'seasonal'];

export type AtsContractType = 'permanent' | 'fixed_term' | 'apprenticeship' | 'contractor' | 'internship';
export const ATS_CONTRACT_TYPES: AtsContractType[] = ['permanent', 'fixed_term', 'apprenticeship', 'contractor', 'internship'];

export type AtsRejectionReason = 'not_qualified' | 'salary_mismatch' | 'position_filled' | 'withdrawn' | 'no_show' | 'culture_fit' | 'other';
export const ATS_REJECTION_REASONS: AtsRejectionReason[] = [
  'not_qualified',
  'salary_mismatch',
  'position_filled',
  'withdrawn',
  'no_show',
  'culture_fit',
  'other',
];

export type AtsRecommendation = 'strong_hire' | 'hire' | 'no_hire';
export const ATS_RECOMMENDATIONS: AtsRecommendation[] = ['strong_hire', 'hire', 'no_hire'];

export type AtsApplicationSource = 'careers_page' | 'manual' | 'referral' | 'job_board';
export const ATS_SOURCES: AtsApplicationSource[] = ['manual', 'referral', 'job_board', 'careers_page'];

export type AtsOpeningStatus = 'draft' | 'published' | 'internal_only' | 'closed_filled' | 'cancelled';
export type AtsOfferStatus = 'draft' | 'sent' | 'signed' | 'declined' | 'expired' | 'cancelled';

export interface AtsTranslation {
  title?: string | null;
  description?: string | null;
  requirements?: string | null;
  benefits?: string | null;
}

export interface AtsSalaryRange {
  min?: number | null;
  max?: number | null;
  currency?: 'EUR' | 'CHF' | null;
}

export interface AtsJobOpening {
  id: string;
  reference: string;
  position_id: string;
  position_title: string | null;
  department_id: string | null;
  department_name: string | null;
  location_site: string;
  employment_type: AtsEmploymentType | string;
  openings_count: number;
  hires_count: number;
  salary_range_public: AtsSalaryRange | null;
  status: AtsOpeningStatus;
  published_languages: AtsLocale[];
  translations: Partial<Record<AtsLocale, AtsTranslation>>;
  published_at: string | null;
  closes_at: string | null;
  closed_at: string | null;
  applications_count: number;
}

/** POST/PUT /hr/recruiting/job-openings. */
export interface AtsJobOpeningPayload {
  position_id?: string;
  location_site?: string;
  employment_type?: AtsEmploymentType;
  openings_count?: number | null;
  salary_range_public?: AtsSalaryRange | null;
  published_languages?: AtsLocale[];
  translations?: Partial<Record<AtsLocale, AtsTranslation>>;
  closes_at?: string | null;
}

export interface AtsApplicationCard {
  id: string;
  job_opening_id: string;
  job_opening_title: string | null;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  stage: AtsStage;
  stage_entered_at: string | null;
  board_position: number;
  source: string;
  cv_parse_status: string;
  skills: string[];
  average_score: number | null;
  scorecards_count: number;
  privacy_consent_expires_at: string | null;
  is_anonymized: boolean;
  created_at: string | null;
}

export interface AtsCriterionScore {
  criterion: string;
  score: number;
  comment?: string | null;
}

export interface AtsScorecard {
  id: string;
  application_id: string;
  interviewer_name: string | null;
  stage: string;
  criteria_scores: AtsCriterionScore[];
  overall_score: number;
  recommendation: AtsRecommendation | string;
  notes: string | null;
  interviewed_at: string | null;
}

export interface AtsOffer {
  id: string;
  application_id: string;
  proposed_salary: number;
  currency: string;
  start_date: string;
  employment_type: string;
  contract_type: string;
  weekly_hours: number;
  probation_months: number;
  valid_until: string | null;
  status: AtsOfferStatus;
  signature_status: string;
  rendered_body: string;
  sent_at: string | null;
  signed_at: string | null;
  declined_at: string | null;
}

export interface AtsApplication extends AtsApplicationCard {
  cover_letter: string | null;
  notes: string | null;
  locale: string;
  cv: { file_name: string; mime_type: string; size_bytes: number; download_url: string } | null;
  extracted_profile: Record<string, unknown> | null;
  consent: { given_at: string | null; text_version: string | null; expires_at: string | null; extended_at: string | null };
  rejection: { reason_code: string; note: string | null } | null;
  history: { id: string; from_stage: string | null; to_stage: string; note: string | null; created_at: string | null }[];
  emails: { id: string; stage: string; subject: string; status: string; sent_at: string | null }[];
  offer: AtsOffer | null;
  hired_employee_id: string | null;
}

export interface AtsBoardStage {
  stage: AtsStage;
  label: string;
  enabled: boolean;
  count: number;
  applications: AtsApplicationCard[];
}

export interface AtsBoard {
  job_opening: AtsJobOpening;
  stages: AtsBoardStage[];
}

/** POST /hr/recruiting/applications/{id}/move. */
export interface AtsMovePayload {
  stage: AtsStage;
  board_position?: number | null;
  rejection_reason_code?: AtsRejectionReason | null;
  rejection_note?: string | null;
  send_email?: boolean;
  note?: string | null;
}

/** POST /hr/recruiting/applications/{id}/hire. */
export interface AtsHirePayload {
  hire_date?: string | null;
  work_email?: string | null;
  manager_id?: string | null;
  start_onboarding?: boolean;
}

/** POST /hr/recruiting/applications/{id}/scorecards. */
export interface AtsScorecardPayload {
  stage: AtsStage;
  criteria_scores: AtsCriterionScore[];
  recommendation: AtsRecommendation;
  notes?: string | null;
  interviewed_at?: string | null;
}

/** POST /hr/recruiting/applications/{id}/offer. */
export interface AtsOfferPayload {
  proposed_salary: number;
  currency?: 'EUR' | 'CHF';
  start_date: string;
  employment_type?: AtsEmploymentType;
  contract_type?: AtsContractType;
  weekly_hours?: number | null;
  probation_months?: number | null;
  valid_until?: string | null;
  send?: boolean;
}

export interface AtsEmailTemplate {
  stage: string;
  locale: string;
  subject: string;
  body: string;
  is_enabled: boolean;
}

export interface AtsEmailTemplatePayload {
  subject: string;
  body: string;
  is_enabled: boolean;
}

export interface AtsPipelineStageSetting {
  stage: AtsStage;
  enabled?: boolean;
  auto_email?: boolean;
  labels?: Partial<Record<AtsLocale, string | null>>;
}

export interface AtsSettings {
  careers: {
    enabled: boolean;
    slug: string | null;
    company_name: string | null;
    intro: Partial<Record<AtsLocale, string>>;
    privacy_notice: Partial<Record<AtsLocale, string>>;
    privacy_policy_url: string | null;
    consent_text_version: string;
  };
  retention: { default_months: number };
  pipeline: { stages: AtsPipelineStageSetting[] };
}

export interface AtsSettingsPayload {
  careers?: Partial<Omit<AtsSettings['careers'], 'company_name'>> & { company_name?: string | null };
  retention?: { default_months?: number };
  pipeline?: { stages?: AtsPipelineStageSetting[] };
}

/** POST /hr/recruiting/applications. */
export interface AtsApplicationPayload {
  job_opening_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string | null;
  cover_letter?: string | null;
  locale?: AtsLocale | null;
  source?: AtsApplicationSource | null;
  retention_months?: number | null;
}
