/**
 * Wire models of the dunning and debt collection module (Mod 014, Mahnwesen).
 * Money is always a decimal string ("1234.50"), dates are `YYYY-MM-DD`, timestamps ISO-8601.
 */

export const DC_LEVELS = [0, 1, 2, 3] as const;
export type DcLevel = (typeof DC_LEVELS)[number];

export const DC_CHANNELS = ['email', 'sms', 'whatsapp', 'pec', 'registered_mail'] as const;
export type DcChannel = (typeof DC_CHANNELS)[number];

export const DC_JURISDICTIONS = ['CH', 'IT'] as const;
export type DcJurisdiction = (typeof DC_JURISDICTIONS)[number];

export const DC_EXCLUSION_TYPES = ['manual', 'dispute', 'legal_hold'] as const;
export type DcExclusionType = (typeof DC_EXCLUSION_TYPES)[number];

export const DC_NOTICE_KINDS = ['reminder', 'messa_in_mora'] as const;
export type DcNoticeKind = (typeof DC_NOTICE_KINDS)[number];

export const DC_NOTICE_STATUSES = [
  'draft',
  'queued',
  'sent',
  'delivered',
  'failed',
  'cancelled',
] as const;
export type DcNoticeStatus = (typeof DC_NOTICE_STATUSES)[number];

export const DC_RECEIPT_KINDS = [
  'accettazione',
  'consegna',
  'mancata_consegna',
  'non_accettazione',
] as const;
export type DcReceiptKind = (typeof DC_RECEIPT_KINDS)[number];

export const DC_INTEREST_BASES = ['actual_365', 'actual_360', 'actual_actual'] as const;
export type DcInterestBasis = (typeof DC_INTEREST_BASES)[number];

export const DC_INTEREST_KINDS = ['statutory_ch', 'ecb_it', 'contractual'] as const;
export type DcInterestKind = (typeof DC_INTEREST_KINDS)[number];

export const DC_CURRENCIES = ['CHF', 'EUR'] as const;
export type DcCurrency = (typeof DC_CURRENCIES)[number];

export const DC_PLAN_STATUSES = ['active', 'completed', 'defaulted', 'cancelled'] as const;
export type DcPlanStatus = (typeof DC_PLAN_STATUSES)[number];

export const DC_BATCH_STATUSES = [
  'pending',
  'processing',
  'completed',
  'partial',
  'failed',
] as const;
export type DcBatchStatus = (typeof DC_BATCH_STATUSES)[number];

export const DC_DOSSIER_STATUSES = ['generated', 'submitted', 'closed'] as const;
export type DcDossierStatus = (typeof DC_DOSSIER_STATUSES)[number];

export const DC_PROPOSAL_STATUSES = ['proposed', 'excluded', 'waiting'] as const;
export type DcProposalStatus = (typeof DC_PROPOSAL_STATUSES)[number];

export const DC_EXCLUSION_REASONS = [
  'dispute',
  'payment_plan',
  'legal_hold',
  'manual',
  'settled',
  'below_threshold',
] as const;
export type DcExclusionReason = (typeof DC_EXCLUSION_REASONS)[number];

export const DC_LOCALES = ['it', 'en', 'de', 'fr'] as const;
export type DcLocale = (typeof DC_LOCALES)[number];

// --- Envelope ---

