/** Credit management (credit risk and collections). Mirrors the API FormRequests and resources of the CreditManagement module. */

export type CreditRiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type CreditFactorSource = 'overdue_ratio' | 'max_days_overdue' | 'limit_utilisation' | 'relationship_months' | 'manual';
export type CreditLimitRequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';
export type CreditInsurancePolicyStatus = 'active' | 'cancelled';
export type CreditInsuranceCoverStatus = 'requested' | 'granted' | 'refused' | 'withdrawn';
export type CollectionCaseStatus = 'open' | 'in_dunning' | 'promised' | 'disputed' | 'escalated' | 'resolved' | 'written_off';
export type CollectionCasePriority = 'low' | 'normal' | 'high';
export type CollectionCaseOutcome = 'resolved' | 'written_off';
export type DunningChannel = 'email' | 'letter' | 'phone' | 'registered_letter' | 'legal';
export type CollectionActionType = 'dunning_step' | 'call' | 'email' | 'letter' | 'visit' | 'legal' | 'note';
export type CollectionPromiseStatus = 'pending' | 'kept' | 'broken' | 'cancelled';
export type CollectionPromiseOutcome = 'kept' | 'broken' | 'cancelled';
export type CreditDisputeStatus = 'open' | 'under_review' | 'upheld' | 'rejected';
export type CreditDisputeOutcome = 'upheld' | 'rejected';
export type CreditDisputeReason = 'pricing' | 'quality' | 'delivery' | 'duplicate' | 'other';
export type CreditAgingBucket = 'current' | 'd1_30' | 'd31_60' | 'd61_90' | 'd90_plus';

export const CREDIT_RISK_LEVELS: readonly CreditRiskLevel[] = ['low', 'medium', 'high', 'critical'];
export const CREDIT_FACTOR_SOURCES: readonly CreditFactorSource[] = ['overdue_ratio', 'max_days_overdue', 'limit_utilisation', 'relationship_months', 'manual'];
export const CREDIT_LIMIT_REQUEST_STATUSES: readonly CreditLimitRequestStatus[] = ['pending', 'approved', 'rejected', 'cancelled'];
export const CREDIT_INSURANCE_POLICY_STATUSES: readonly CreditInsurancePolicyStatus[] = ['active', 'cancelled'];
export const CREDIT_INSURANCE_COVER_STATUSES: readonly CreditInsuranceCoverStatus[] = ['requested', 'granted', 'refused', 'withdrawn'];
export const COLLECTION_CASE_STATUSES: readonly CollectionCaseStatus[] = ['open', 'in_dunning', 'promised', 'disputed', 'escalated', 'resolved', 'written_off'];
export const COLLECTION_CASE_PRIORITIES: readonly CollectionCasePriority[] = ['low', 'normal', 'high'];
export const COLLECTION_CASE_OUTCOMES: readonly CollectionCaseOutcome[] = ['resolved', 'written_off'];
export const DUNNING_CHANNELS: readonly DunningChannel[] = ['email', 'letter', 'phone', 'registered_letter', 'legal'];
export const COLLECTION_ACTION_TYPES: readonly Exclude<CollectionActionType, 'dunning_step'>[] = ['call', 'email', 'letter', 'visit', 'legal', 'note'];
export const COLLECTION_PROMISE_OUTCOMES: readonly CollectionPromiseOutcome[] = ['kept', 'broken', 'cancelled'];
export const CREDIT_DISPUTE_REASONS: readonly CreditDisputeReason[] = ['pricing', 'quality', 'delivery', 'duplicate', 'other'];
export const CREDIT_AGING_BUCKETS: readonly CreditAgingBucket[] = ['current', 'd1_30', 'd31_60', 'd61_90', 'd90_plus'];

export interface CreditScorecardFactor {
  id: string;
  code: string;
  name: string;
  source: CreditFactorSource;
  weight: string;
  is_active: boolean;
  sort_order: number;
}

export interface CreditScorecardFactorRequest {
  code: string;
  name: string;
  source: CreditFactorSource;
  weight: string;
  is_active: boolean;
  sort_order: number;
}

export interface CreditRatingBand {
  id: string;
  code: string;
  name: string;
  min_score: string;
  max_score: string;
  risk_level: CreditRiskLevel;
  limit_multiplier: string;
  limit_ceiling: string;
}

export interface CreditRatingBandRequest {
  code: string;
  name: string;
  min_score: string;
  max_score: string;
  risk_level: CreditRiskLevel;
  limit_multiplier: string;
  limit_ceiling: string;
}

