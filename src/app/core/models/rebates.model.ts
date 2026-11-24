/** Rebates and trade promotions. Mirrors the API FormRequests and resources of the Rebates module. */

export type RebateDirection = 'sales' | 'purchase';
export type RebateTierMode = 'retroactive' | 'incremental';
export type RebateAgreementStatus = 'draft' | 'active' | 'closed' | 'cancelled';
export type RebateAccrualStatus = 'accrued' | 'settled';
export type RebateSettlementType = 'credit_note_draft' | 'supplier_claim';
export type RebateDiscountType = 'percentage' | 'fixed_amount';
export type RebatePromotionState = 'inactive' | 'scheduled' | 'active' | 'expired';

export type RebateType = 'tiered_volume' | 'fixed_bonus' | 'marketing_contribution';
export type RebateAccrualFrequency = 'monthly' | 'quarterly' | 'custom';
export type RebateContributionKind = 'marketing' | 'co_marketing' | 'listing';
export type RebateContributionStatus = 'planned' | 'accrued' | 'settled' | 'cancelled';
export type RebateRunStatus = 'posted' | 'reversed';
export type RebateProposalStatus = 'draft' | 'pending_approval' | 'approved' | 'settled' | 'cancelled';
export type RebateExecutionMode = 'credit_note_request' | 'charge_invoice' | 'ap_set_off';
export type RebateProposalLineType = 'invoice' | 'credit_note' | 'contribution' | 'bonus';
export type RebateProposalAction = 'submit' | 'approve' | 'execute' | 'cancel';

export const REBATE_TYPES: readonly RebateType[] = ['tiered_volume', 'fixed_bonus', 'marketing_contribution'];
export const REBATE_ACCRUAL_FREQUENCIES: readonly RebateAccrualFrequency[] = ['monthly', 'quarterly', 'custom'];
export const REBATE_CONTRIBUTION_KINDS: readonly RebateContributionKind[] = ['marketing', 'co_marketing', 'listing'];
export const REBATE_EXECUTION_MODES: readonly RebateExecutionMode[] = ['credit_note_request', 'charge_invoice', 'ap_set_off'];

export const REBATE_DIRECTIONS: readonly RebateDirection[] = ['sales', 'purchase'];
export const REBATE_TIER_MODES: readonly RebateTierMode[] = ['retroactive', 'incremental'];
export const REBATE_AGREEMENT_STATUSES: readonly RebateAgreementStatus[] = ['draft', 'active', 'closed', 'cancelled'];
export const REBATE_DISCOUNT_TYPES: readonly RebateDiscountType[] = ['percentage', 'fixed_amount'];
export const REBATE_PROMOTION_STATES: readonly RebatePromotionState[] = ['active', 'scheduled', 'expired', 'inactive'];

export interface RebateTier {
  id: string;
  threshold_amount: string;
  rate_percent: string;
  flat_amount?: string | null;
}

export interface RebateTierRequest {
  threshold_amount: string;
  rate_percent: string;
  flat_amount?: string | null;
}

export interface RebateAgreement {
  id: string;
  code: string;
  name: string;
  direction: RebateDirection;
  contact_id: string;
  contact_name?: string | null;
  tier_mode: RebateTierMode;
  starts_on: string;
  ends_on: string;
  currency: string;
  status: RebateAgreementStatus;
  notes: string | null;
  tiers?: RebateTier[];
  open_rebate?: string;
  rebate_type?: RebateType;
  supplier_contract_id?: string | null;
  fixed_bonus_target?: string | null;
  fixed_bonus_amount?: string | null;
  accrual_frequency?: RebateAccrualFrequency;
  accrual_account_id?: string | null;
  income_account_id?: string | null;
  version?: number;
  contributions?: RebateContribution[];
}

