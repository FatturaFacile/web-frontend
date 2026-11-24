/**
 * Mod 155 — Marketing Automation, Newsletter DEM, RFM segmentation and omnichannel campaigns with ROI tracking.
 * Wire models of `/api/v1/marketing-automation`. Every label, preset and template text is served by the API.
 */

export type MarketingLocale = 'it' | 'de' | 'fr' | 'en';
export type CampaignStatus =
  'draft' | 'scheduled' | 'active' | 'paused' | 'completed' | 'archived';
export type CampaignChannel =
  'email_dem' | 'whatsapp_marketing' | 'sms_promo' | 'multi_channel_journey';
export type CampaignTrigger =
  | 'scheduled_broadcast'
  | 'abandoned_cart'
  | 'customer_dormant_60_days'
  | 'warranty_expiring'
  | 'post_fair_lead_followup';
export type AttributionModel = 'first_touch' | 'last_touch';
export type MailProviderCode = 'smtp' | 'ses' | 'sendgrid' | 'mailgun' | 'infomaniak';
export type RfmLabelCode =
  'champions' | 'loyal' | 'promising' | 'new_customers' | 'at_risk' | 'hibernating' | 'lost';
export type JourneyStepType =
  'send_email' | 'send_whatsapp' | 'send_sms' | 'wait' | 'condition' | 'crm_task' | 'end';
export type JourneyConditionType =
  'opened' | 'not_opened' | 'clicked' | 'ordered' | 'not_ordered' | 'clicked_not_ordered';
export type EmailBlockType =
  'heading' | 'text' | 'image' | 'button' | 'divider' | 'spacer' | 'product' | 'html';
export type RoiState = 'computed' | 'no_cost' | 'no_revenue';
export type BlueprintKind = 'segment_preset' | 'email_template' | 'journey' | 'text';

export const MARKETING_LOCALES: readonly MarketingLocale[] = ['it', 'de', 'fr', 'en'];
export const RFM_LABELS: readonly RfmLabelCode[] = [
  'champions',
  'loyal',
  'promising',
  'new_customers',
  'at_risk',
  'hibernating',
  'lost',
];
export const CAMPAIGN_CHANNELS: readonly CampaignChannel[] = [
  'email_dem',
  'whatsapp_marketing',
  'sms_promo',
  'multi_channel_journey',
];
export const CAMPAIGN_TRIGGERS: readonly CampaignTrigger[] = [
  'scheduled_broadcast',
  'abandoned_cart',
  'customer_dormant_60_days',
  'warranty_expiring',
  'post_fair_lead_followup',
];
export const MAIL_PROVIDERS: readonly MailProviderCode[] = [
  'smtp',
  'ses',
  'sendgrid',
  'mailgun',
  'infomaniak',
];
export const JOURNEY_STEP_TYPES: readonly JourneyStepType[] = [
  'send_email',
  'send_whatsapp',
  'send_sms',
  'wait',
  'condition',
  'crm_task',
  'end',
];
export const JOURNEY_CONDITIONS: readonly JourneyConditionType[] = [
  'opened',
  'not_opened',
  'clicked',
  'ordered',
  'not_ordered',
  'clicked_not_ordered',
];
export const EMAIL_BLOCK_TYPES: readonly EmailBlockType[] = [
  'heading',
  'text',
  'image',
  'button',
  'divider',
  'spacer',
  'product',
];

/** `{data}` envelope of every successful call. */
export interface MarketingResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

/** A text per language: a missing language falls back to Italian, then English. */
export type MarketingLocalizedText = Partial<Record<MarketingLocale, string>>;

