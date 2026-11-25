/**
 * Wire types of the customer satisfaction module (Mod 245), served under `/api/v1/customer-satisfaction` (staff) and
 * `/api/v1/public/surveys/{token}` (public, token-secured): NPS / CSAT / CES templates and trigger rules, the dispatch monitor, the
 * answers with their sentiment, the closed-loop detractor recovery queue and the ISO 9001:2015 § 9.1.2 analytics and reports.
 * Every label of these codes is in the dictionary the API serves (`customerSatisfaction.<group>.<code>`).
 */

export const CS_SURVEY_TYPES = ['nps', 'csat', 'ces'] as const;
export type CsSurveyType = (typeof CS_SURVEY_TYPES)[number];

export const CS_TRIGGER_EVENTS = [
  'ticket_closed',
  'order_delivered',
  'field_intervention_signed',
  'onboarding_completed',
  'semi_annual_active_client',
] as const;
export type CsTriggerEvent = (typeof CS_TRIGGER_EVENTS)[number];

export const CS_CHANNELS = ['email', 'sms', 'whatsapp'] as const;
export type CsChannel = (typeof CS_CHANNELS)[number];

export const CS_DISPATCH_STATUSES = [
  'scheduled',
  'sent',
  'delivered',
  'responded',
  'throttled',
  'suppressed',
  'failed',
  'expired',
] as const;
export type CsDispatchStatus = (typeof CS_DISPATCH_STATUSES)[number];

export const CS_THROTTLE_REASONS = [
  'cooldown_active',
  'opt_out',
  'missing_contact',
  'invalid_event',
] as const;
export type CsThrottleReason = (typeof CS_THROTTLE_REASONS)[number];

export const CS_BANDS = [
  'promoter',
  'passive',
  'detractor',
  'satisfied',
  'neutral',
  'dissatisfied',
] as const;
export type CsBand = (typeof CS_BANDS)[number];

export const CS_RECOVERY_STATUSES = [
  'open',
  'in_progress',
  'pending_customer',
  'resolved',
  'closed',
] as const;
export type CsRecoveryStatus = (typeof CS_RECOVERY_STATUSES)[number];

export const CS_RECOVERY_PRIORITIES = ['high', 'urgent'] as const;
export type CsRecoveryPriority = (typeof CS_RECOVERY_PRIORITIES)[number];

export const CS_GROUP_BY = [
  'overall',
  'department',
  'technician',
  'product_line',
  'branch',
] as const;
export type CsGroupBy = (typeof CS_GROUP_BY)[number];

export const CS_GRANULARITIES = ['day', 'week', 'month', 'quarter'] as const;
export type CsGranularity = (typeof CS_GRANULARITIES)[number];

export const CS_REPORT_FORMATS = ['json', 'csv', 'html'] as const;
export type CsReportFormat = (typeof CS_REPORT_FORMATS)[number];

export const CS_LOCALES = ['it-CH', 'de-CH', 'fr-CH', 'en', 'it-IT'] as const;
export type CsLocale = (typeof CS_LOCALES)[number];

export const CS_CHURN_RISKS = ['low', 'medium', 'high', 'critical'] as const;
export type CsChurnRisk = (typeof CS_CHURN_RISKS)[number];

export const CS_SENTIMENT_LABELS = ['positive', 'neutral', 'negative'] as const;
export type CsSentimentLabel = (typeof CS_SENTIMENT_LABELS)[number];

export const CS_FOLLOW_UP_KEYS = ['low', 'mid', 'high'] as const;
export type CsFollowUpKey = (typeof CS_FOLLOW_UP_KEYS)[number];

export interface CsEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
  meta?: CsPageMeta;
}

export interface CsPageMeta {
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
}

export interface CsPage<T> {
  rows: T[];
  meta: CsPageMeta;
}

/** RFC 7807 problem the API answers a refusal with; `code` picks the dictionary key. */
export interface CsProblem {
  code?: string;
  detail?: string;
  errors?: Record<string, string[]>;
  params?: Record<string, unknown>;
}

export interface CsScale {
  min: number;
  max: number;
}

export interface CsMessageText {
  subject: string;
  body: string;
  one_click_label?: string | null;
}

