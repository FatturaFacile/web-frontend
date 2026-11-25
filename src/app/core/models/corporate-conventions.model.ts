/**
 * Corporate conventions, partner employee discounts and B2B welfare cards (Mod 358).
 * Amounts are decimal strings, exactly as the API reports them: the screens never add money with floats.
 */

export type CcvDecimal = string;

export const CCV_PARTNER_TYPES = [
  'CORPORATE',
  'CRAL',
  'PROFESSIONAL_ORDER',
  'UNION',
  'UNIVERSITY',
  'PUBLIC_BODY',
  'INSURANCE',
  'ASSOCIATION',
] as const;
export type CcvPartnerType = (typeof CCV_PARTNER_TYPES)[number];

export const CCV_CONVENTION_STATUSES = ['DRAFT', 'ACTIVE', 'SUSPENDED', 'EXPIRED'] as const;
export type CcvConventionStatus = (typeof CCV_CONVENTION_STATUSES)[number];

export const CCV_VERIFICATION_METHODS = [
  'WORK_EMAIL_OTP',
  'MEMBERSHIP_CARD_PREFIX',
  'HASHED_EMPLOYEE_LIST',
  'PROMO_CODE',
] as const;
export type CcvVerificationMethod = (typeof CCV_VERIFICATION_METHODS)[number];

export const CCV_RULE_TYPES = [
  'PRICE_LIST',
  'CATEGORY_PERCENTAGE',
  'PRODUCT_FAMILY_PERCENTAGE',
  'GLOBAL_PERCENTAGE',
] as const;
export type CcvRuleType = (typeof CCV_RULE_TYPES)[number];

export const CCV_SUBSIDY_TYPES = ['FIXED_AMOUNT', 'PERCENTAGE'] as const;
export type CcvSubsidyType = (typeof CCV_SUBSIDY_TYPES)[number];

export const CCV_SUBSIDY_PURPOSES = [
  'DLGS_81_08_VDT',
  'PREVENTIVE_HEALTHCARE',
  'SPORTS_WELLNESS',
  'GENERAL',
] as const;
export type CcvSubsidyPurpose = (typeof CCV_SUBSIDY_PURPOSES)[number];

export const CCV_BILLING_CYCLES = ['MONTHLY', 'QUARTERLY', 'IMMEDIATE'] as const;
export type CcvBillingCycle = (typeof CCV_BILLING_CYCLES)[number];

export const CCV_RELATIONSHIPS = ['SPOUSE', 'CHILD', 'PARENT'] as const;
export type CcvRelationship = (typeof CCV_RELATIONSHIPS)[number];

export const CCV_ENROLLMENT_STATUSES = ['PENDING_OTP', 'ACTIVE', 'REVOKED', 'EXPIRED'] as const;
export type CcvEnrollmentStatus = (typeof CCV_ENROLLMENT_STATUSES)[number];

export const CCV_SPLIT_BILLING_STATUSES = [
  'PENDING_CONSOLIDATION',
  'INVOICED',
  'PAID',
  'DISPUTED',
] as const;
export type CcvSplitBillingStatus = (typeof CCV_SPLIT_BILLING_STATUSES)[number];

export const CCV_REIMBURSEMENT_STATUSES = [
  'PENDING_SETTLEMENT',
  'SUBMITTED_TO_PROVIDER',
  'RECONCILED',
  'REJECTED',
] as const;
export type CcvReimbursementStatus = (typeof CCV_REIMBURSEMENT_STATUSES)[number];

export const CCV_WELFARE_JURISDICTIONS = ['IT_ART51_TUIR', 'CH_REKA_LUNCHCHECK'] as const;
export type CcvWelfareJurisdiction = (typeof CCV_WELFARE_JURISDICTIONS)[number];

export const CCV_WELFARE_PROVIDERS = [
  'EDENRED',
  'PELLEGRINI',
  'PLUXEE_SODEXO',
  'EUDAIMON',
  'DOUBLEYOU',
  'REKA_CARD',
  'LUNCH_CHECK',
  'BONCADEAU',
  'OTHER',
] as const;
export type CcvWelfareProvider = (typeof CCV_WELFARE_PROVIDERS)[number];