export interface RebateAgreementRequest {
  code: string;
  name: string;
  direction: RebateDirection;
  contact_id: string;
  tier_mode?: RebateTierMode;
  starts_on: string;
  ends_on: string;
  currency?: string;
  notes?: string | null;
  rebate_type?: RebateType;
  supplier_contract_id?: string | null;
  fixed_bonus_target?: string | null;
  fixed_bonus_amount?: string | null;
  accrual_frequency?: RebateAccrualFrequency;
  accrual_account_id?: string | null;
  income_account_id?: string | null;
  /** Optimistic lock: the version of the agreement being edited. */
  version?: number;
  /** Required only for a tiered volume rebate; the other types send an empty list. */
  tiers: RebateTierRequest[];
}

export interface RebateAgreementFilters {
  direction?: RebateDirection;
  status?: RebateAgreementStatus;
  contact_id?: string;
  search?: string;
  per_page?: number;
}

export interface RebateAccrual {
  id: string;
  agreement_id: string;
  as_of: string;
  base_amount: string;
  cumulative_rebate: string;
  rebate_amount: string;
  applied_rate_percent: string | null;
  status: RebateAccrualStatus;
  settlement_id: string | null;
}

export interface RebateCalculation {
  accrual: RebateAccrual | null;
  base_amount: string;
  cumulative_rebate: string;
  previously_accrued: string;
  delta: string;
}

export interface RebateCalculateRequest {
  as_of?: string | null;
}

export interface RebateSettleRequest {
  tax_rate?: string | null;
  settled_on?: string | null;
  notes?: string | null;
}

export interface RebateSettlement {
  id: string;
  agreement_id: string;
  agreement?: { id: string; code: string; name: string; direction: RebateDirection } | null;
  amount: string;
  currency: string;
  settlement_type: RebateSettlementType;
  credit_note_id: string | null;
  settled_on: string;
  notes: string | null;
  accruals?: RebateAccrual[];
}

export interface RebatePromotion {
  id: string;
  code: string;
  name: string;
  discount_type: RebateDiscountType;
  discount_value: string;
  product_id: string | null;
  contact_id: string | null;
  min_quantity: string | null;
  starts_on: string;
  ends_on: string;
  is_active: boolean;
  state: RebatePromotionState;
  notes: string | null;
}

export interface RebatePromotionRequest {
  code: string;
  name: string;
  discount_type: RebateDiscountType;
  discount_value: string;
  product_id?: string | null;
  contact_id?: string | null;
  min_quantity?: string | null;
  starts_on: string;
  ends_on: string;
  is_active?: boolean;
  notes?: string | null;
}

export interface RebatePromotionFilters {
  state?: RebatePromotionState;
  on?: string;
  product_id?: string;
  contact_id?: string;
  per_page?: number;
}

export interface RebateDashboard {
  agreements: { total: number; by_status: Record<string, number> };
  accrued_open: { sales: string; purchase: string };
  settled: { sales: string; purchase: string };
  promotions: { active: number; scheduled: number; expired: number };
  ending_agreements: { id: string; code: string; name: string; ends_on: string }[];
}

// --- Supplier rebate programs (Mod 049) ---

export interface RebateContribution {
  id: string;
  agreement_id: string;
  kind: RebateContributionKind;
  description: string;
  amount: string;
  due_on: string;
  status: RebateContributionStatus;
  accrual_id?: string | null;
}

export interface RebateContributionRequest {
  kind: RebateContributionKind;
  description: string;
  amount: string;
  due_on: string;
}

export interface RebateProgressTier {
  threshold_amount: string;
  rate_percent: string;
  flat_amount: string | null;
}

export interface RebateTierProgress {
  current_tier: RebateProgressTier | null;
  next_tier: RebateProgressTier | null;
  accrued_rebate: string;
  distance_to_next: string | null;
  progress_percent: string;
  projected_rebate_at_next: string | null;
  projected_gain: string | null;
}

export interface RebateBonusProgress {
  target: string;
  bonus: string;
  reached: boolean;
  distance_to_target: string;
  progress_percent: string;
}