export interface CsTriggerFilters {
  department_code?: string[];
  branch_code?: string[];
  product_line_code?: string[];
  customer_tier?: string[];
  min_amount?: number | null;
}

export interface CsDimensions {
  department_code?: string | null;
  product_line_code?: string | null;
  branch_code?: string | null;
}

export interface CsTemplate {
  id: string;
  code: string;
  name: string;
  description: string | null;
  survey_type: CsSurveyType;
  scale: CsScale;
  trigger_event: CsTriggerEvent;
  trigger_filters: CsTriggerFilters;
  priority: number;
  channels: CsChannel[];
  delay_hours: number;
  cooldown_days: number;
  detractor_threshold: number | null;
  effective_detractor_threshold: number;
  sla_hours: number;
  allow_voice_comment: boolean;
  messages: Record<string, CsMessageText>;
  follow_up_config: Partial<Record<CsFollowUpKey, Record<string, string>>>;
  dimensions: CsDimensions;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
}

export interface CsTemplatePayload {
  code: string;
  name: string;
  description?: string | null;
  survey_type: CsSurveyType;
  trigger_event: CsTriggerEvent;
  trigger_filters?: CsTriggerFilters;
  priority?: number;
  channels: CsChannel[];
  delay_hours?: number;
  cooldown_days?: number;
  detractor_threshold?: number | null;
  sla_hours?: number;
  allow_voice_comment?: boolean;
  messages?: Record<string, CsMessageText>;
  follow_up_config?: Partial<Record<CsFollowUpKey, Record<string, string>>>;
  dimensions?: CsDimensions;
  is_active?: boolean;
}

export interface CsResponse {
  id: string;
  survey_dispatch_id: string;
  survey_template_id: string;
  template_code?: string | null;
  customer_id: string;
  customer_name?: string | null;
  survey_type: CsSurveyType;
  score: number;
  normalized_band: CsBand;
  is_detractor: boolean;
  comment_text: string | null;
  has_voice: boolean;
  voice_duration_seconds: number | null;
  voice_transcript: string | null;
  sentiment_score: number | null;
  sentiment_label: CsSentimentLabel | null;
  sentiment_topics: string[];
  department_code: string | null;
  technician_id: string | null;
  product_line_code: string | null;
  branch_code: string | null;
  submitted_via: string;
  locale: string | null;
  initial_clicked_at: string;
  comment_updated_at: string | null;
  recovery_case_id?: string | null;
}

export interface CsDispatch {
  id: string;
  survey_template_id: string;
  template_code?: string | null;
  survey_type?: CsSurveyType | null;
  customer_id: string;
  customer_name?: string | null;
  trigger_event: CsTriggerEvent;
  source_entity_type: string | null;
  source_entity_id: string | null;
  channel: CsChannel;
  locale: string;
  status: CsDispatchStatus;
  throttle_reason: CsThrottleReason | null;
  scheduled_for: string | null;
  sent_at: string | null;
  responded_at: string | null;
  metadata: Record<string, unknown>;
  response?: CsResponse | null;
  created_at: string | null;
}

export interface CsRecoveryCase {
  id: string;
  survey_response_id: string;
  customer_id: string;
  customer_name?: string | null;
  account_manager_name?: string | null;
  support_lead_name?: string | null;
  assigned_account_manager_id: string | null;
  assigned_support_lead_id: string | null;
  crm_task_id: string | null;
  priority: CsRecoveryPriority;
  status: CsRecoveryStatus;
  next_statuses: CsRecoveryStatus[];
  sla_due_at: string;
  sla_breached: boolean;
  first_contacted_at: string | null;
  resolved_at: string | null;
  churn_risk_updated: boolean;
  previous_churn_risk: CsChurnRisk | null;
  new_churn_risk: CsChurnRisk | null;
  resolution_summary: string | null;
  root_cause_code: string | null;
  response?: CsResponse;
  created_at: string | null;
}

export interface CsTransitionPayload {
  status: CsRecoveryStatus;
  root_cause_code?: string | null;
  resolution_summary?: string | null;
}

export interface CsAssignPayload {
  assigned_account_manager_id: string | null;
  assigned_support_lead_id: string | null;
}

export interface CsMember {
  id: string;
  name: string;
}