export const CCV_WELFARE_CATEGORIES = [
  'EDUCATION',
  'HEALTHCARE',
  'SPORTS_FITNESS',
  'CULTURE_LEISURE',
  'SHOPPING_VOUCHER_EXEMPT',
  'MEAL_VOUCHER',
] as const;
export type CcvWelfareCategory = (typeof CCV_WELFARE_CATEGORIES)[number];

export type CcvSourceDocumentType = 'POS_RECEIPT' | 'INVOICE' | 'ECOMMERCE_ORDER';

// --- API envelopes and problems ---

export interface CcvPageMeta {
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
}

export interface CcvEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
  meta?: CcvPageMeta;
}

export interface CcvPage<T> {
  success: boolean;
  message: string;
  data: T[];
  meta: CcvPageMeta;
}

/** RFC 7807 problem the API answers with: `code` is the translation key suffix, `params` feed the text. */
export interface CcvProblem {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  code?: string;
  params?: Record<string, unknown>;
  errors?: Record<string, string[]>;
}

// --- Conventions ---

export interface CcvDiscountRule {
  id?: string;
  priority: number;
  rule_type: CcvRuleType;
  target_price_list_id: string | null;
  target_category_id: string | null;
  discount_percentage: CcvDecimal | number;
  exclude_promotional_items: boolean;
  cumulative_with_other_discounts: boolean;
  min_cart_amount: CcvDecimal | number | null;
}

export interface CcvConvention {
  id: string;
  code: string;
  slug: string;
  landing_path: string;
  name: string;
  partner_company_name: string;
  partner_vat_number: string | null;
  partner_uid_number: string | null;
  partner_contact_id: string | null;
  partner_type: CcvPartnerType;
  country_code: 'IT' | 'CH';
  currency: 'EUR' | 'CHF';
  valid_from: string;
  valid_to: string | null;
  status: CcvConventionStatus;
  eligible_population: number | null;
  hr_contact_name: string | null;
  hr_contact_email: string | null;
  hr_contact_phone: string | null;
  has_contract_document: boolean;
  verification_methods: CcvVerificationMethod[];
  allowed_email_domains: string[];
  card_number_prefix: string | null;
  card_number_regex: string | null;
  static_convention_code: string | null;
  allow_family_members: boolean;
  max_family_members: number;
  annual_spending_cap_per_beneficiary: CcvDecimal | null;
  employer_subsidy_enabled: boolean;
  employer_subsidy_type: CcvSubsidyType | null;
  employer_subsidy_value: CcvDecimal | null;
  employer_subsidy_annual_cap: CcvDecimal | null;
  subsidy_purpose: CcvSubsidyPurpose;
  split_billing_anonymized: boolean;
  billing_cycle: CcvBillingCycle;
  has_logo: boolean;
  primary_color: string | null;
  welcome_message_key: string | null;
  enrolled_employees_count?: number;
  enrolled_family_count?: number;
  discount_rules?: CcvDiscountRule[];
}

export interface CcvConventionPayload {
  code: string;
  slug?: string | null;
  name: string;
  partner_company_name: string;
  partner_vat_number: string | null;
  partner_uid_number: string | null;
  partner_type: CcvPartnerType;
  country_code: 'IT' | 'CH';
  currency: 'EUR' | 'CHF';
  valid_from: string;
  valid_to: string | null;
  eligible_population: number | null;
  hr_contact_name: string | null;
  hr_contact_email: string | null;
  hr_contact_phone: string | null;
  verification_methods: CcvVerificationMethod[];
  allowed_email_domains: string[];
  card_number_prefix: string | null;
  card_number_regex: string | null;
  static_convention_code: string | null;
  allow_family_members: boolean;
  max_family_members: number;
  annual_spending_cap_per_beneficiary: number | null;
  employer_subsidy_enabled: boolean;
  employer_subsidy_type: CcvSubsidyType | null;
  employer_subsidy_value: number | null;
  employer_subsidy_annual_cap: number | null;
  subsidy_purpose: CcvSubsidyPurpose;
  split_billing_anonymized: boolean;
  billing_cycle: CcvBillingCycle;
  primary_color: string | null;
  welcome_message_key: string | null;
  discount_rules: CcvDiscountRule[];
}

