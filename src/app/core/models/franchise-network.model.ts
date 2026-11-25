/**
 * Franchise network governance (Mod 244, Issue #490): wire types of the franchisor command view, the affiliation agreements, the
 * royalty and marketing fund billing, the central pushes, the store audits and the franchisee portal. Amounts are decimal strings.
 */

export type FrnDecimal = string | number;

export const FRN_STORE_TYPES = ['franchisee', 'dos'] as const;
export type FrnStoreType = (typeof FRN_STORE_TYPES)[number];

export const FRN_STORE_STATUSES = ['pipeline', 'active', 'suspended', 'closed'] as const;
export type FrnStoreStatus = (typeof FRN_STORE_STATUSES)[number];

export const FRN_SIZE_CLUSTERS = ['small', 'medium', 'large'] as const;
export type FrnSizeCluster = (typeof FRN_SIZE_CLUSTERS)[number];

export const FRN_AGREEMENT_STATUSES = [
  'draft',
  'active',
  'renewed',
  'terminated',
  'expired',
] as const;
export type FrnAgreementStatus = (typeof FRN_AGREEMENT_STATUSES)[number];

export const FRN_PAYMENT_METHODS = ['sepa_sdd', 'lsv_plus', 'bank_transfer'] as const;
export type FrnPaymentMethod = (typeof FRN_PAYMENT_METHODS)[number];

export const FRN_GUARANTEE_TYPES = ['none', 'bank_guarantee', 'insurance', 'deposit'] as const;
export type FrnGuaranteeType = (typeof FRN_GUARANTEE_TYPES)[number];

export const FRN_STARTUP_MODES = ['none', 'full_exemption', 'reduced_rate', 'ramp_up'] as const;
export type FrnStartupMode = (typeof FRN_STARTUP_MODES)[number];

export const FRN_JURISDICTIONS = ['IT', 'CH'] as const;
export type FrnJurisdiction = (typeof FRN_JURISDICTIONS)[number];

export const FRN_PUSH_TYPES = ['catalog', 'price_list', 'promotion', 'loyalty_campaign'] as const;
export type FrnPushType = (typeof FRN_PUSH_TYPES)[number];

export type FrnPushStatus = 'draft' | 'completed' | 'partial' | 'failed';
export type FrnTargetStatus = 'pending' | 'synced' | 'acknowledged' | 'failed';
export type FrnPriceType = 'recommended' | 'maximum';
export type FrnRunStatus = 'calculated' | 'invoiced';
export type FrnStatementStatus = 'calculated' | 'invoiced' | 'skipped';
export type FrnLoyaltyType = 'earn' | 'redeem';
export type FrnAuditStatus = 'draft' | 'submitted';
export type FrnActionStatus = 'open' | 'done';
export type FrnPosition = 'top_quartile' | 'above_median' | 'below_median';

export const FRN_SELL_OUT_SOURCES = ['pos', 'fiscal_printer', 'manual'] as const;
export type FrnSellOutSource = (typeof FRN_SELL_OUT_SOURCES)[number];

export const FRN_AUDIT_CATEGORIES = [
  'signage',
  'cleanliness',
  'visual_merchandising',
  'layout',
  'stock_pricing',
] as const;
export type FrnAuditCategory = (typeof FRN_AUDIT_CATEGORIES)[number];

// --- Envelopes ---