export interface CsLookups {
  survey_types: CsSurveyType[];
  scales: Record<CsSurveyType, CsScale & { detractor_threshold: number }>;
  trigger_events: CsTriggerEvent[];
  channels: CsChannel[];
  dispatch_statuses: CsDispatchStatus[];
  throttle_reasons: CsThrottleReason[];
  bands: CsBand[];
  recovery_statuses: CsRecoveryStatus[];
  recovery_priorities: CsRecoveryPriority[];
  group_by: CsGroupBy[];
  locales: CsLocale[];
  root_causes: string[];
  members: CsMember[];
}

// --- Analytics ---

export interface CsNpsKpi {
  responses: number;
  promoters: number;
  passives: number;
  detractors: number;
  promoters_pct: number;
  passives_pct: number;
  detractors_pct: number;
  score: number | null;
}

export interface CsCsatKpi {
  responses: number;
  positive: number;
  positive_pct: number | null;
  average: number | null;
}

export interface CsCesKpi {
  responses: number;
  low_effort: number;
  low_effort_rate: number | null;
  average: number | null;
}

export interface CsKpis {
  total: number;
  nps: CsNpsKpi;
  csat: CsCsatKpi;
  ces: CsCesKpi;
}

export interface CsClosedLoop {
  total: number;
  open: number;
  resolved: number;
  resolution_rate: number | null;
  sla_evaluated: number;
  sla_compliant: number;
  sla_compliance: number | null;
  open_overdue: number;
}

export interface CsOverview {
  period: { from: string; to: string };
  kpis: CsKpis;
  response_rate: { sent: number; responded: number; rate: number | null };
  closed_loop: CsClosedLoop;
}

export interface CsBreakdownRow extends CsKpis {
  key: string | null;
  label: string | null;
}

export interface CsTrendRow extends CsKpis {
  bucket: string;
}

export interface CsSentiment {
  analyzed: number;
  average_score: number | null;
  labels: Record<CsSentimentLabel, number>;
  topics: { topic: string; count: number }[];
  keywords: { keyword: string; count: number }[];
}

export interface CsAnalyticsFilters {
  from?: string;
  to?: string;
  survey_type?: CsSurveyType | '';
  department_code?: string;
  technician_id?: string;
  product_line_code?: string;
  branch_code?: string;
}

export interface CsReport {
  id: string;
  title: string;
  period_from: string;
  period_to: string;
  group_by: CsGroupBy;
  filters: CsAnalyticsFilters;
  metrics_snapshot?: {
    standard: string;
    generated_at: string;
    overview: CsOverview;
    breakdown: CsBreakdownRow[];
    trend: CsTrendRow[];
    sentiment: CsSentiment;
    root_causes: { root_cause_code: string; count: number }[];
  };
  headline: {
    nps: number | null;
    csat_pct: number | null;
    ces_average: number | null;
    sla_compliance: number | null;
  };
  management_review_notes: string | null;
  generated_by_user_id: string | null;
  exported_format: string | null;
  created_at: string | null;
}

export interface CsReportPayload {
  title?: string;
  group_by?: CsGroupBy;
  filters?: CsAnalyticsFilters;
  management_review_notes?: string | null;
}

export interface CsListFilters {
  q?: string;
  page?: number;
  per_page?: number;
  survey_type?: CsSurveyType | '';
  trigger_event?: CsTriggerEvent | '';
  dispatch_status?: CsDispatchStatus | '';
  status?: CsRecoveryStatus | '';
  priority?: CsRecoveryPriority | '';
  open_only?: boolean;
  is_detractor?: boolean;
  customer_id?: string;
  from?: string;
  to?: string;
}

// --- Public landing page ---

export interface CsPublicSurvey {
  survey_type: CsSurveyType;
  scale: CsScale;
  locale: string;
  answered: boolean;
  score: number | null;
  band: CsBand | null;
  prompt: string | null;
  prompts: Record<CsFollowUpKey, string | null>;
  allow_voice_comment: boolean;
  has_comment: boolean;
  voice_max_kb: number;
}

export interface CsFeedbackPayload {
  comment_text?: string;
  voice?: Blob | File | null;
  voice_duration_seconds?: number | null;
  voice_transcript?: string | null;
}