export interface CcvConventionFilters {
  q?: string;
  country_code?: 'IT' | 'CH' | '';
  partner_type?: CcvPartnerType | '';
  status?: CcvConventionStatus | '';
  per_page?: number;
  page?: number;
}

export interface CcvImportResult {
  received: number;
  imported: number;
  duplicates: number;
  invalid: number;
  preview: { hint: string; sha256: string }[];
}

export interface CcvIdentifierStats {
  total: number;
  used: number;
}

// --- Beneficiaries ---

export interface CcvEnrollment {
  id: string;
  convention_id: string;
  convention_name: string | null;
  currency: 'EUR' | 'CHF' | null;
  customer_id: string;
  beneficiary_type: 'PRIMARY_EMPLOYEE' | 'FAMILY_MEMBER';
  parent_enrollment_id: string | null;
  relationship: 'SELF' | CcvRelationship;
  full_name: string;
  verified_email: string | null;
  membership_card_number: string | null;
  verification_method: CcvVerificationMethod;
  verified_at: string | null;
  expires_at: string | null;
  status: CcvEnrollmentStatus;
  wallet_pass_id: string;
  qr_payload: string;
  annual_used_amount: CcvDecimal;
  annual_used_subsidy: CcvDecimal;
  annual_spending_cap: CcvDecimal | null;
  annual_cap_remaining: CcvDecimal | null;
  employer_subsidy_cap_remaining: CcvDecimal | null;
  family_members?: CcvEnrollment[];
}

// --- Till: pricing and checkout ---

export interface CcvCartLine {
  line_id?: string;
  product_id?: string | null;
  quantity: number;
  unit_price?: number | null;
  unit_cost?: number | null;
  category_id?: string | null;
  is_promotional?: boolean;
  existing_discount_percent?: number;
}

export interface CcvPricingLine {
  line_id: string;
  gross: CcvDecimal;
  existing_discount: CcvDecimal;
  convention_discount: CcvDecimal;
  net: CcvDecimal;
  cost: CcvDecimal;
  applied_rule_ids: string[];
}

export interface CcvPricingTotals {
  total_gross_amount: CcvDecimal;
  convention_discount_amount: CcvDecimal;
  payable_after_discount: CcvDecimal;
  employer_subsidy_amount: CcvDecimal;
  employee_paid_amount: CcvDecimal;
  cost_amount: CcvDecimal;
}

export interface CcvPricing {
  enrollment: CcvEnrollment;
  lines: CcvPricingLine[];
  totals: CcvPricingTotals;
  cap: { remaining_before: CcvDecimal | null; counted_spend: CcvDecimal; reached: boolean };
  subsidy: { remaining_before: CcvDecimal | null };
}

export interface CcvPricingRequest {
  identifier: string;
  convention_id?: string | null;
  currency?: string | null;
  lines: CcvCartLine[];
}

export interface CcvCheckoutRequest {
  enrollment_id: string;
  lines: CcvCartLine[];
  source_document_type: CcvSourceDocumentType;
  source_document_id: string;
  employee_document_id?: string | null;
  transaction_date?: string | null;
  currency?: string | null;
}

export interface CcvSplitBilling {
  id: string;
  convention_id: string;
  convention_name?: string | null;
  enrollment_id: string;
  beneficiary_name?: string | null;
  source_document_type: CcvSourceDocumentType;
  source_document_id: string;
  transaction_date: string;
  currency: string;
  total_gross_amount: CcvDecimal;
  convention_discount_amount: CcvDecimal;
  employer_subsidy_amount: CcvDecimal;
  employee_paid_amount: CcvDecimal;
  employee_document_id: string | null;
  b2b_consolidated_invoice_id: string | null;
  billing_status: CcvSplitBillingStatus;
  notes: string | null;
}