export interface FrnEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface FrnPageMeta {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

export interface FrnPage<T> extends FrnEnvelope<T[]> {
  meta: FrnPageMeta;
}

/** RFC 7807 problem of a refused rule: `code` picks the translated text, 422 brings the field errors. */
export interface FrnProblem {
  code?: string;
  detail?: string;
  errors?: Record<string, string[]>;
  params?: Record<string, unknown>;
}

// --- Stores ---

export interface FrnStore {
  id: string;
  franchisee_tenant_id: string | null;
  linked: boolean;
  contact_id: string | null;
  code: string;
  name: string;
  store_type: FrnStoreType;
  status: FrnStoreStatus;
  country: string;
  city: string | null;
  address: string | null;
  postal_code: string | null;
  size_cluster: FrnSizeCluster;
  opened_on: string | null;
  area_manager_user_id: string | null;
  vat_number: string | null;
  uid_number: string | null;
}

export interface FrnStorePayload {
  code: string;
  name: string;
  store_type: FrnStoreType;
  status?: FrnStoreStatus;
  country: string;
  city?: string | null;
  address?: string | null;
  postal_code?: string | null;
  size_cluster?: FrnSizeCluster;
  opened_on?: string | null;
  area_manager_user_id?: string | null;
  vat_number?: string | null;
  uid_number?: string | null;
}

// --- Formulas ---

export interface FrnTier {
  from: FrnDecimal;
  to: FrnDecimal | null;
  rate: FrnDecimal;
}

export interface FrnFormula {
  id: string;
  code: string;
  label: string;
  labels: Record<string, string>;
  description: string;
  descriptions: Record<string, string> | null;
  is_preset: boolean;
  royalty_tiers: FrnTier[];
  marketing_tiers: FrnTier[];
  minimum_guarantee: FrnDecimal;
  startup_months: number;
  startup_mode: FrnStartupMode;
  startup_reduction_percent: FrnDecimal;
  ramp_start_percent: FrnDecimal;
  startup_applies_to_marketing: boolean;
  currency: string;
  is_active: boolean;
}

export interface FrnFormulaPayload {
  code: string;
  labels: Record<string, string>;
  royalty_tiers: FrnTier[];
  marketing_tiers: FrnTier[];
  minimum_guarantee: number;
  startup_months: number;
  startup_mode: FrnStartupMode;
  startup_reduction_percent: number;
  ramp_start_percent: number;
  startup_applies_to_marketing: boolean;
  currency: string;
}

export interface FrnSimulation {
  net_sales: string;
  royalty_gross: string;
  startup_month: number | null;
  startup_factor: string;
  royalty_after_startup: string;
  minimum_guarantee_applied: string;
  minimum_adjustment: string;
  royalty_charged: string;
  marketing_fund: string;
  breakdown: {
    royalty_slices: FrnSlice[];
    marketing_slices: FrnSlice[];
    marketing_gross: string;
  };
}

export interface FrnSlice {
  from: string;
  to: string | null;
  rate: string;
  base: string;
  amount: string;
}

// --- Agreements ---

export interface FrnZone {
  label?: string | null;
  postal_codes?: string[] | null;
  radius_km?: FrnDecimal | null;
}

export interface FrnFinding {
  code: string;
  severity: 'error' | 'warning';
  params: Record<string, string | number>;
}

export interface FrnDeferral {
  period: string;
  amount: FrnDecimal;
  recognized: boolean;
  recognized_at: string | null;
}

export interface FrnAgreement {
  id: string;
  store_id: string;
  store_code: string | null;
  store_name: string | null;
  formula_id: string | null;
  agreement_number: string;
  status: FrnAgreementStatus;
  jurisdiction: FrnJurisdiction;
  disclosure_delivered_on: string | null;
  signed_on: string | null;
  start_date: string;
  end_date: string;
  term_months: number;
  auto_renew: boolean;
  renewal_notice_days: number;
  exclusivity_zone: FrnZone | null;
  entry_fee: FrnDecimal;
  entry_fee_deferral_months: number;
  min_purchase_amount: FrnDecimal;
  min_purchase_source: string;
  approved_supplier_ids: string[] | null;
  guarantee_type: FrnGuaranteeType;
  guarantee_amount: FrnDecimal;
  guarantee_reference: string | null;
  guarantee_expires_on: string | null;
  payment_method: FrnPaymentMethod;
  mandate_reference: string | null;
  mandate_signed_on: string | null;
  currency: string;
  non_binding_pricing: boolean;
  notes?: string | null;
  findings: FrnFinding[];
  alerts: FrnFinding[];
  deferrals?: FrnDeferral[];
}

export interface FrnAgreementPayload {
  store_id: string;
  formula_id?: string | null;
  jurisdiction: FrnJurisdiction;
  disclosure_delivered_on?: string | null;
  signed_on?: string | null;
  start_date: string;
  end_date: string;
  auto_renew: boolean;
  renewal_notice_days: number;
  exclusivity_zone?: FrnZone | null;
  entry_fee: number;
  entry_fee_deferral_months: number;
  min_purchase_amount: number;
  min_purchase_source: string;
  guarantee_type: FrnGuaranteeType;
  guarantee_amount: number;
  guarantee_reference?: string | null;
  guarantee_expires_on?: string | null;
  payment_method: FrnPaymentMethod;
  mandate_reference?: string | null;
  mandate_signed_on?: string | null;
  currency: string;
  non_binding_pricing: boolean;
  notes?: string | null;
}

// --- Pushes ---

export interface FrnTarget {
  id: string;
  push_id: string;
  store_id: string;
  store_code: string | null;
  store_name: string | null;
  status: FrnTargetStatus;
  attempts: number;
  last_error: string | null;
  synced_at: string | null;
  acknowledged_at: string | null;
  next_retry_at: string | null;
}

export interface FrnPushItem {
  sku: string;
  name: string;
  price?: FrnDecimal | null;
  price_type?: FrnPriceType | null;
}

export interface FrnPriceRow {
  sku: string;
  price: FrnDecimal;
  price_type?: FrnPriceType | null;
}

export interface FrnPushPayload {
  items?: FrnPushItem[];
  prices?: FrnPriceRow[];
  promotion?: {
    name: string;
    valid_from: string;
    valid_to: string;
    discount_percent?: number | null;
  };
  loyalty?: { name: string; points_multiplier: number; valid_from?: string; valid_to?: string };
}

export interface FrnPush {
  id: string;
  push_type: FrnPushType;
  title: string;
  target_mode: 'all' | 'selected';
  status: FrnPushStatus;
  effective_from: string | null;
  dispatched_at: string | null;
  payload?: FrnPushPayload;
  targets?: FrnTarget[];
  targets_total?: number;
}

export interface FrnPushCreatePayload {
  push_type: FrnPushType;
  title: string;
  target_mode: 'all' | 'selected';
  store_ids?: string[];
  effective_from?: string | null;
  payload: FrnPushPayload;
  dispatch: boolean;
}

// --- Sell-out, purchases, loyalty ---

export interface FrnSellOut {
  id: string;
  store_id: string;
  period: string;
  gross_sales: FrnDecimal;
  returns: FrnDecimal;
  discounts: FrnDecimal;
  net_sales: FrnDecimal;
  tickets_count: number;
  visitors_count: number;
  cost_of_goods_sold: FrnDecimal;
  average_inventory_value: FrnDecimal;
  source: FrnSellOutSource;
  pos_reference: string | null;
  submitted_at: string | null;
}

export interface FrnSellOutPayload {
  gross_sales: number;
  returns: number;
  discounts: number;
  tickets_count: number;
  visitors_count: number;
  cost_of_goods_sold: number;
  average_inventory_value: number;
  source: FrnSellOutSource;
  pos_reference?: string | null;
}

export interface FrnPurchase {
  id: string;
  store_id: string;
  period: string;
  purchased_amount: FrnDecimal;
  required_amount: FrnDecimal;
  compliant: boolean;
}

export interface FrnLoyaltyTransaction {
  id: string;
  store_id: string;
  earned_store_id: string | null;
  customer_ref: string;
  type: FrnLoyaltyType;
  points: number;
  value_amount: FrnDecimal;
  occurred_at: string;
  period: string;
  settled: boolean;
}

export interface FrnLoyaltyPosition {
  store_id: string;
  store_code: string | null;
  store_name: string | null;
  owed: FrnDecimal;
  receivable: FrnDecimal;
  net: FrnDecimal;
}

// --- Billing ---

export interface FrnStatement {
  id: string;
  run_id: string;
  store_id: string;
  store_code: string | null;
  store_name: string | null;
  period: string;
  status: FrnStatementStatus;
  skip_reason: string | null;
  net_sales: FrnDecimal;
  royalty_gross: FrnDecimal;
  startup_factor: FrnDecimal;
  royalty_after_startup: FrnDecimal;
  minimum_guarantee_applied: FrnDecimal;
  minimum_adjustment: FrnDecimal;
  royalty_charged: FrnDecimal;
  marketing_fund: FrnDecimal;
  loyalty_settlement: FrnDecimal;
  total_net: FrnDecimal;
  breakdown: {
    royalty_slices?: FrnSlice[];
    marketing_slices?: FrnSlice[];
    loyalty?: { owed: string; receivable: string; net: string };
  } | null;
  invoice_id: string | null;
}

export interface FrnBatchItem {
  store_id: string;
  store_code: string;
  invoice_id: string;
  invoice_number: string | null;
  mandate_reference: string | null;
  mandate_signed_on: string | null;
  amount: FrnDecimal;
  excluded_reason: string | null;
}

export interface FrnBatch {
  id: string;
  run_id: string;
  scheme: 'sepa_sdd' | 'lsv_plus';
  status: string;
  total_amount: FrnDecimal;
  currency: string;
  collection_date: string;
  items: FrnBatchItem[];
}

export interface FrnRun {
  id: string;
  period: string;
  status: FrnRunStatus;
  stores_count: number;
  total_royalty: FrnDecimal;
  total_marketing: FrnDecimal;
  total_minimum_adjustment: FrnDecimal;
  total_loyalty_settlement: FrnDecimal;
  total_net: FrnDecimal;
  currency: string;
  calculated_at: string | null;
  invoiced_at: string | null;
  statements?: FrnStatement[];
  batches?: FrnBatch[];
}

// --- Audits ---

export interface FrnCriterion {
  code: string;
  category: FrnAuditCategory;
  label: string;
  hint: string;
  weight: FrnDecimal;
  max_score: FrnDecimal;
  critical: boolean;
}

export interface FrnTemplate {
  id: string;
  code: string;
  label: string;
  is_preset: boolean;
  pass_threshold_percent: FrnDecimal;
  is_active: boolean;
  criteria: FrnCriterion[];
}

export interface FrnAnswer {
  criterion_code: string;
  score: FrnDecimal;
  notes: string | null;
}

export interface FrnPhoto {
  id: string;
  original_name: string;
  mime: string | null;
  size: number;
  criterion_code: string | null;
  caption: string | null;
  taken_at: string;
}

export interface FrnAction {
  id: string;
  audit_id: string;
  store_id: string;
  criterion_code: string;
  description: string;
  due_date: string;
  status: FrnActionStatus;
  completed_at: string | null;
  completion_note: string | null;
  overdue: boolean;
}

export interface FrnAudit {
  id: string;
  store_id: string;
  store_code: string | null;
  store_name: string | null;
  template_id: string;
  template_code: string | null;
  auditor_id: string | null;
  status: FrnAuditStatus;
  audited_on: string;
  score: FrnDecimal;
  max_score: FrnDecimal;
  score_percent: FrnDecimal;
  passed: boolean | null;
  notes: string | null;
  answers: FrnAnswer[];
  photos: FrnPhoto[];
  submitted_at: string | null;
  actions?: FrnAction[];
}

// --- Benchmark ---

export interface FrnAggregate {
  average: string | null;
  median: string | null;
  p75: string | null;
  sample_size: number;
}

export interface FrnBenchmarkRow {
  code: string;
  label: string;
  description: string;
  unit: 'percent' | 'currency' | 'ratio' | 'number';
  higher_is_better: boolean;
  own: string | null;
  network: FrnAggregate | null;
  cluster: FrnAggregate | null;
  position: FrnPosition | null;
}

export interface FrnBenchmark {
  period: string | null;
  cluster: FrnSizeCluster;
  cluster_hidden: boolean;
  rows: FrnBenchmarkRow[];
}

export interface FrnBenchmarkDimension {
  code: string;
  label: string;
  description: string;
  unit: string;
  higher_is_better: boolean;
}

// --- Dashboard, lookups, portal ---

export interface FrnDashboard {
  period: string;
  stores: {
    total: number;
    active: number;
    franchisee: number;
    directly_operated: number;
    not_linked: number;
    reporting: number;
  };
  sell_out: {
    net: string;
    previous_month: string;
    same_month_last_year: string;
    mom_percent: string | null;
    yoy_percent: string | null;
  };
  agreements: { active: number; attention: number };
  billing: {
    period: string;
    status: FrnRunStatus;
    stores_count: number;
    total_royalty: string;
    total_marketing: string;
    total_minimum_adjustment: string;
    total_loyalty_settlement: string;
    total_net: string;
    currency: string;
  } | null;
  pushes: {
    recent: {
      id: string;
      title: string;
      push_type: FrnPushType;
      status: FrnPushStatus;
      dispatched_at: string | null;
    }[];
    failed_deliveries: number;
    awaiting_acknowledgement: number;
  };
  audits: {
    submitted_90_days: number;
    average_score_percent: string | null;
    failed: number;
    open_actions: number;
    overdue_actions: number;
  };
  purchases: { non_compliant: number };
}

export interface FrnRole {
  is_franchisor: boolean;
  is_franchisee: boolean;
  can_manage: boolean;
  can_audit: boolean;
  can_portal_write: boolean;
}

export interface FrnLookups {
  codes: Record<string, string[]>;
  formulas: FrnFormula[];
  audit_templates: FrnTemplate[];
  benchmark_dimensions: FrnBenchmarkDimension[];
  stores: FrnStore[];
  role: FrnRole;
}

export interface FrnNetworkStatRow {
  cluster: string;
  metric: string;
  label: string;
  average: string | null;
  median: string | null;
  p75: string | null;
  sample_size: number;
}

export interface FrnPortalContract {
  store: FrnStore;
  agreement: FrnAgreement | null;
  formula: FrnFormula | null;
  purchases: FrnPurchase[];
  purchase_compliance?: { months: number; compliant_months: number; shortfall: string };
}

export interface FrnPortalSync {
  id: string;
  status: FrnTargetStatus;
  synced_at: string | null;
  acknowledged_at: string | null;
  push: {
    id: string;
    push_type: FrnPushType;
    title: string;
    effective_from: string | null;
    payload: (FrnPushPayload & {
      items?: (FrnPushItem & { non_binding?: boolean; downgraded_to_recommended?: boolean })[];
      prices?: (FrnPriceRow & { non_binding?: boolean; downgraded_to_recommended?: boolean })[];
    }) | null;
  } | null;
}

export interface FrnPortalStatements {
  statements: FrnStatement[];
  sell_out: FrnSellOut[];
}