export interface CreditScore {
  id: string;
  customer_id: string;
  customer_name: string | null;
  score: string;
  rating_band_id: string | null;
  rating: string;
  risk_level: CreditRiskLevel;
  breakdown: unknown;
  scored_on: string;
  notes: string | null;
}

export interface CreditScoreRequest {
  customer_id: string;
  manual_inputs: Record<string, number>;
  notes: string | null;
}

export interface CreditLimitProposal {
  score_id: string;
  rating: string;
  score: string;
  risk_level: CreditRiskLevel;
  quarterly_turnover: string;
  proposed_limit: string;
  current_limit: string;
}

export interface CreditLimitRequest {
  id: string;
  customer_id: string;
  customer_name: string | null;
  current_limit: string;
  requested_limit: string | null;
  proposed_limit: string | null;
  approved_limit: string | null;
  currency: string;
  status: CreditLimitRequestStatus;
  reason: string | null;
  decided_at: string | null;
  decision_note: string | null;
  valid_until: string | null;
}

export interface CreditLimitRequestPayload {
  customer_id: string;
  requested_limit: string | null;
  currency: string | null;
  reason: string | null;
  valid_until: string | null;
}

export interface CreditLimitApprovalRequest {
  approved_limit: string | null;
  decision_note: string | null;
  valid_until: string | null;
}

export interface CreditLimitRejectionRequest {
  decision_note: string;
}

export interface CreditInsurancePolicy {
  id: string;
  insurer: string;
  policy_number: string;
  starts_on: string;
  ends_on: string;
  currency: string;
  coverage_percentage: string;
  max_total_cover: string | null;
  status: CreditInsurancePolicyStatus;
  notes: string | null;
  granted_total: string | null;
  is_in_force: boolean;
}

export interface CreditInsurancePolicyRequest {
  insurer: string;
  policy_number: string;
  starts_on: string;
  ends_on: string;
  currency: string;
  coverage_percentage: string;
  max_total_cover: string | null;
  status: CreditInsurancePolicyStatus;
  notes: string | null;
}

export interface CreditInsuranceCover {
  id: string;
  policy_id: string;
  customer_id: string;
  customer_name: string | null;
  insured_limit: string;
  status: CreditInsuranceCoverStatus;
  granted_on: string | null;
  expires_on: string | null;
  notes: string | null;
}

export interface CreditInsuranceCoverRequest {
  customer_id?: string;
  insured_limit: string;
  status: CreditInsuranceCoverStatus;
  granted_on: string | null;
  expires_on: string | null;
  notes: string | null;
}

export interface CreditExposure {
  customer_id: string;
  customer_name: string;
  credit_limit: string;
  open_invoices: string;
  overdue_amount: string;
  overdue_invoices_count: number;
  max_days_overdue: number;
  open_orders: string;
  exposure: string;
  available_credit: string | null;
  utilisation_percent: string | null;
  is_over_limit: boolean;
  insured_limit: string;
  uninsured_exposure: string;
  rating: string | null;
  score: string | null;
}

export interface DunningStep {
  id?: string;
  step_order?: number;
  name: string;
  days_after_due: number;
  channel: DunningChannel;
  template_key: string | null;
  fee_amount: string | null;
  escalates: boolean;
}

export interface DunningStrategy {
  id: string;
  name: string;
  description: string | null;
  is_default: boolean;
  is_active: boolean;
  steps?: DunningStep[];
}

export interface DunningStrategyRequest {
  name: string;
  description: string | null;
  is_default: boolean;
  is_active: boolean;
  steps: DunningStep[];
}

export interface CollectionPromise {
  id: string;
  case_id: string;
  promised_amount: string;
  promised_on: string;
  status: CollectionPromiseStatus;
  paid_amount: string | null;
  resolved_on: string | null;
  notes: string | null;
}

export interface CollectionPromiseRequest {
  case_id: string;
  promised_amount: string;
  promised_on: string;
  notes: string | null;
}

export interface CollectionPromiseResolveRequest {
  outcome: CollectionPromiseOutcome;
  paid_amount: string | null;
  resolved_on: string | null;
}

export interface CreditDispute {
  id: string;
  customer_id: string;
  customer_name?: string | null;
  case_id: string | null;
  invoice_id: string | null;
  disputed_amount: string;
  reason_code: CreditDisputeReason;
  status: CreditDisputeStatus;
  opened_on: string;
  resolved_on: string | null;
  credited_amount: string | null;
  description: string | null;
  resolution_note: string | null;
}

export interface CreditDisputeRequest {
  customer_id: string;
  case_id: string;
  disputed_amount: string;
  reason_code: CreditDisputeReason;
  description: string | null;
}

