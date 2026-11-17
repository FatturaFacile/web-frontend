/** Advanced pricing: price lists with cascades, special prices, promotions, margin guardrails. Mirrors the API of the Pricing module. */

export type PricingChannel = 'DEFAULT' | 'B2B' | 'RETAIL' | 'ECOMMERCE';
export type PricingRoundingMode = 'NONE' | 'SWISS_005' | 'HALF_UP_001';
export type DiscountMode = 'MULTIPLICATIVE' | 'ADDITIVE';
export type PromotionType = 'BUY_X_GET_Y' | 'FREE_GIFT' | 'BUNDLE_DISCOUNT' | 'CART_VALUE_TIER';
export type VatTreatment = 'WITH_VAT_RECOURSE' | 'WITHOUT_VAT_RECOURSE';
export type MarginScope = 'GLOBAL' | 'CATEGORY' | 'PRODUCT' | 'PRICE_LIST';
export type MarginCostBasis = 'LAST_PURCHASE_COST' | 'AVERAGE_COST';
export type MarginStatus = 'OK' | 'WARNING' | 'BLOCKED';
export type MarginDocumentType = 'sales_quote' | 'sales_order';

export const PRICING_CHANNELS: readonly PricingChannel[] = [
  'DEFAULT',
  'B2B',
  'RETAIL',
  'ECOMMERCE',
];
export const PRICING_ROUNDING_MODES: readonly PricingRoundingMode[] = [
  'NONE',
  'SWISS_005',
  'HALF_UP_001',
];
export const DISCOUNT_MODES: readonly DiscountMode[] = ['MULTIPLICATIVE', 'ADDITIVE'];
export const PROMOTION_TYPES: readonly PromotionType[] = [
  'BUY_X_GET_Y',
  'FREE_GIFT',
  'BUNDLE_DISCOUNT',
  'CART_VALUE_TIER',
];
export const VAT_TREATMENTS: readonly VatTreatment[] = [
  'WITH_VAT_RECOURSE',
  'WITHOUT_VAT_RECOURSE',
];
export const MARGIN_SCOPES: readonly MarginScope[] = [
  'GLOBAL',
  'CATEGORY',
  'PRODUCT',
  'PRICE_LIST',
];
export const MARGIN_COST_BASES: readonly MarginCostBasis[] = ['LAST_PURCHASE_COST', 'AVERAGE_COST'];

export interface PricingResponse<T> {
  data: T;
  meta?: { current_page: number; last_page: number; per_page: number; total: number };
}

export interface PricingPriceListItem {
  id: string;
  price_list_id: string;
  product_id: string;
  price: string;
  min_quantity: string;
  max_quantity: string | null;
  discount_cascade: string | null;
  discount_mode: DiscountMode;
  valid_from: string | null;
  valid_to: string | null;
}

export interface PricingPriceListItemRequest {
  product_id: string;
  price: string;
  min_quantity?: string | null;
  max_quantity?: string | null;
  discount_cascade?: string | null;
  discount_mode?: DiscountMode;
  valid_from?: string | null;
  valid_to?: string | null;
  reason?: string | null;
}

export interface PricingPriceHistory {
  id: string;
  price_list_id: string | null;
  price_list_item_id: string | null;
  customer_special_price_id?: string | null;
  product_id: string | null;
  old_price: string | null;
  new_price: string | null;
  old_discount_cascade: string | null;
  new_discount_cascade: string | null;
  effective_at: string;
  changed_by_user_id: string | null;
  changed_by_name: string | null;
  reason: string | null;
}

export interface CustomerSpecialPrice {
  id: string;
  customer_id: string;
  product_id: string;
  fixed_price: string | null;
  discount_cascade: string | null;
  discount_mode: DiscountMode;
  currency: string;
  valid_from: string | null;
  valid_to: string | null;
}