export interface DcEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface DcPageMeta {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

export interface DcPage<T> extends DcEnvelope<T[]> {
  meta: DcPageMeta;
}

/** RFC 7807 problem; `code` is the suffix of `debtCollection.error.<code>`. */
export interface DcProblem {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  code?: string;
  message?: string;
  errors?: Record<string, string[]>;
}

// --- Lookups and dashboard ---

export interface DcLookups {
  levels: DcLevel[];
  channels: DcChannel[];
  jurisdictions: DcJurisdiction[];
  exclusion_types: DcExclusionType[];
  notice_kinds: DcNoticeKind[];
  notice_statuses: DcNoticeStatus[];
  receipt_kinds: DcReceiptKind[];
  interest_bases: DcInterestBasis[];
  interest_kinds: DcInterestKind[];
  currencies: DcCurrency[];
  plan_statuses: DcPlanStatus[];
  template_codes: string[];
}

export interface DcMoneyTotal {
  currency: string;
  amount: string;
}

export interface DcDashboard {
  overdue: { currency: string; jurisdiction: DcJurisdiction; amount: string; items: number }[];
  proposals: { total: number; by_level: Record<string, number> };
  excluded: number;
  notices_30d: { sent: number; failed: number; delivered: number };
  enforcement_open: number;
  pec_awaiting_receipts: number;
  interest_accrued: DcMoneyTotal[];
  batches_running: number;
}

// --- Proposals ---

export interface DcProposalFilters {
  as_of?: string;
  jurisdiction?: DcJurisdiction;
  currency?: DcCurrency;
  customer_id?: string;
  level?: DcLevel;
  include_excluded?: 0 | 1;
  search?: string;
}

export interface DcProposalItem {
  receivable_item_id: string;
  case_id: string | null;
  customer_id: string;
  customer_name: string;
  document_number: string;
  due_date: string;
  currency: string;
  jurisdiction: DcJurisdiction;
  open_amount: string;
  days_overdue: number;
  current_level: DcLevel | null;
  proposed_level: DcLevel | null;
  status: DcProposalStatus;
  exclusion_reason: DcExclusionReason | null;
  waiting_until: string | null;
  interest_amount: string;
  interest_days: number;
  interest_rate_percent: string;
  fee_amount: string;
  total: string;
  policy_id: string | null;
}

export interface DcProposalGroup {
  key: string;
  customer_id: string;
  customer_name: string;
  currency: string;
  jurisdiction: DcJurisdiction;
  level: DcLevel;
  receivable_item_ids: string[];
  principal: string;
  interest: string;
  fee: string;
  total: string;
  new_due_date: string;
  channels: DcChannel[];
  has_pec: boolean;
  has_email: boolean;
  has_phone: boolean;
}

export interface DcProposals {
  items: DcProposalItem[];
  groups: DcProposalGroup[];
}

export interface DcCalculatePayload {
  receivable_item_id?: string;
  amount?: string;
  due_date?: string;
  currency?: string;
  jurisdiction?: DcJurisdiction;
  as_of: string;
  level?: DcLevel;
}

export interface DcCalculationSegment {
  from: string;
  to: string;
  days: number;
  rate_percent: string;
  interest: string;
}

export interface DcCalculation {
  principal: string;
  interest: string;
  fee: string;
  total: string;
  interest_days: number;
  rate_percent: string;
  basis: DcInterestBasis;
  segments: DcCalculationSegment[];
}

export interface DcGenerateGroup {
  customer_id: string;
  currency: string;
  level: DcLevel;
  receivable_item_ids: string[];
}

export interface DcGeneratePayload {
  groups: DcGenerateGroup[];
  as_of: string;
  channel: DcChannel;
  locale?: DcLocale;
  post_charges: boolean;
  dispatch: boolean;
}

export interface DcGenerateResult {
  notices: DcNotice[];
  batch: DcBatch | null;
}

// --- Notices and batches ---

export interface DcNoticeLine {
  receivable_item_id: string;
  document_number: string;
  due_date: string;
  principal: string;
  interest: string;
  interest_days: number;
  rate_percent: string;
}

export interface DcReceipt {
  id: string;
  kind: DcReceiptKind;
  message_id: string | null;
  received_at: string;
  notes: string | null;
}

export interface DcNotice {
  id: string;
  number: string;
  kind: DcNoticeKind;
  level: DcLevel;
  customer_id: string;
  customer_name: string;
  jurisdiction: DcJurisdiction;
  currency: string;
  principal: string;
  interest: string;
  fee: string;
  total: string;
  new_due_date: string | null;
  issued_on: string;
  channel: DcChannel;
  status: DcNoticeStatus;
  locale: DcLocale;
  batch_id: string | null;
  pec_message_id: string | null;
  sent_at: string | null;
  error: string | null;
  attempts: number;
  charge_receivable_item_id: string | null;
  lines: DcNoticeLine[];
  receipts: DcReceipt[];
  has_pdf: boolean;
}

export interface DcNoticeFilters {
  customer_id?: string;
  status?: DcNoticeStatus;
  level?: DcLevel;
  kind?: DcNoticeKind;
  batch_id?: string;
  page?: number;
}

export interface DcReceiptPayload {
  kind: DcReceiptKind;
  message_id?: string;
  received_at: string;
  notes?: string;
}

export interface DcBatch {
  id: string;
  channel: DcChannel;
  status: DcBatchStatus;
  total: number;
  sent: number;
  failed: number;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  notices?: DcNotice[];
}

// --- Policies, rates, templates, offices ---

export interface DcPolicyLevel {
  id?: string;
  level: DcLevel;
  min_days_overdue: number;
  wait_days: number;
  deadline_days: number;
  fee_amount: string;
  charge_interest: boolean;
  channels: DcChannel[];
  legal_warning: boolean;
  is_active: boolean;
}

export interface DcPolicy {
  id: string;
  name: string;
  jurisdiction: DcJurisdiction;
  currency: DcCurrency | null;
  customer_id: string | null;
  is_default: boolean;
  is_active: boolean;
  min_overdue_amount: string;
  interest_basis: DcInterestBasis;
  contractual_rate_percent: string | null;
  levels: DcPolicyLevel[];
}

export type DcPolicyPayload = Omit<DcPolicy, 'id'>;

export interface DcInterestRate {
  id: string;
  jurisdiction: DcJurisdiction;
  kind: DcInterestKind;
  base_rate_percent: string;
  markup_percent: string;
  effective_from: string;
  effective_to: string | null;
  is_global: boolean;
  notes: string | null;
}

export type DcInterestRatePayload = Omit<DcInterestRate, 'id' | 'is_global'>;

export interface DcTemplate {
  id: string;
  code: string;
  locale: DcLocale;
  jurisdiction: DcJurisdiction;
  subject: string;
  body: string;
  is_global: boolean;
}

export interface DcTemplatePayload {
  subject: string;
  body: string;
}

export interface DcEnforcementOffice {
  id: string;
  name: string;
  postal_code_from: string;
  postal_code_to: string;
  address: string;
  postal_code: string;
  city: string;
  canton: string;
  email: string | null;
}

export type DcEnforcementOfficePayload = Omit<DcEnforcementOffice, 'id'>;

// --- Exclusions and payment plans ---

export interface DcExclusion {
  id: string;
  customer_id: string;
  customer_name: string;
  receivable_item_id: string | null;
  type: DcExclusionType;
  reason: string;
  notes: string | null;
  created_at: string;
  released_at: string | null;
}

export interface DcExclusionPayload {
  customer_id: string;
  receivable_item_id?: string;
  type: DcExclusionType;
  reason: string;
  notes?: string;
}

export interface DcInstallment {
  due_date: string;
  amount: string;
}

export interface DcPaymentPlan {
  id: string;
  customer_id: string;
  customer_name: string;
  currency: string;
  total_amount: string;
  start_date: string;
  end_date: string;
  status: DcPlanStatus;
  receivable_item_ids: string[];
  installments: DcInstallment[];
  notes: string | null;
}

export interface DcPaymentPlanPayload {
  customer_id: string;
  currency: string;
  total_amount: string;
  start_date: string;
  end_date: string;
  receivable_item_ids: string[];
  installments: DcInstallment[];
  notes?: string;
}

// --- Legal ---

export interface DcDossier {
  id: string;
  number: string;
  customer_id: string;
  customer_name: string;
  currency: string;
  principal: string;
  interest: string;
  fee: string;
  total: string;
  status: DcDossierStatus;
  office: DcEnforcementOffice | null;
  receivable_item_ids: string[];
  generated_at: string;
  has_bundle: boolean;
}

export interface DcDossierPayload {
  customer_id: string;
  receivable_item_ids: string[];
  office_id?: string;
  locale?: DcLocale;
}

export interface DcMessaInMoraPayload {
  customer_id: string;
  receivable_item_ids: string[];
  send_pec: boolean;
  locale?: DcLocale;
}

// --- Customer history ---

export interface DcTimelineEvent {
  id: string;
  event: string;
  occurred_at: string;
  level: DcLevel | null;
  amount: string | null;
  currency: string | null;
  subject_type: string;
  subject_id: string;
  payload: Record<string, unknown>;
  actor_id: string | null;
}

export interface DcCustomerHistory {
  customer: {
    id: string;
    name: string;
    country: string | null;
    pec: string | null;
    email: string | null;
  };
  summary: {
    open_overdue: DcMoneyTotal[];
    current_level: DcLevel | null;
    interest_accrued: DcMoneyTotal[];
    fees_charged: DcMoneyTotal[];
    active_exclusions: number;
    active_plans: number;
  };
  notices: DcNotice[];
  dossiers: DcDossier[];
  exclusions: DcExclusion[];
  plans: DcPaymentPlan[];
  timeline: DcTimelineEvent[];
}
