/** CRM accounts, activities, segments, scoring rules, campaigns, reports and forecasts. */

export type CrmAccountTier = 'strategic' | 'enterprise' | 'mid_market' | 'smb' | 'standard';
export type CrmAccountStatus = 'prospect' | 'active' | 'inactive' | 'churned';

export interface CrmAccount {
  id: string;
  name: string;
  contact_id?: string | null;
  tier?: CrmAccountTier | null;
  status?: CrmAccountStatus | string;
  industry?: string | null;
  website?: string | null;
  annual_revenue?: string | null;
  employee_count?: number | null;
  owner_user_id?: string | null;
  parent_account_id?: string | null;
  churn_risk?: string | null;
  tags?: string[] | null;
}

export interface CrmAccountPayload {
  name?: string | null;
  contact_id?: string | null;
  tier?: CrmAccountTier | null;
  industry?: string | null;
  website?: string | null;
  status?: CrmAccountStatus;
  annual_revenue?: number | string | null;
  employee_count?: number | null;
  tags?: string[] | null;
  owner_user_id?: string | null;
  parent_account_id?: string | null;
  vat_number?: string | null;
  fiscal_code?: string | null;
  email?: string | null;
  phone?: string | null;
  pec?: string | null;
  sdi_code?: string | null;
  country?: string | null;
}

export interface CrmAccountFilterParams {
  tier?: string;
  churn_risk?: string;
  contact_id?: string;
  page?: number;
  per_page?: number;
  search?: string;
}

export type CrmAccountHealth = Record<string, unknown>;

export interface CrmPartyLink {
  id?: string;
  account_id?: string;
  contact_id?: string | null;
  outcome?: 'linked' | 'created' | 'ambiguous' | 'resolved' | string;
  [key: string]: unknown;
}

export type CrmActivityType = 'task' | 'call' | 'meeting' | 'note' | 'email' | 'follow_up';
export type CrmActivityPriority = 'low' | 'medium' | 'high' | 'urgent';
export type CrmActivityStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
export type CrmRelatedType = 'lead' | 'account' | 'contact' | 'opportunity' | 'campaign';

export interface CrmActivity {
  id: string;
  subject: string;
  type: CrmActivityType;
  status: CrmActivityStatus | string;
  priority?: CrmActivityPriority | null;
  due_date?: string | null;
  reminder_at?: string | null;
  assigned_user_id?: string | null;
  related_type?: CrmRelatedType | null;
  related_id?: string | null;
  duration_minutes?: number | null;
  location?: string | null;
  notes?: string | null;
  outcome?: string | null;
  completed_at?: string | null;
}

export interface CrmActivityPayload {
  subject: string;
  type: CrmActivityType;
  priority?: CrmActivityPriority | null;
  due_date?: string | null;
  reminder_at?: string | null;
  assigned_user_id?: string | null;
  related_type?: CrmRelatedType | null;
  related_id?: string | null;
  duration_minutes?: number | null;
  location?: string | null;
  notes?: string | null;
}

export interface CrmActivityUpdatePayload {
  subject?: string;
  priority?: CrmActivityPriority;
  due_date?: string | null;
  reminder_at?: string | null;
  assigned_user_id?: string | null;
  notes?: string | null;
  location?: string | null;
  duration_minutes?: number | null;
  status?: 'pending' | 'in_progress' | 'cancelled';
}

export interface CrmActivityFilterParams {
  type?: string;
  status?: string;
  related_type?: string;
  related_id?: string;
  page?: number;
  per_page?: number;
}

export interface CrmActivityTimelineParams {
  related_type: string;
  related_id: string;
  include_related?: boolean;
}

export type CrmSegmentEntity = 'contacts' | 'leads';

export interface CrmSegment {
  id: string;
  name: string;
  description?: string | null;
  entity: CrmSegmentEntity;
  filters: unknown;
  is_active?: boolean | null;
  members_count?: number | null;
}

export interface CrmSegmentPayload {
  name: string;
  description?: string | null;
  entity: CrmSegmentEntity;
  filters: unknown;
  is_active?: boolean | null;
}

export type LeadScoringRuleType = 'field' | 'activity';

export interface LeadScoringRule {
  id: string;
  name: string;
  rule_type: LeadScoringRuleType;
  field?: string | null;
  operator?: string | null;
  value?: string | null;
  activity_type?: CrmActivityType | null;
  activity_status?: CrmActivityStatus | null;
  points: number;
  max_points?: number | null;
  sequence?: number | null;
  is_active?: boolean | null;
}

export type LeadScoringRulePayload = Omit<LeadScoringRule, 'id'>;

export type CrmCampaignStatus = 'planned' | 'active' | 'completed' | 'cancelled';

export interface CrmCampaign {
  id: string;
  name: string;
  code?: string | null;
  campaign_type_id?: string | null;
  status?: CrmCampaignStatus | string | null;
  start_date?: string | null;
  end_date?: string | null;
  budgeted_cost?: string | null;
  expected_revenue?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
}

export interface CrmCampaignPayload {
  name: string;
  code?: string | null;
  campaign_type_id?: string | null;
  status?: CrmCampaignStatus | null;
  start_date?: string | null;
  end_date?: string | null;
  budgeted_cost?: number | string | null;
  expected_revenue?: number | string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
}

export interface CrmCampaignMember {
  id: string;
  contact_id?: string | null;
  lead_id?: string | null;
  status?: string | null;
  name?: string | null;
  email?: string | null;
}

export interface CrmCampaignMemberPayload {
  contact_id?: string | null;
  lead_id?: string | null;
  segment_id?: string | null;
}

export type CrmCampaignRoi = Record<string, unknown>;

export interface CrmReportParams {
  from?: string | null;
  to?: string | null;
  owner_user_id?: string | null;
  assigned_user_id?: string | null;
}

export type CrmReport = Record<string, unknown>;

export interface CrmForecast {
  id: string;
  period: string;
  user_id?: string | null;
  currency?: string | null;
  quota_amount?: string | null;
  commit_amount?: string | null;
  best_case_amount?: string | null;
  pipeline_amount?: string | null;
  weighted_amount?: string | null;
  is_locked?: boolean | null;
  [key: string]: unknown;
}

export interface CrmForecastGeneratePayload {
  period: string;
  user_id?: string | null;
  currency?: string | null;
  quota_amount?: number | string | null;
}

export interface PipelineStageUpdatePayload {
  code: string;
  name: string;
  sequence?: number | null;
  default_probability: number | string;
  is_won?: boolean | null;
  is_lost?: boolean | null;
  stale_days?: number | null;
  is_active?: boolean | null;
  reprice_open_opportunities?: boolean | null;
}
