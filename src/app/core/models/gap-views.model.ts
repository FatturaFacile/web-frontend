/** CRM portal settings and Web-to-Lead endpoints (backend `Modules\ServiceManagement`, `App\Http\Controllers\Api\V1`, `Modules\CRM`). */

export interface CrmPortalSettings {
  portal_slug: string | null;
  custom_domain: string | null;
  logo_url: string | null;
  favicon_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  support_email: string | null;
  privacy_policy_url: string | null;
  require_otp: boolean;
  allow_partial_payments: boolean;
}

export const LEAD_WEBHOOK_PROVIDERS = [
  'generic',
  'wordpress',
  'webflow',
  'meta_ads',
  'linkedin',
] as const;
export type LeadWebhookProvider = (typeof LEAD_WEBHOOK_PROVIDERS)[number];

export const LEAD_WEBHOOK_DUPLICATE_STRATEGIES = ['merge', 'notify', 'create'] as const;
export type LeadWebhookDuplicateStrategy = (typeof LEAD_WEBHOOK_DUPLICATE_STRATEGIES)[number];

export interface LeadWebhookEndpoint {
  id: string;
  name: string;
  provider: LeadWebhookProvider;
  url: string;
  token: string;
  lead_source_id: string | null;
  duplicate_strategy: LeadWebhookDuplicateStrategy;
  field_map: Record<string, string> | null;
  is_active: boolean;
  received_count: number;
  last_received_at: string | null;
  /** Present only in the create / rotate response. */
  secret?: string;
}

export interface LeadWebhookEndpointPayload {
  name: string;
  provider: LeadWebhookProvider;
  duplicate_strategy: LeadWebhookDuplicateStrategy;
  field_map?: Record<string, string> | null;
}
