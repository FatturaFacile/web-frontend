/** FSM maintenance contracts, CRM portal settings and Web-to-Lead endpoints (backend `Modules\ServiceManagement`, `App\Http\Controllers\Api\V1`, `Modules\CRM`). */

export const FSM_CONTRACT_STATUSES = [
  'draft',
  'active',
  'suspended',
  'expired',
  'cancelled',
] as const;
export type FsmContractStatus = (typeof FSM_CONTRACT_STATUSES)[number];

export const FSM_COVERAGE_TYPES = [
  'labor_only',
  'parts_and_labor',
  'preventive_only',
  'full_comprehensive',
] as const;
export type FsmCoverageType = (typeof FSM_COVERAGE_TYPES)[number];

export interface FsmMaintenanceContract {
  id: string;
  customer_id: string;
  contract_number: string;
  title: string;
  start_date: string;
  end_date: string | null;
  status: FsmContractStatus;
  coverage_type: FsmCoverageType | null;
  included_visits_per_year: number | null;
  used_visits_current_year: number;
  callout_fee_amount: string;
  hourly_labor_rate: string | null;
  currency: string;
  notes: string | null;
}

export interface FsmMaintenanceContractPayload {
  customer_id: string;
  contract_number: string;
  title: string;
  start_date: string;
  end_date: string | null;
  status: FsmContractStatus;
  coverage_type: FsmCoverageType | null;
  included_visits_per_year: number | null;
  callout_fee_amount: number | null;
  hourly_labor_rate: number | null;
  currency: string | null;
  notes: string | null;
}

export type FsmPreventiveRunResult = Record<string, unknown>;

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
