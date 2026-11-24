/**
 * Wire types of the sales commission and agent management module (Mod 041), served under
 * `/api/v1/agent-commissions`. Amounts, rates and percentages travel as decimal strings; dates as `YYYY-MM-DD`.
 */

export const AGC_AGENT_TYPES = ['direct', 'sub_agent', 'multi_mandate', 'single_mandate'] as const;
export type AgcAgentType = (typeof AGC_AGENT_TYPES)[number];

export const AGC_FISCAL_REGIMES = ['enasarco', 'aec', 'swiss_direct', 'none'] as const;
export type AgcFiscalRegime = (typeof AGC_FISCAL_REGIMES)[number];

export const AGC_ENASARCO_MANDATES = ['single', 'multi'] as const;
export type AgcEnasarcoMandate = (typeof AGC_ENASARCO_MANDATES)[number];

export const AGC_ACCRUAL_BASES = ['invoiced', 'collected'] as const;
export type AgcAccrualBasis = (typeof AGC_ACCRUAL_BASES)[number];

export const AGC_RATE_TYPES = ['percentage', 'fixed'] as const;
export type AgcRateType = (typeof AGC_RATE_TYPES)[number];

export const AGC_SPLIT_MODES = ['additional_rate', 'share_of_commission'] as const;
export type AgcSplitMode = (typeof AGC_SPLIT_MODES)[number];

export const AGC_SETTLEMENT_CHANNELS = ['invoice', 'salary'] as const;
export type AgcSettlementChannel = (typeof AGC_SETTLEMENT_CHANNELS)[number];

export const AGC_PERIOD_TYPES = ['monthly', 'quarterly', 'custom'] as const;
export type AgcPeriodType = (typeof AGC_PERIOD_TYPES)[number];

export const AGC_STATEMENT_STATUSES = ['draft', 'approved', 'invoiced', 'paid', 'void'] as const;
export type AgcStatementStatus = (typeof AGC_STATEMENT_STATUSES)[number];

export const AGC_ENTRY_STATUSES = [
  'pending_collection',
  'awaiting_reconciliation',
  'partially_eligible',
  'eligible',
  'settled',
  'cancelled',
] as const;
export type AgcEntryStatus = (typeof AGC_ENTRY_STATUSES)[number];

export const AGC_ENTRY_ROLES = ['primary', 'parent_override'] as const;
export type AgcEntryRole = (typeof AGC_ENTRY_ROLES)[number];

export const AGC_MOVEMENT_KINDS = ['accrual', 'release', 'reversal', 'credit_note'] as const;
export type AgcMovementKind = (typeof AGC_MOVEMENT_KINDS)[number];

/** The fiscal parameter codes a company can override (`SaveFiscalOverrideRequest`). */
export const AGC_FISCAL_CODES = [
  'enasarco_agent_rate',
  'enasarco_company_rate',
  'enasarco_massimale',
  'enasarco_minimale',
  'firr_brackets',
  'withholding_rate',
  'withholding_base_with_organization',
  'withholding_base_without_organization',
  'vat_rate',
] as const;
export type AgcFiscalCode = (typeof AGC_FISCAL_CODES)[number];

// --- Envelopes ---