export interface CustomerSpecialPriceRequest {
  customer_id: string;
  product_id: string;
  currency: string;
  fixed_price?: string | null;
  discount_cascade?: string | null;
  discount_mode?: DiscountMode;
  valid_from?: string | null;
  valid_to?: string | null;
  reason?: string | null;
}

/** Rules of a promotion, by type: buy_qty/pay_qty (3x2), gift_*, product_ids/discount_percent (bundle), tiers (cart value). */
export interface PromotionRules {
  product_id?: string | null;
  buy_qty?: number;
  pay_qty?: number;
  trigger_product_id?: string | null;
  trigger_min_quantity?: number;
  trigger_min_amount?: number;
  gift_product_id?: string | null;
  gift_quantity?: number;
  vat_treatment?: VatTreatment;
  product_ids?: string[];
  min_each?: number;
  discount_percent?: number;
  tiers?: { min_amount: number; discount_percent: number }[];
}

export interface PricingPromotion {
  id: string;
  code: string;
  name: string;
  type: PromotionType;
  rules: PromotionRules;
  valid_from: string | null;
  valid_to: string | null;
  is_stackable: boolean;
  is_active: boolean;
}

export interface PricingPromotionRequest {
  code: string;
  name: string;
  type: PromotionType;
  rules: PromotionRules;
  valid_from?: string | null;
  valid_to?: string | null;
  is_stackable?: boolean;
  is_active?: boolean;
}

export interface MarginPolicy {
  id: string;
  scope: MarginScope;
  scope_id: string | null;
  min_margin_percent: string;
  cost_basis: MarginCostBasis;
  block_on_violation: boolean;
  requires_approval_role: string | null;
}

export interface MarginPolicyRequest {
  scope: MarginScope;
  scope_id?: string | null;
  min_margin_percent: string;
  cost_basis?: MarginCostBasis;
  block_on_violation?: boolean;
  requires_approval_role?: string | null;
}

export interface MarginOverrideApproval {
  id: string;
  document_type: MarginDocumentType;
  document_id: string;
  calculated_margin_percent: string;
  threshold_percent: string;
  approved_by_user_id: string;
  approved_at: string;
  notes: string | null;
}

export interface PricingResolveLineRequest {
  product_id: string;
  quantity: number | string;
  manual_discount_cascade?: string | null;
}

export interface PricingResolveRequest {
  customer_id?: string | null;
  currency: string;
  channel?: PricingChannel;
  date?: string;
  lines: PricingResolveLineRequest[];
}

export interface PricingTraceStep {
  rule: string;
  price?: string;
  [key: string]: unknown;
}

export interface PricingResolvedLine {
  product_id: string;
  quantity: string;
  base_price: string;
  price_source: string;
  price_list_id: string | null;
  discount_cascade: string;
  discount_mode: DiscountMode;
  manual_discount_cascade: string;
  discount_percentage: string;
  rounding_mode: PricingRoundingMode;
  rounding_delta: string;
  net_unit_price: string;
  line_total: string;
  promotion_discount: string;
  line_net_total: string;
  effective_unit_price: string;
  cost: string;
  margin_percent: string | null;
  margin_status: MarginStatus;
  margin_threshold_percent: string | null;
  requires_approval_role: string | null;
  trace: PricingTraceStep[];
}

export interface PricingResolveResult {
  currency: string;
  channel: PricingChannel;
  date: string;
  lines: PricingResolvedLine[];
  gifts: {
    product_id: string;
    quantity: string;
    vat_treatment: VatTreatment;
    vat_recourse_amount: string;
    promotion_code: string;
  }[];
  applied_promotions: {
    promotion_id: string;
    code: string;
    type: PromotionType;
    discount_amount: string;
  }[];
  document_discount: string;
  subtotal: string;
  total: string;
  margin: {
    status: MarginStatus;
    margin_percent: string | null;
    threshold_percent: string | null;
    document_margin_percent: string | null;
  };
}

export interface MarginDocumentCheck {
  status: MarginStatus;
  margin_percent: string | null;
  threshold_percent: string | null;
  has_approval: boolean;
}
