import { ContactResource } from './client.model';

export interface ContactStatistics {
  total_invoices: number;
  total_revenue: number;
  open_balance: number;
  overdue_balance: number;
  currency?: string;
}

export interface ContactStatementEntry {
  id: string;
  date: string;
  doc_number: string;
  doc_type: string;
  amount: number;
  balance: number;
  due_date: string;
  status: string;
}

export interface ContactStatement {
  contact: ContactResource;
  as_of: string;
  currency: string;
  total_open: number;
  entries: ContactStatementEntry[];
}

export interface LeadScoreBreakdownItem {
  rule: string;
  points: number;
  reason: string;
}

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
  status: string;
  score: number;
  rating: string;
  score_breakdown: string | LeadScoreBreakdownItem[];
  score_model: string | null;
  score_calculated_at: string | null;
  estimated_budget: string | null;
  lead_source: {
    id: string;
    code: string;
    name: string;
  } | null;
  converted_at: string | null;
  converted_account_id: string | null;
  converted_contact_id: string | null;
  converted_opportunity_id: string | null;
  tags: unknown[] | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface StoreLeadPayload {
  first_name?: string | null;
  last_name?: string | null;
  company_name?: string | null;
  title?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  country?: string | null;
  lead_source_code?: string | null;
  campaign_id?: string | null;
  assigned_user_id?: string | null;
  estimated_budget?: number | null;
  tags?: string[] | null;
}

export interface UpdateLeadPayload extends Partial<StoreLeadPayload> {
  status?: string;
}

export interface OpportunityResource {
  id: string;
  opportunity_number: string;
  name: string;
  amount: number;
  expected_revenue: number;
  currency: string;
  probability: number;
  forecast_category: string;
  expected_close_date: string;
  actual_close_date: string | null;
  status: string;
  win_loss_reason: string | null;
  competitor: string | null;
  discount_percentage: number;
  approval_status: string;
  workflow_instance_id: string | null;
  account: {
    id: string;
    name: string;
    tier: string;
  } | null;
  stage: {
    id: string;
    code: string;
    name: string;
    is_won: boolean;
    is_lost: boolean;
  } | null;
  sales_quote_id: string | null;
  project_id: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface StoreOpportunityPayload {
  account_id: string;
  contact_id?: string | null;
  name: string;
  amount: number;
  currency?: string | null;
  stage_code?: string | null;
  forecast_category?: 'pipeline' | 'best_case' | 'commit' | 'closed' | 'omitted' | null;
  expected_close_date?: string | null;
  owner_user_id?: string | null;
  campaign_id?: string | null;
  lead_id?: string | null;
  discount_percentage?: number | null;
}

/** Optional fields of `POST /crm/opportunities/{id}/stage`. */
export interface OpportunityStageExtras {
  amount?: number | null;
  probability?: number | null;
  forecast_category?: 'pipeline' | 'best_case' | 'commit' | 'closed' | 'omitted' | null;
  win_loss_reason?: string | null;
  competitor?: string | null;
  actual_close_date?: string | null;
}

export interface PipelineStageResource {
  id: string;
  code: string;
  name: string;
  position: number;
  probability: number;
  forecast_category: string;
  is_won: boolean;
  is_lost: boolean;
  is_active: boolean;
  sla_days?: number | null;
}

export interface CrmDuplicateMatch {
  entity: string;
  mode: 'groups' | 'matches';
  data: unknown[];
}

export interface ContactMergeRecord {
  id: string;
  survivor_contact_id: string;
  merged_contact_id: string;
  repointed: Record<string, number>;
  retained: Record<string, number>;
  filled_fields: string[];
  merged_snapshot: Record<string, unknown>;
  merged_by_user_id: string | null;
  created_at: string | null;
}

export interface MergeContactsPayload {
  survivor_contact_id: string;
  merged_contact_id: string;
  field_resolution?: Record<string, 'survivor' | 'merged'>;
}

export interface ConsentEffectiveItem {
  channel: string;
  purpose: string;
  status: string;
  captured_at: string | null;
  source: string;
}

export interface ConsentHistoryItem {
  id: string;
  contact_id: string | null;
  lead_id: string | null;
  channel: string;
  purpose: string;
  status: string;
  source: string;
  captured_at: string | null;
  evidence: string | null;
  recorded_by_user_id: string | null;
  created_at: string | null;
}

export interface ConsentResponse {
  effective: ConsentEffectiveItem[];
  history: ConsentHistoryItem[];
}

export interface StoreConsentPayload {
  contact_id?: string | null;
  lead_id?: string | null;
  channel: string;
  purpose: string;
  status: 'granted' | 'revoked' | 'pending';
  source?: string;
  evidence?: string | null;
}

/** The stored score of a lead next to the score under the model in force now (`GET /crm/leads/{id}/score`). */
export interface LeadScoreExplanation {
  lead_id: string;
  score: number;
  rating: string;
  model: string | null;
  breakdown: string | LeadScoreBreakdownItem[];
  calculated_at: string | null;
  current: {
    score: number;
    rating: 'hot' | 'warm' | 'cold';
    model: 'default' | 'tenant_rules';
    breakdown: LeadScoreBreakdownItem[];
  };
}