export interface SegmentCriteria {
  recency_days_min?: number | null;
  recency_days_max?: number | null;
  frequency_min?: number | null;
  frequency_max?: number | null;
  monetary_min?: number | null;
  monetary_max?: number | null;
  exclude_insolvent?: boolean;
  max_overdue_balance?: number | null;
  purchased_product_category_ids?: string[];
  purchased_skus?: string[];
  purchased_window_months?: { min?: number | null; max?: number | null };
  geographic_canton_or_province?: string[];
  locale?: MarketingLocale | null;
  rfm_labels?: RfmLabelCode[];
}

export interface DynamicCustomerSegment {
  id: string;
  code: string | null;
  name: string;
  description: string | null;
  criteria: SegmentCriteria;
  auto_refresh_hourly: boolean;
  eligible_contacts_count: number;
  excluded_insolvent_count: number;
  excluded_no_consent_count: number;
  rfm_breakdown: Partial<Record<RfmLabelCode, number>>;
  last_evaluated_at: string | null;
  created_at: string | null;
}

export interface SaveSegmentPayload {
  name: string;
  code?: string | null;
  description?: string | null;
  auto_refresh_hourly?: boolean;
  criteria: SegmentCriteria;
}

export interface SegmentPreview {
  eligible_contacts_count: number;
  excluded_insolvent_count: number;
  excluded_no_consent_count: number;
  rfm_breakdown: Partial<Record<RfmLabelCode, number>>;
}

export interface RfmMatrix {
  segment_id: string;
  eligible: number;
  excluded_insolvent: number;
  excluded_no_consent: number;
  last_evaluated_at: string | null;
  labels: { label: RfmLabelCode; count: number }[];
  cells: { r: number; f: number; count: number; monetary: number }[];
}

/** One block of the visual designer; every text prop is a map of language to text. */
export interface EmailBlock {
  id: string;
  type: EmailBlockType;
  props: Record<string, unknown>;
}

export interface MarketingEmailTemplate {
  subject?: MarketingLocalizedText;
  preheader?: MarketingLocalizedText;
  blocks?: EmailBlock[];
  mjml?: MarketingLocalizedText;
  variants?: Record<string, Partial<MarketingEmailTemplate>>;
  compiled?: Partial<Record<MarketingLocale, string>>;
}

export interface AbTestConfig {
  variants: { key: string; percent: number }[];
  winner_criteria?: 'open_rate' | 'click_rate' | 'revenue';
}

export interface CampaignMetric {
  campaign_id: string;
  sent_count: number;
  delivered_count: number;
  unique_opens_count: number;
  unique_clicks_count: number;
  unsubscribes_count: number;
  hard_bounces_count: number;
  soft_bounces_count: number;
  spam_complaints_count: number;
  attributed_quotes_count: number;
  attributed_quotes_value: number;
  attributed_sales_orders_count: number;
  attributed_net_revenue_amount: number;
  attributed_invoiced_amount: number;
  attributed_collected_amount: number;
  attributed_gross_margin_amount: number;
  campaign_cost: number;
  calculated_roi_percentage: number | null;
  roi_state: RoiState;
  currency: string;
  calculated_at: string | null;
}

export interface JourneyStep {
  id?: string;
  step_key: string;
  type: JourneyStepType;
  config: Record<string, unknown>;
  next_step_key: string | null;
  true_step_key: string | null;
  false_step_key: string | null;
  is_entry: boolean;
  pos_x: number;
  pos_y: number;
}

export interface MarketingCampaign {
  id: string;
  name: string;
  status: CampaignStatus;
  channel: CampaignChannel;
  trigger_type: CampaignTrigger;
  segment_id: string | null;
  sender_name: string | null;
  sender_email: string | null;
  sender_postal_address: string | null;
  provider: MailProviderCode;
  template_mjml_json: MarketingEmailTemplate;
  ab_test_split_variant_json: AbTestConfig | null;
  utm_campaign_code: string | null;
  attribution_model: AttributionModel;
  attribution_window_days: number;
  currency: string;
  campaign_cost: number;
  coupon_code: string | null;
  scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  steps?: JourneyStep[];
  metric?: CampaignMetric | null;
}

