export type LeadRating = 'cold' | 'warm' | 'hot';

export type LeadStatus =
  | 'new'
  | 'contacting'
  | 'engaged'
  | 'qualified'
  | 'disqualified'
  | 'converted'
  | 'archived';

/** Lead as exchanged with `/crm/leads`. */
export interface LeadResource {
  id: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string;
  company_name: string | null;
  title: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  country: string;
  status: LeadStatus;
  score: number;
  rating: LeadRating;
  /** Localised label (Freddo / Tiepido / Caldo). */
  rating_label: string;
  score_breakdown: Record<string, number> | null;
  assigned_user_id: string | null;
  assigned_at: string | null;
  duplicate_of_id: string | null;
  vat_number: string | null;
  industry: string | null;
  region: string | null;
  product_line: string | null;
  company_size: number | null;
  estimated_revenue: string | null;
  estimated_budget: string | null;
  email_opens: number;
  catalog_downloads: number;
  site_visits: number;
  converted_account_id: string | null;
  converted_contact_id: string | null;
  converted_opportunity_id: string | null;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface LeadListResponse {
  data: LeadResource[];
  meta: { current_page: number; total: number };
}

export interface LeadFilterParams {
  status?: LeadStatus | string;
  rating?: LeadRating | string;
  page?: number;
}

export type DuplicateStrategy = 'merge' | 'notify' | 'create';

/** Body of `POST /crm/leads`. */
export interface CreateLeadPayload {
  first_name?: string;
  last_name?: string;
  company_name?: string;
  title?: string;
  email?: string;
  phone?: string;
  website?: string;
  country?: string;
  vat_number?: string;
  industry?: string;
  region?: string;
  product_line?: string;
  estimated_budget?: number;
  duplicate_strategy?: DuplicateStrategy;
}

/** Create response: the lead plus the duplicate outcome. */
export type CreateLeadResponse = LeadResource & { merged: boolean; duplicate_ids: string[] };

/** Body of `POST /crm/leads/{id}/convert` (all optional: an empty body is the 1-click conversion). */
export interface ConvertLeadPayload {
  existing_account_id?: string;
  new_account_name?: string;
  create_opportunity?: boolean;
  opportunity_name?: string;
  opportunity_amount?: number;
}

export interface ConvertLeadResponse {
  account: { id: string; name: string };
  contact_id: string;
  opportunity: { id: string; name: string } | null;
}

export type WebhookProvider = 'generic' | 'wordpress' | 'webflow' | 'meta_ads' | 'linkedin';

/** Web-to-Lead endpoint (`/crm/lead-webhooks`). The secret is returned only on creation / rotation. */
export interface LeadWebhookEndpoint {
  id: string;
  name: string;
  provider: WebhookProvider;
  url: string;
  token: string;
  duplicate_strategy: DuplicateStrategy;
  is_active: boolean;
  received_count: number;
  last_received_at: string | null;
  secret?: string;
}

export interface CreateWebhookPayload {
  name: string;
  provider?: WebhookProvider;
  duplicate_strategy?: DuplicateStrategy;
}

export type RoutingStrategy = 'geographic' | 'product_line' | 'company_size' | 'round_robin';

export interface LeadRoutingRule {
  id: string;
  name: string;
  strategy: RoutingStrategy;
  priority: number;
  criteria: {
    countries?: string[];
    regions?: string[];
    product_lines?: string[];
    min_size?: number;
    max_size?: number;
  } | null;
  assignee_user_ids: string[];
  is_active: boolean;
}

export type SaveRoutingRulePayload = Omit<LeadRoutingRule, 'id'>;

export type LeadBehaviorEvent = 'email_open' | 'catalog_download' | 'site_visit';

/** Body of `PUT /crm/leads/{id}` (the score is recalculated server-side). */
export type UpdateLeadPayload = Partial<
  Pick<
    CreateLeadPayload,
    | 'first_name'
    | 'last_name'
    | 'company_name'
    | 'title'
    | 'email'
    | 'phone'
    | 'website'
    | 'country'
    | 'vat_number'
    | 'industry'
    | 'region'
    | 'product_line'
    | 'estimated_budget'
  >
> & { company_size?: number; estimated_revenue?: number };