export interface RebateScaleRow {
  threshold_amount: string;
  /** Threshold of the next tier; null for the open-ended top tier. */
  max_threshold: string | null;
  rate_percent: string;
  flat_amount: string | null;
}

export interface RebateProgress {
  agreement_id: string;
  rebate_type: RebateType;
  tier_mode: RebateTierMode;
  currency: string;
  as_of: string;
  qualifying_volume: string;
  earned_rebate: string;
  accrued_rebate: string;
  settled_rebate: string;
  tier: RebateTierProgress | null;
  bonus: RebateBonusProgress | null;
  contributions: { planned: string; accrued: string; settled: string };
  tiers: RebateScaleRow[];
}

export interface RebateAccrualRunLine {
  passive_invoice_id: string;
  invoice_number: string | null;
  document_type: string | null;
  invoice_date: string | null;
  net_amount: string;
}

export interface RebateAccrualRun {
  id: string;
  agreement_id: string;
  period_start: string;
  period_end: string;
  status: RebateRunStatus;
  base_amount: string;
  cumulative_rebate: string;
  delta_amount: string;
  journal_entry_id: string | null;
  reversal_journal_entry_id: string | null;
  reversed_at: string | null;
  reversal_reason: string | null;
  lines?: RebateAccrualRunLine[];
}

export interface RebateAccrualRunRequest {
  period_end?: string | null;
  period_start?: string | null;
}

export interface RebateProposalLine {
  line_type: RebateProposalLineType;
  passive_invoice_id: string | null;
  reference: string | null;
  reference_date: string | null;
  net_amount: string;
  rebate_amount: string;
}

export interface RebateSettlementProposal {
  id: string;
  agreement_id: string;
  amount: string;
  gross_amount: string;
  tax_rate: string | null;
  tax_amount: string;
  currency: string;
  status: RebateProposalStatus;
  execution_mode: RebateExecutionMode;
  document_id: string | null;
  passive_invoice_id: string | null;
  set_off_amount: string | null;
  journal_entry_id: string | null;
  submitted_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  version: number;
  lines?: RebateProposalLine[];
  accruals?: RebateAccrual[];
}

export interface RebateProposalRequest {
  execution_mode: RebateExecutionMode;
  tax_rate?: string | null;
  /** Required for the AP set-off mode. */
  passive_invoice_id?: string | null;
  notes?: string | null;
}

export interface RebateProposalTransitionRequest {
  version?: number;
  executed_on?: string | null;
  payables_account_id?: string | null;
  vat_account_id?: string | null;
}

export interface RebateProposalFilters {
  agreement_id?: string;
  status?: RebateProposalStatus;
  per_page?: number;
}

// --- Blanket purchase agreements (supplier contracts) ---

export type BlanketAlertCode = 'ceiling_near' | 'ceiling_exceeded' | 'minimum_at_risk' | 'minimum_not_met';

export interface BlanketBalanceLine {
  line_id: string;
  description: string | null;
  unit_price: string | null;
  committed_quantity: string;
  released_quantity: string;
  remaining_quantity: string;
  ordered_amount: string;
}

export interface BlanketBalanceAlert {
  code: BlanketAlertCode;
  severity: string;
}

export interface BlanketAgreementBalance {
  contract_id: string;
  currency: string;
  status: string;
  ceiling_amount: string | null;
  minimum_spend_amount: string | null;
  ordered_amount: string;
  received_amount: string;
  invoiced_amount: string;
  remaining_ceiling: string | null;
  ceiling_used_percent: string | null;
  minimum_shortfall: string | null;
  minimum_reached_percent: string | null;
  alert_threshold_percent: string | null;
  lines: BlanketBalanceLine[];
  alerts: BlanketBalanceAlert[];
}

/** The API wraps every record or list in `data`; lists that paginate add the Laravel `meta`. */
export interface RebateResponse<T> {
  data: T;
  meta?: { current_page: number; last_page: number; per_page: number; total: number };
}
