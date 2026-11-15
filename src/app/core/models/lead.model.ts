import { QueryFilterParams } from './api.models';

/**
 * Lead management and scoring (GH-194, Mod 034).
 * Field names mirror the backend `Modules\CRM` contract exactly.
 */

export type LeadRating = 'cold' | 'warm' | 'hot';

export const LEAD_RATINGS: readonly LeadRating[] = ['cold', 'warm', 'hot'];

export type LeadSort = 'score' | '-score' | 'created_at';

export interface LeadScoreBreakdownItem {
  rule_id: string | null;
  code: string;
  points: number;
  name?: string | null;
}

export interface LeadSourceSummary {
  id: string;
  code?: string | null;
  name: string;
}

export interface Lead {
  id: string;
  first_name: string | null;
  last_name: string | null;
  full_name?: string | null;
  company_name: string | null;
  title?: string | null;
  email: string | null;
  phone: string | null;
  phone_e164?: string | null;
  website?: string | null;
  country?: string | null;
  status: string | null;
  score: number | null;
  rating: LeadRating | null;
  score_breakdown?: LeadScoreBreakdownItem[] | null;
  vat_number?: string | null;
  industry?: string | null;
  employee_count?: number | null;
  state_region?: string | null;
  product_line?: string | null;
  estimated_budget?: number | null;
  lead_source?: LeadSourceSummary | null;
  assigned_user_id?: string | null;
  last_activity_at?: string | null;
  merged_into_lead_id?: string | null;
  converted_at?: string | null;
  converted_account_id?: string | null;
  converted_contact_id?: string | null;
  converted_opportunity_id?: string | null;
  tags?: string[] | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface LeadFilterParams extends QueryFilterParams {
  rating?: LeadRating;
  assigned_user_id?: string;
  source?: string;
  min_score?: number;
  sort?: LeadSort;
  status?: string;
}

// --- Activity events -------------------------------------------------------

export type LeadActivityEventType =
  | 'email_opened'
  | 'link_clicked'
  | 'catalog_downloaded'
  | 'site_visit'
  | 'form_submitted'
  | 'call_made'
  | 'custom';

export const LEAD_ACTIVITY_EVENT_TYPES: readonly LeadActivityEventType[] = [
  'email_opened',
  'link_clicked',
  'catalog_downloaded',
  'site_visit',
  'form_submitted',
  'call_made',
  'custom',
];

export interface LeadActivityEvent {
  id: string;
  lead_id: string;
  type: LeadActivityEventType;
  occurred_at: string;
  metadata?: Record<string, unknown> | null;
  external_id?: string | null;
  created_at?: string | null;
}

export interface LeadActivityEventPayload {
  type: LeadActivityEventType;
  occurred_at?: string;
  metadata?: Record<string, unknown>;
  external_id?: string;
}

// --- Scoring rules and settings -------------------------------------------

export type LeadScoringCategory = 'demographic' | 'behavioral';

export type LeadScoringOperator =
  | 'eq'
  | 'in'
  | 'gte'
  | 'lte'
  | 'between'
  | 'contains'
  | 'exists';

export const LEAD_SCORING_OPERATORS: readonly LeadScoringOperator[] = [
  'eq',
  'in',
  'gte',
  'lte',
  'between',
  'contains',
  'exists',
];

export interface LeadScoringRule {
  id: string;
  code: string;
  name: string;
  category: LeadScoringCategory;
  field?: string | null;
  event_type?: LeadActivityEventType | null;
  operator: LeadScoringOperator;
  value: unknown;
  points: number;
  max_applications?: number | null;
  decay_days?: number | null;
  is_active: boolean;
}

export type LeadScoringRulePayload = Omit<LeadScoringRule, 'id'>;

export type LeadDedupMode = 'auto_merge' | 'notify';

export interface LeadSetting {
  warm_threshold: number;
  hot_threshold: number;
  auto_qualify_threshold: number;
  dedup_mode: LeadDedupMode;
  dedup_levenshtein_max: number;
  dedup_similarity_min: number;
  default_country: string;
}

export interface LeadScorePreviewPayload {
  lead_id?: string;
  lead?: Partial<Lead>;
}

export interface LeadScorePreview {
  score: number;
  rating: LeadRating;
  breakdown: LeadScoreBreakdownItem[];
}

// --- Routing rules ---------------------------------------------------------

export type LeadRoutingStrategy = 'round_robin' | 'fixed';

export interface LeadRoutingConditions {
  countries?: string[];
  regions?: string[];
  product_lines?: string[];
  employee_min?: number | null;
  employee_max?: number | null;
  ratings?: LeadRating[];
}

export interface LeadRoutingRule {
  id: string;
  name: string;
  priority: number;
  conditions: LeadRoutingConditions;
  strategy: LeadRoutingStrategy;
  assignee_user_ids: string[];
  is_default: boolean;
  is_active: boolean;
}

export type LeadRoutingRulePayload = Omit<LeadRoutingRule, 'id'>;

// --- Lead sources ----------------------------------------------------------

export type LeadSourceType =
  | 'web_form'
  | 'wordpress'
  | 'webflow'
  | 'meta_lead_ads'
  | 'linkedin_lead_gen'
  | 'manual'
  | 'csv';

export const LEAD_SOURCE_TYPES: readonly LeadSourceType[] = [
  'web_form',
  'wordpress',
  'webflow',
  'meta_lead_ads',
  'linkedin_lead_gen',
  'manual',
  'csv',
];

export interface LeadSource {
  id: string;
  code?: string | null;
  name: string;
  type: LeadSourceType;
  is_active?: boolean;
  webhook_url?: string | null;
  api_key_prefix?: string | null;
  last_received_at?: string | null;
  allowed_origins?: string[] | null;
  field_mapping?: Record<string, string> | null;
  default_product_line?: string | null;
  /** Returned only once, by create and rotate-secret. Never persist it. */
  webhook_secret?: string | null;
  /** Returned only once, by create and rotate-secret. Never persist it. */
  api_key?: string | null;
}

export interface LeadSourcePayload {
  name: string;
  code?: string | null;
  type: LeadSourceType;
  is_active?: boolean;
  allowed_origins?: string[];
  field_mapping?: Record<string, string>;
  default_product_line?: string | null;
}

/** One-shot credentials shown after create / rotate-secret. */
export interface LeadSourceSecrets {
  source_name: string;
  webhook_url: string | null;
  webhook_secret: string | null;
  api_key: string | null;
}

// --- Duplicates ------------------------------------------------------------

export type LeadDuplicateMatchType = 'email' | 'phone' | 'vat' | 'company_fuzzy';
export type LeadDuplicateStatus = 'pending' | 'merged' | 'dismissed';

export interface LeadDuplicateCandidateRef {
  type: 'lead' | 'contact' | 'account' | string;
  id: string;
  summary?: Record<string, unknown> | string | null;
}

export interface LeadDuplicateCandidate {
  id: string;
  lead: Lead;
  candidate: LeadDuplicateCandidateRef;
  match_type: LeadDuplicateMatchType;
  confidence: number;
  status: LeadDuplicateStatus;
}

export interface LeadDuplicateFilterParams extends QueryFilterParams {
  status?: LeadDuplicateStatus;
}

export type LeadMergeSurvivor = 'lead' | 'candidate';

export interface LeadMergePayload {
  survivor: LeadMergeSurvivor;
  field_choices?: Record<string, LeadMergeSurvivor>;
}

// --- Conversion ------------------------------------------------------------

export interface LeadConvertPayload {
  existing_contact_id?: string | null;
  existing_account_id?: string | null;
  new_account_name?: string | null;
  account_tier?: string | null;
  contact_role?: string | null;
  create_opportunity?: boolean;
  opportunity_name?: string | null;
  opportunity_amount?: number | null;
  expected_close_date?: string | null;
  owner_user_id?: string | null;
}

export interface LeadConvertResult {
  account: { id: string; name: string } & Record<string, unknown>;
  contact_id: string;
  opportunity: ({ id: string; name: string } & Record<string, unknown>) | null;
}

export function leadDisplayName(lead: Pick<Lead, 'full_name' | 'first_name' | 'last_name' | 'company_name' | 'email'>): string {
  const person = lead.full_name || [lead.first_name, lead.last_name].filter(Boolean).join(' ');
  return person || lead.company_name || lead.email || '-';
}