export interface CcvCheckoutResult extends Omit<CcvPricing, 'enrollment'> {
  split_billing: CcvSplitBilling;
}

// --- Split billing consolidation ---

export interface CcvPendingQuota {
  convention_id: string;
  convention_name: string;
  partner_company_name: string;
  billing_cycle: CcvBillingCycle;
  currency: string;
  rows_count: number;
  total_employer_quota: CcvDecimal;
  oldest_transaction_date: string;
  newest_transaction_date: string;
}

export interface CcvScheduleLine {
  date: string;
  beneficiary: string;
  document: string;
  gross: CcvDecimal;
  discount: CcvDecimal;
  employer_quota: CcvDecimal;
  employee_paid: CcvDecimal;
}

export interface CcvConsolidationPreview {
  convention_id: string;
  convention_name: string;
  partner_company_name: string;
  currency: string;
  period_from: string;
  period_to: string;
  anonymized: boolean;
  rows_count: number;
  total_employer_quota: CcvDecimal;
  schedule: CcvScheduleLine[];
}

export interface CcvConsolidationRequest {
  convention_id: string;
  period?: string;
  from?: string;
  to?: string;
  anonymize?: boolean | null;
}

export interface CcvConsolidationResult {
  invoice_id: string;
  invoice_number: string;
  total_gross: CcvDecimal;
  rows_count: number;
  total_employer_quota: CcvDecimal;
  attachment_url: string;
}

// --- Welfare vouchers ---

export interface CcvWelfareRedemption {
  id: string;
  source_document_type: CcvSourceDocumentType;
  source_document_id: string;
  enrollment_id: string | null;
  jurisdiction: CcvWelfareJurisdiction;
  provider: CcvWelfareProvider;
  welfare_category: CcvWelfareCategory;
  voucher_code_masked: string;
  currency: string;
  gross_voucher_amount: CcvDecimal;
  merchant_fee_percentage: CcvDecimal;
  merchant_fee_amount: CcvDecimal;
  net_expected_reimbursement: CcvDecimal;
  reimbursement_status: CcvReimbursementStatus;
  settlement_batch_reference: string | null;
  provider_self_invoice_number: string | null;
  settled_amount: CcvDecimal | null;
  reconciled_at: string | null;
  created_at: string | null;
}

export interface CcvWelfareRedeemRequest {
  source_document_type: CcvSourceDocumentType;
  source_document_id: string;
  enrollment_id?: string | null;
  jurisdiction: CcvWelfareJurisdiction;
  provider: CcvWelfareProvider;
  welfare_category: CcvWelfareCategory;
  voucher_code: string;
  currency: string;
  gross_voucher_amount: number;
  merchant_fee_percentage?: number | null;
}

export interface CcvWelfareSummaryRow {
  provider: CcvWelfareProvider;
  reimbursement_status: CcvReimbursementStatus;
  currency: string;
  vouchers: number;
  gross: CcvDecimal;
  fee: CcvDecimal;
  net: CcvDecimal;
}

export interface CcvWelfareFilters {
  provider?: CcvWelfareProvider | '';
  jurisdiction?: CcvWelfareJurisdiction | '';
  status?: CcvReimbursementStatus | '';
  batch?: string;
  from?: string;
  to?: string;
  per_page?: number;
  page?: number;
}

export interface CcvStatementLine {
  redemption_id?: string;
  voucher_code?: string;
  settled_amount: number;
}

export interface CcvReconcileRequest {
  provider: CcvWelfareProvider;
  batch_reference: string;
  self_invoice_number?: string | null;
  lines: CcvStatementLine[];
}

export interface CcvReconcileResult {
  reconciled: number;
  rejected: number;
  total_expected: CcvDecimal;
  total_settled: CcvDecimal;
  discrepancies: {
    redemption_id: string;
    voucher_code_masked: string;
    expected: CcvDecimal;
    settled: CcvDecimal;
    difference: CcvDecimal;
  }[];
}

// --- Analytics ---