export interface SaveCampaignPayload {
  name?: string;
  channel?: CampaignChannel;
  trigger_type?: CampaignTrigger;
  segment_id?: string | null;
  sender_name?: string | null;
  sender_email?: string | null;
  sender_postal_address?: string | null;
  provider?: MailProviderCode;
  template_mjml_json?: MarketingEmailTemplate | null;
  ab_test_split_variant_json?: AbTestConfig | null;
  utm_campaign_code?: string | null;
  attribution_model?: AttributionModel;
  attribution_window_days?: number;
  currency?: string;
  campaign_cost?: number;
  coupon_code?: string | null;
}

export interface JourneyStepLog {
  id: string;
  enrollment_id: string;
  step_key: string;
  type: JourneyStepType;
  outcome: string;
  detail: string | null;
  executed_at: string;
}

export interface AbTestStats {
  criteria: string;
  winner: string | null;
  variants: {
    variant: string;
    sent: number;
    unique_opens: number;
    unique_clicks: number;
    open_rate: number;
    click_rate: number;
    revenue: number;
  }[];
}

export interface RoiDashboardRow {
  campaign_id: string;
  name: string;
  status: CampaignStatus;
  channel: CampaignChannel;
  trigger_type: CampaignTrigger;
  sent_count: number;
  delivered_count: number;
  unique_opens_count: number;
  unique_clicks_count: number;
  unsubscribes_count: number;
  hard_bounces_count: number;
  soft_bounces_count: number;
  spam_complaints_count: number;
  attributed_quotes_count: number;
  attributed_quotes_value: number;
  attributed_sales_orders_count: number;
  attributed_net_revenue_amount: number;
  attributed_invoiced_amount: number;
  attributed_collected_amount: number;
  attributed_gross_margin_amount: number;
  campaign_cost: number;
  calculated_roi_percentage: number | null;
  roi_state: RoiState;
}

export interface RoiDashboard {
  currency: string;
  totals: Omit<RoiDashboardRow, 'campaign_id' | 'name' | 'status' | 'channel' | 'trigger_type'>;
  campaigns: RoiDashboardRow[];
}

/** Seeded blueprint: segment preset, e-mail template, journey or text, with its copy per language. */
export interface MarketingBlueprint {
  id: string;
  kind: BlueprintKind;
  code: string;
  texts: Partial<Record<MarketingLocale, Record<string, string>>>;
  payload: Record<string, unknown>;
}

export interface CatalogProduct {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  image_url: string | null;
}

export interface TemplatePreview {
  subject: string;
  preheader: string;
  mjml: string;
  html: string;
  engine: string;
}

export interface MarketingConsent {
  contact_id: string;
  marketing_opt_in: boolean;
  profiling_opt_in: boolean;
  soft_opt_in_eligible: boolean;
  double_opt_in_confirmed: boolean;
  channel_preferences: Record<string, boolean>;
  locale: MarketingLocale;
  unsubscribed_at: string | null;
}

export interface UpdateConsentPayload {
  marketing_opt_in?: boolean;
  profiling_opt_in?: boolean;
  soft_opt_in_eligible?: boolean;
  double_opt_in_confirmed?: boolean;
  channel_preferences?: Record<string, boolean>;
  locale?: MarketingLocale;
  source?: string | null;
}

export interface ConsentEvent {
  id: string;
  contact_id: string;
  event_type: string;
  lawful_basis: string | null;
  strategy_code: string | null;
  source: string | null;
  ip_address: string | null;
  user_agent: string | null;
  occurred_at: string;
}

export interface ComplianceStrategyInfo {
  code: string;
  jurisdictions: string[];
  footer_keys: string[];
}

/** RFC 7807 body of a business-rule failure: `code` is the key of a seeded text. */
export interface MarketingProblem {
  code: string;
  status: number;
  context?: Record<string, unknown>;
}
