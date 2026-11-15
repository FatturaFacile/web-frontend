/** CRM extension: territories and quotas, partners (PRM), CPQ and marketing automation. Mirrors the API FormRequests. */

export interface CrmExtensionResponse<T> {
  data: T;
}

export type CrmPartnerType = 'reseller' | 'referral' | 'distributor' | 'integrator';
export type CrmPartnerStatus = 'prospect' | 'active' | 'suspended' | 'terminated';
export type CrmDealRegistrationStatus = 'pending' | 'approved' | 'rejected' | 'expired' | 'won';
export type CrmMdfClaimStatus = 'submitted' | 'approved' | 'rejected' | 'paid';
export type CrmQuoteStatus = 'draft' | 'pending_approval' | 'approved' | 'rejected';
export type CrmApproverRole = 'sales_manager' | 'admin' | 'owner';
export type CrmAutomationEntity = 'contacts' | 'leads';
export type CrmAutomationTrigger = 'manual' | 'lead_created' | 'lead_qualified' | 'contact_created';
export type CrmAutomationExitCondition = 'lead_converted' | 'lead_disqualified' | 'consent_withdrawn';
export type CrmAutomationStepType = 'email' | 'task' | 'wait';
export type CrmPricingRuleType = 'volume_discount' | 'partner_discount' | 'promotion';

export const CRM_PARTNER_TYPES: readonly CrmPartnerType[] = ['reseller', 'referral', 'distributor', 'integrator'];
export const CRM_PARTNER_STATUSES: readonly CrmPartnerStatus[] = ['prospect', 'active', 'suspended', 'terminated'];
export const CRM_APPROVER_ROLES: readonly CrmApproverRole[] = ['sales_manager', 'admin', 'owner'];
export const CRM_AUTOMATION_TRIGGERS: readonly CrmAutomationTrigger[] = ['manual', 'lead_created', 'lead_qualified', 'contact_created'];
export const CRM_AUTOMATION_EXIT_CONDITIONS: readonly CrmAutomationExitCondition[] = ['lead_converted', 'lead_disqualified', 'consent_withdrawn'];
export const CRM_AUTOMATION_STEP_TYPES: readonly CrmAutomationStepType[] = ['email', 'task', 'wait'];
export const CRM_PRICING_RULE_TYPES: readonly CrmPricingRuleType[] = ['volume_discount', 'partner_discount', 'promotion'];

export interface CrmTerritoryCriteria {
  countries?: string[];
  industries?: string[];
  tiers?: string[];
}

export interface CrmTerritory {
  id: string;
  code: string;
  name: string;
  owner_user_id: string | null;
  criteria: CrmTerritoryCriteria | null;
  priority: number;
  is_active: boolean;
}

export interface CrmTerritoryRequest {
  code: string;
  name: string;
  owner_user_id?: string | null;
  criteria?: CrmTerritoryCriteria | null;
  priority?: number;
  is_active?: boolean;
}

export interface CrmTerritoryAssignmentResult {
  assigned: number;
  unmatched: number;
  kept_manual: number;
}

export interface CrmQuotaAttainment {
  target: string;
  achieved: string;
  remaining: string;
  attainment_percent: string;
  won_count: number;
}

export interface CrmSalesQuota {
  id: string;
  user_id: string;
  territory_id: string | null;
  period_start: string;
  period_end: string;
  target_amount: string;
  currency: string;
  notes: string | null;
  attainment?: CrmQuotaAttainment;
}

export interface CrmSalesQuotaRequest {
  user_id: string;
  territory_id?: string | null;
  period_start: string;
  period_end: string;
  target_amount: number | string;
  currency?: string;
  notes?: string | null;
}

export interface CrmPartnerTier {
  id: string;
  code: string;
  name: string;
  rank: number;
  min_annual_revenue: string;
  discount_percent: string;
  mdf_percent: string;
}

export interface CrmPartnerTierRequest {
  code: string;
  name: string;
  rank: number;
  min_annual_revenue: number | string;
  discount_percent: number | string;
  mdf_percent: number | string;
}

export interface CrmPartner {
  id: string;
  account_id: string | null;
  tier_id: string | null;
  name: string;
  partner_type: CrmPartnerType;
  status: CrmPartnerStatus;
  contact_email: string | null;
  joined_on: string | null;
  closed_revenue: string;
  tier?: CrmPartnerTier | null;
}

export interface CrmPartnerRequest {
  name: string;
  account_id?: string | null;
  partner_type: CrmPartnerType;
  status: CrmPartnerStatus;
  contact_email?: string | null;
  joined_on?: string | null;
}