export interface CreditDisputeResolveRequest {
  outcome: CreditDisputeOutcome;
  credited_amount: string | null;
  resolution_note: string | null;
}

export interface CollectionAction {
  id: string;
  case_id: string;
  step_id: string | null;
  action_type: CollectionActionType;
  channel: string | null;
  performed_on: string;
  fee_amount: string | null;
  outcome: string | null;
}

export interface CollectionActionRequest {
  action_type: Exclude<CollectionActionType, 'dunning_step'>;
  channel: string | null;
  performed_on: string | null;
  outcome: string | null;
}

export interface CollectionCaseInvoice {
  id: string;
  invoice_id: string;
  invoice_number: string | null;
  due_on: string | null;
  outstanding_amount: string;
}

export interface CollectionCase {
  id: string;
  case_number: string;
  customer_id: string;
  customer_name: string | null;
  status: CollectionCaseStatus;
  priority: CollectionCasePriority;
  collector_id: string | null;
  strategy_id: string | null;
  current_step_order: number;
  outstanding_amount: string;
  currency: string;
  opened_on: string;
  next_action_on: string | null;
  closed_on: string | null;
  notes: string | null;
  strategy?: DunningStrategy;
  invoices?: CollectionCaseInvoice[];
  actions?: CollectionAction[];
  promises?: CollectionPromise[];
  disputes?: CreditDispute[];
}

export interface CollectionCaseRequest {
  customer_id: string;
  invoice_ids: string[] | null;
  strategy_id: string | null;
  collector_id: string | null;
  priority: CollectionCasePriority;
  notes: string | null;
}

export interface CollectionCaseUpdateRequest {
  priority?: CollectionCasePriority;
  notes?: string | null;
  collector_id?: string | null;
  next_action_on?: string | null;
}

export interface CollectionCaseCloseRequest {
  outcome: CollectionCaseOutcome;
  note: string | null;
}

export interface CreditWorklistRow {
  id: string;
  case_number: string;
  customer_id: string;
  customer_name: string;
  status: CollectionCaseStatus;
  priority: CollectionCasePriority;
  collector_id: string | null;
  outstanding_amount: string;
  currency: string;
  current_step_order: number;
  next_action_on: string | null;
  is_action_due: boolean;
  days_overdue: number;
  pending_promise: { id: string; promised_amount: string; promised_on: string } | null;
}

export interface CreditWorklistFilters {
  mine?: boolean;
  due_only?: boolean;
}

export interface CreditAgingBucketTotal {
  key: CreditAgingBucket;
  amount: string;
  invoices_count: number;
}

export interface CreditDashboard {
  as_of: string;
  receivables_total: string;
  overdue_total: string;
  overdue_percentage: string;
  invoiced_last_90_days: string;
  dso_days: string | null;
  overdue_by_bucket: CreditAgingBucketTotal[];
  customers_over_limit: number;
  cases: { open_count: number; outstanding_amount: string; by_status: Record<string, number> };
  promises: { pending_count: number; pending_amount: string; past_due_count: number };
  disputes: { open_count: number; open_amount: string };
  pending_limit_requests: number;
  rating_distribution: { rating: string; count: number }[];
  insurance: { active_policies: number; insured_total: string; expiring_within_30_days: number };
  top_overdue_customers: { customer_id: string; customer_name: string; overdue_amount: string; max_days_overdue: number }[];
}

export interface CreditCaseFilters {
  status?: CollectionCaseStatus;
  customer_id?: string;
  collector_id?: string;
  priority?: CollectionCasePriority;
  page?: number;
  per_page?: number;
}

export interface CreditPromiseFilters {
  case_id?: string;
  status?: CollectionPromiseStatus;
  page?: number;
  per_page?: number;
}

export interface CreditDisputeFilters {
  status?: CreditDisputeStatus;
  customer_id?: string;
  case_id?: string;
  page?: number;
  per_page?: number;
}

/** Result of marking the overdue pending promises as broken. */
export interface CreditMarkedPromises {
  marked: number;
}

export interface CreditAgingCustomer {
  customer_id: string;
  customer_name: string;
  buckets: Record<CreditAgingBucket, string>;
  total: string;
}

/** Open receivables by days overdue, in total and per customer. */
export interface CreditAging {
  as_of: string;
  buckets: CreditAgingBucketTotal[];
  total: string;
  customers: CreditAgingCustomer[];
}

export interface CreditResponse<T> {
  data: T;
  meta?: { current_page: number; last_page: number; per_page: number; total: number };
}