export interface CcvRoiKpis {
  active_conventions: number;
  enrolled_employees: number;
  enrolled_family_members: number;
  transactions: number;
  gross_revenue: CcvDecimal;
  discount_granted: CcvDecimal;
  net_revenue: CcvDecimal;
  average_discount_percentage: CcvDecimal;
  employer_subsidy_billed: CcvDecimal;
  net_margin: CcvDecimal;
  pending_split_billing_amount: CcvDecimal;
  pending_welfare_vouchers: number;
  pending_welfare_amount: CcvDecimal;
}

export interface CcvRoiRow {
  convention_id: string;
  code: string;
  name: string;
  partner_company_name: string;
  country_code: 'IT' | 'CH';
  status: CcvConventionStatus;
  enrolled_employees: number;
  enrolled_family_members: number;
  eligible_population: number | null;
  conversion_rate: CcvDecimal | null;
  transactions: number;
  gross_revenue: CcvDecimal;
  discount_granted: CcvDecimal;
  net_revenue: CcvDecimal;
  average_discount_percentage: CcvDecimal;
  employer_subsidy_total: CcvDecimal;
  employer_subsidy_billed: CcvDecimal;
  employer_subsidy_pending: CcvDecimal;
  cost_amount: CcvDecimal;
  welfare_fees: CcvDecimal;
  net_margin: CcvDecimal;
}

export interface CcvRoi {
  currency: string;
  kpis: CcvRoiKpis;
  conventions: CcvRoiRow[];
}

export interface CcvRoiFilters {
  from?: string;
  to?: string;
  currency?: 'EUR' | 'CHF' | '';
  country_code?: 'IT' | 'CH' | '';
  convention_id?: string;
}

// --- Lookups ---

export interface CcvWelfareProviderOption {
  provider: CcvWelfareProvider;
  categories: CcvWelfareCategory[];
  default_fee_percentage: CcvDecimal;
}

export interface CcvLookups {
  partner_types: CcvPartnerType[];
  convention_statuses: CcvConventionStatus[];
  verification_methods: CcvVerificationMethod[];
  rule_types: CcvRuleType[];
  subsidy_types: CcvSubsidyType[];
  subsidy_purposes: CcvSubsidyPurpose[];
  billing_cycles: CcvBillingCycle[];
  relationships: CcvRelationship[];
  welfare_jurisdictions: CcvWelfareJurisdiction[];
  welfare_categories: CcvWelfareCategory[];
  welfare_providers: Record<CcvWelfareJurisdiction, CcvWelfareProviderOption[]>;
  price_lists: { id: string; name: string; currency: string }[];
  categories: { id: string; name: string; parent_id: string | null }[];
  conventions: {
    id: string;
    name: string;
    code: string;
    currency: 'EUR' | 'CHF';
    country_code: string;
  }[];
}

// --- Public landing page ---

export interface CcvPublicConvention {
  slug: string;
  name: string;
  partner_company_name: string;
  country_code: 'IT' | 'CH';
  valid_to: string | null;
  primary_color: string | null;
  welcome_message_key: string | null;
  has_logo: boolean;
  allow_family_members: boolean;
  max_family_members: number;
  verification: {
    work_email_otp: boolean;
    identifier: boolean;
    card: boolean;
    hashed_list: boolean;
    promo_code: boolean;
    email_domains: string[];
  };
}

export interface CcvPass {
  wallet_pass_id: string;
  full_name: string;
  beneficiary_type: 'PRIMARY_EMPLOYEE' | 'FAMILY_MEMBER';
  relationship: 'SELF' | CcvRelationship;
  status: CcvEnrollmentStatus;
  expires_at: string | null;
  qr_payload: string;
  convention: {
    name: string;
    partner_company_name: string;
    primary_color: string | null;
    allow_family_members: boolean;
    max_family_members: number;
  };
  qr_svg_url: string;
  qr_png_url: string;
  apple_wallet_url: string | null;
  google_wallet_url: string | null;
  family_members: {
    wallet_pass_id: string;
    full_name: string;
    relationship: CcvRelationship;
    status: CcvEnrollmentStatus;
  }[];
  can_add_family_member: boolean;
}

export interface CcvOtpRequested {
  expires_at: string;
  ttl_minutes: number;
}