export interface CrmDealRegistration {
  id: string;
  partner_id: string;
  opportunity_id: string | null;
  customer_name: string;
  expected_amount: string;
  currency: string;
  status: CrmDealRegistrationStatus;
  conflicts_with_id: string | null;
  registered_on: string;
  expires_on: string | null;
  decision_reason: string | null;
  partner?: { id: string; name: string } | null;
}

export interface CrmDealRegistrationRequest {
  partner_id: string;
  customer_name: string;
  opportunity_id?: string | null;
  expected_amount?: number | string | null;
  currency?: string;
  registered_on?: string;
  expires_on?: string | null;
}

export interface CrmMdfSummary {
  allocated: string;
  committed: string;
  pending: string;
  remaining: string;
}

export interface CrmMdfFund {
  id: string;
  partner_id: string;
  fiscal_year: number;
  allocated_amount: string;
  currency: string;
  summary?: CrmMdfSummary;
}

export interface CrmMdfFundRequest {
  partner_id: string;
  fiscal_year: number;
  allocated_amount?: number | string | null;
  currency?: string;
}

export interface CrmMdfClaim {
  id: string;
  fund_id: string;
  activity: string;
  amount: string;
  status: CrmMdfClaimStatus;
  activity_date: string | null;
  decision_reason: string | null;
}

export interface CrmMdfClaimRequest {
  activity: string;
  amount: number | string;
  activity_date?: string | null;
}

export interface CrmPricingRule {
  id: string;
  name: string;
  rule_type: CrmPricingRuleType;
  min_quantity: string;
  partner_tier_code: string | null;
  discount_percent: string;
  priority: number;
  valid_from: string | null;
  valid_to: string | null;
  is_active: boolean;
}

export interface CrmPricingRuleRequest {
  name: string;
  rule_type: CrmPricingRuleType;
  min_quantity: number | string;
  partner_tier_code?: string | null;
  discount_percent: number | string;
  priority?: number;
  valid_from?: string | null;
  valid_to?: string | null;
  is_active?: boolean;
}

export interface CrmDiscountThreshold {
  id: string;
  from_discount_percent: string;
  approver_role: CrmApproverRole;
}

export interface CrmDiscountThresholdRequest {
  from_discount_percent: number | string;
  approver_role: CrmApproverRole;
}

export interface CrmQuoteConfiguration {
  id: string;
  opportunity_id: string | null;
  product_configuration_id: string | null;
  partner_id: string | null;
  name: string;
  quantity: string;
  unit_price: string;
  currency: string;
  rule_discount_percent: string;
  extra_discount_percent: string;
  discount_percent: string;
  net_total: string;
  status: CrmQuoteStatus;
  required_approver_role: CrmApproverRole | null;
  decision_reason: string | null;
}

export interface CrmQuoteConfigurationRequest {
  name: string;
  opportunity_id?: string | null;
  product_configuration_id?: string | null;
  partner_id?: string | null;
  quantity?: number | string;
  unit_price?: number | string;
  currency?: string;
  extra_discount_percent?: number | string;
}

export interface CrmQuotePreview {
  quantity: string;
  unit_price: string;
  currency: string;
  rule_discount_percent: string;
  extra_discount_percent: string;
  discount_percent: string;
  net_total: string;
  required_approver_role: CrmApproverRole | null;
}

export interface CrmAutomationStep {
  id?: string;
  position?: number;
  step_type: CrmAutomationStepType;
  delay_days: number;
  subject?: string | null;
  body?: string | null;
}

export interface CrmAutomationSequence {
  id: string;
  name: string;
  entity: CrmAutomationEntity;
  trigger_type: CrmAutomationTrigger;
  segment_id: string | null;
  exit_conditions: CrmAutomationExitCondition[];
  is_active: boolean;
  steps?: CrmAutomationStep[];
}

export interface CrmAutomationSequenceRequest {
  name: string;
  entity: CrmAutomationEntity;
  trigger_type: CrmAutomationTrigger;
  segment_id?: string | null;
  exit_conditions?: CrmAutomationExitCondition[];
  is_active?: boolean;
  steps?: CrmAutomationStep[];
}

export interface CrmAutomationEnrollment {
  id: string;
  sequence_id: string;
  contact_id: string | null;
  lead_id: string | null;
  status: 'active' | 'completed' | 'exited';
  current_position: number;
  next_run_at: string | null;
  exit_reason: string | null;
  enrolled_at: string;
  finished_at: string | null;
}

export interface CrmAutomationEnrollRequest {
  contact_id?: string | null;
  lead_id?: string | null;
}

export interface CrmAutomationStepLog {
  id: string;
  enrollment_id: string;
  position: number;
  step_type: CrmAutomationStepType;
  status: string;
  message: string | null;
  executed_at: string;
}
