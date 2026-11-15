/** Rebates and trade promotions. Mirrors the API FormRequests and resources of the Rebates module. */

export type RebateDirection = 'sales' | 'purchase';
export type RebateTierMode = 'retroactive' | 'incremental';
export type RebateAgreementStatus = 'draft' | 'active' | 'closed' | 'cancelled';
export type RebateAccrualStatus = 'accrued' | 'settled';
export type RebateSettlementType = 'credit_note_draft' | 'supplier_claim';
export type RebateDiscountType = 'percentage' | 'fixed_amount';
export type RebatePromotionState = 'inactive' | 'scheduled' | 'active' | 'expired';

export const REBATE_DIRECTIONS: readonly RebateDirection[] = ['sales', 'purchase'];
export const REBATE_TIER_MODES: readonly RebateTierMode[] = ['retroactive', 'incremental'];
export const REBATE_AGREEMENT_STATUSES: readonly RebateAgreementStatus[] = ['draft', 'active', 'closed', 'cancelled'];
export const REBATE_DISCOUNT_TYPES: readonly RebateDiscountType[] = ['percentage', 'fixed_amount'];
export const REBATE_PROMOTION_STATES: readonly RebatePromotionState[] = ['active', 'scheduled', 'expired', 'inactive'];

export interface RebateTier {
  id: string;
  threshold_amount: string;
  rate_percent: string;
}

export interface RebateTierRequest {
  threshold_amount: string;
  rate_percent: string;
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

/** The API wraps every record or list in `data`; lists that paginate add the Laravel `meta`. */
export interface RebateResponse<T> {
  data: T;
  meta?: { current_page: number; last_page: number; per_page: number; total: number };
}