export interface AgcEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface AgcPageMeta {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

export interface AgcPage<T> extends AgcEnvelope<T[]> {
  meta: AgcPageMeta;
}

/** RFC 7807 problem the module answers with; `code` is the suffix of `agentCommissions.error.<code>`. */
export interface AgcProblem {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  instance?: string;
  code?: string;
  message?: string;
  errors?: Record<string, string[]>;
}

export interface AgcLookups {
  agent_types: AgcAgentType[];
  fiscal_regimes: AgcFiscalRegime[];
  enasarco_mandates: AgcEnasarcoMandate[];
  accrual_bases: AgcAccrualBasis[];
  rate_types: AgcRateType[];
  split_modes: AgcSplitMode[];
  settlement_channels: AgcSettlementChannel[];
  period_types: AgcPeriodType[];
  statement_statuses: AgcStatementStatus[];
  entry_statuses: AgcEntryStatus[];
}

// --- Agents ---

/** A sales representative of the invoicing module that has no agent profile yet. */
export interface AgcRepresentative {
  id: string;
  rep_code: string | null;
  name: string;
  email: string | null;
  default_commission_rate: string;
}

export interface AgcAgentProfile {
  id: string;
  sales_representative_id: string;
  representative?: AgcRepresentative | null;
  agent_type: AgcAgentType;
  fiscal_regime: AgcFiscalRegime;
  enasarco_mandate: AgcEnasarcoMandate | null;
  parent_agent_profile_id: string | null;
  parent_name?: string | null;
  parent_split_mode: AgcSplitMode | null;
  parent_split_value: string | null;
  accrual_basis: AgcAccrualBasis;
  default_rate: string | null;
  settlement_channel: AgcSettlementChannel;
  has_own_organization: boolean;
  vat_applies: boolean;
  firr_enabled: boolean;
  enasarco_registration_number: string | null;
  tax_code: string | null;
  vat_number: string | null;
  contract_start: string | null;
  contract_end: string | null;
  notes: string | null;
  is_active: boolean;
}

export interface AgcAgentFilters {
  agent_type?: AgcAgentType;
  is_active?: boolean;
}

/** Create takes `sales_representative_id` (required); the update refuses it. */
export interface AgcAgentPayload {
  sales_representative_id?: string;
  agent_type?: AgcAgentType;
  fiscal_regime?: AgcFiscalRegime;
  enasarco_mandate?: AgcEnasarcoMandate | null;
  parent_agent_profile_id?: string | null;
  parent_split_mode?: AgcSplitMode | null;
  parent_split_value?: number | null;
  accrual_basis?: AgcAccrualBasis;
  default_rate?: number | null;
  settlement_channel?: AgcSettlementChannel;
  has_own_organization?: boolean;
  vat_applies?: boolean;
  firr_enabled?: boolean;
  enasarco_registration_number?: string | null;
  tax_code?: string | null;
  vat_number?: string | null;
  contract_start?: string | null;
  contract_end?: string | null;
  notes?: string | null;
  is_active?: boolean;
}

// --- Zones ---

export interface AgcZone {
  id: string;
  code: string;
  name: string;
  country: string | null;
  regions: string[];
  is_active: boolean;
}

export interface AgcZonePayload {
  code?: string;
  name?: string;
  country?: string | null;
  regions?: string[] | null;
  is_active?: boolean;
}

// --- Rules ---

export interface AgcRuleTier {
  threshold_from: string;
  threshold_to: string | null;
  rate: string;
}

export interface AgcRule {
  id: string;
  agent_profile_id: string | null;
  name: string;
  product_category_id: string | null;
  customer_id: string | null;
  zone_id: string | null;
  zone?: { id: string; code: string; name: string } | null;
  rate_type: AgcRateType;
  rate: string;
  fixed_amount: string | null;
  accrual_basis: AgcAccrualBasis | null;
  priority: number;
  valid_from: string | null;
  valid_to: string | null;
  is_active: boolean;
  tiers?: AgcRuleTier[];
}

export interface AgcRuleTierPayload {
  threshold_from: number;
  threshold_to: number | null;
  rate: number;
}

export interface AgcRulePayload {
  agent_profile_id?: string | null;
  name?: string;
  product_category_id?: string | null;
  customer_id?: string | null;
  zone_id?: string | null;
  rate_type?: AgcRateType;
  rate?: number | null;
  fixed_amount?: number | null;
  accrual_basis?: AgcAccrualBasis | null;
  priority?: number;
  valid_from?: string | null;
  valid_to?: string | null;
  is_active?: boolean;
  tiers?: AgcRuleTierPayload[] | null;
}

export interface AgcResolveParams {
  agent_profile_id: string;
  customer_id?: string | null;
  product_category_id?: string | null;
  date?: string | null;
}

/** The winning rule of the precedence simulator, or the default rate when no rule applies. */
export interface AgcResolveResult {
  rule: AgcRule | null;
  fallback_rate: string | null;
  zone_ids: string[];
}

// --- Fiscal parameters ---

export interface AgcFiscalBracket {
  up_to: string | number | null;
  rate: string | number;
}

export interface AgcFiscalParameter {
  id: string;
  code: AgcFiscalCode;
  mandate_type: AgcEnasarcoMandate | null;
  year: number | null;
  value: string | null;
  payload: AgcFiscalBracket[] | null;
  label_key: string | null;
  /** `true` for a company override, `false` for the statutory value. */
  is_override: boolean;
}

export interface AgcFiscalOverridePayload {
  code: AgcFiscalCode;
  mandate_type?: AgcEnasarcoMandate | null;
  year?: number | null;
  value?: number | null;
  payload?: AgcFiscalBracket[] | null;
}

// --- Ledger ---

export interface AgcMovement {
  kind: AgcMovementKind;
  amount: string;
  occurred_on: string | null;
  note: string | null;
}

export interface AgcLedgerEntry {
  id: string;
  agent_profile_id: string;
  agent_name?: string | null;
  role: AgcEntryRole;
  invoice_id: string;
  invoice_number?: string | null;
  invoice_date?: string | null;
  rule_id: string | null;
  accrual_basis: AgcAccrualBasis;
  currency: string;
  accrued_on: string | null;
  base_amount: string;
  rate: string | null;
  commission_amount: string;
  credited_amount: string;
  effective_amount: string;
  eligible_amount: string;
  settled_amount: string;
  payable_amount: string;
  blocked_amount: string;
  collected_ratio: string;
  reconciled_ratio: string;
  status: AgcEntryStatus;
  movements?: AgcMovement[];
}

export interface AgcLedgerFilters {
  agent_profile_id?: string;
  status?: AgcEntryStatus;
  accrual_basis?: AgcAccrualBasis;
  from?: string;
  to?: string;
  search?: string;
  page?: number;
  per_page?: number;
}

export interface AgcLedgerTotals {
  commission: string;
  eligible: string;
  settled: string;
  blocked: string;
}

export interface AgcLedgerPage extends AgcEnvelope<AgcLedgerEntry[]> {
  meta: AgcPageMeta & { totals: AgcLedgerTotals };
}

export interface AgcSyncPayload {
  from?: string;
  to?: string;
}

export interface AgcSyncResult {
  period_invoices: number;
  open_invoices: number;
}

// --- Enasarco and FIRR ---

export interface AgcEnasarcoRow {
  agent_profile_id: string;
  agent_name: string | null;
  mandate: AgcEnasarcoMandate;
  year: number;
  commission_ytd: string;
  enasarco_base_ytd: string;
  enasarco_agent_ytd: string;
  enasarco_company_ytd: string;
  massimale: string | null;
  massimale_remaining: string | null;
  massimale_reached: boolean;
  minimale: string | null;
  minimale_reached: boolean;
  minimale_shortfall: string | null;
  firr_ytd: string;
  firr_enabled: boolean;
}

export interface AgcEnasarcoOverview extends AgcEnvelope<AgcEnasarcoRow[]> {
  meta: { year: number };
}

// --- Statements ---

/** The fiscal breakdown of a statement, as the fiscal engine computed it. */
export interface AgcFiscalBreakdown {
  mandate: AgcEnasarcoMandate | null;
  applies_enasarco: boolean;
  enasarco_base: string;
  enasarco_agent: string;
  enasarco_company: string;
  firr: string;
  withholding_base: string;
  withholding: string;
  vat: string;
  massimale: string | null;
  minimale: string | null;
  massimale_reached: boolean;
  minimale_reached: boolean;
  minimale_shortfall: string;
  enasarco_agent_rate?: string;
  enasarco_company_rate?: string;
  withholding_rate?: string;
  vat_rate?: string;
}

/** What the preview answers: the summary of the statement the period would produce. */
export interface AgcStatementPreview {
  agent_profile_id: string;
  period_start: string;
  period_end: string;
  currency: string;
  lines_count: number;
  base_total: string;
  own_commission_total: string;
  override_commission_total: string;
  clawback_total: string;
  gross_commission: string;
  fiscal: AgcFiscalBreakdown;
  net_payable: string;
  blocked_amount: string;
}

export interface AgcStatementLine {
  id: string;
  entry_id: string;
  invoice_id: string;
  invoice_number: string | null;
  invoice_date: string | null;
  customer_name: string | null;
  role: AgcEntryRole;
  accrual_basis: AgcAccrualBasis;
  base_amount: string;
  rate: string | null;
  commission_amount: string;
}

/** The commission invoice / self-billing data prepared for an approved statement. */
export interface AgcSelfBillingPayload {
  document_kind: string;
  number: string;
  date: string;
  currency: string;
  statement_number: string;
  period: { from: string; to: string };
  agent: {
    name: string | null;
    email: string | null;
    fiscal_regime: AgcFiscalRegime;
    enasarco_registration_number: string | null;
  };
  taxable_amount: string;
  vat_rate: string | null;
  vat_amount: string;
  document_total: string;
  enasarco_agent: string;
  withholding_base: string;
  withholding_rate: string | null;
  withholding_amount: string;
  net_payable: string;
  lines: { invoice_number: string | null; base_amount: string; commission_amount: string }[];
}

export interface AgcStatement {
  id: string;
  number: string;
  agent_profile_id: string;
  agent_name?: string | null;
  agent_email?: string | null;
  settlement_channel?: AgcSettlementChannel | null;
  period_type: AgcPeriodType;
  period_start: string;
  period_end: string;
  status: AgcStatementStatus;
  currency: string;
  base_total: string;
  own_commission_total: string;
  override_commission_total: string;
  clawback_total: string;
  gross_commission: string;
  enasarco_base: string;
  enasarco_agent: string;
  enasarco_company: string;
  firr_accrual: string;
  withholding_base: string;
  withholding_amount: string;
  vat_amount: string;
  net_payable: string;
  blocked_amount: string;
  massimale_reached: boolean;
  approved_at: string | null;
  self_billing_number: string | null;
  self_billing_date: string | null;
  self_billing_payload: AgcSelfBillingPayload | null;
  paid_at: string | null;
  payment_reference: string | null;
  sent_at: string | null;
  sent_to: string | null;
  sent_count: number;
  lines?: AgcStatementLine[];
}

export interface AgcStatementFilters {
  agent_profile_id?: string;
  status?: AgcStatementStatus;
  year?: number;
  page?: number;
  per_page?: number;
}

export interface AgcGeneratePayload {
  agent_profile_id: string;
  period_start: string;
  period_end: string;
  period_type?: AgcPeriodType;
}

export interface AgcPayPayload {
  reference?: string | null;
  paid_on?: string | null;
}

export interface AgcSendPayload {
  recipient?: string | null;
  locale?: 'it' | 'en' | 'de' | 'fr' | null;
}
