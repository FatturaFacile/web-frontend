/** Consolidation of the entities of a group (module General Ledger). Amounts are decimal strings, in group currency unless stated. */

export type ConsolidationMethod = 'full' | 'proportional' | 'equity';
export type IntercompanyMappingType = 'receivable_payable' | 'revenue_cost' | 'investment_equity';
export type EliminationDifferencePolicy = 'keep_difference' | 'post_to_difference_account';
export type GoodwillMethod = 'none' | 'straight_line' | 'impairment_only';
export type FairValueFirstYearRule = 'pro_rata' | 'full_year';
export type NegativeGoodwillTreatment = 'consolidation_reserve' | 'immediate_income';
export type GoodwillTranslation = 'historical' | 'closing';
export type ConsolidationBasis = 'own_year' | 'interim_twelve_months';
export type ConsolidationRunStatus = 'completed' | 'locked';
export type IntragroupAssetType = 'inventory' | 'fixed_asset';
export type FairValueAccountType = 'asset' | 'liability';

export interface ConsolidationMemberRow {
  id: string;
  member_tenant_id: string;
  name: string;
  ownership_percentage: string;
  consolidation_method: ConsolidationMethod;
  is_parent: boolean;
  holder_tenant_id: string | null;
  fiscal_year_offset_months: number;
  tax_rate: string | null;
  consolidation_basis: ConsolidationBasis | null;
}

export interface IntercompanyMapping {
  id: string;
  mapping_type: IntercompanyMappingType;
  account_a_id: string;
  account_b_id: string | null;
}

export interface IntercompanyRelation {
  id: string;
  group_id: string;
  entity_a_tenant_id: string;
  entity_b_tenant_id: string;
  tolerance_amount: string;
  /** Group currency of the tolerance. */
  currency?: string | null;
  description: string | null;
  mappings?: IntercompanyMapping[];
}

export interface ConsolidationGroup {
  id: string;
  name: string;
  group_currency: string;
  translation_reserve_code: string | null;
  consolidation_difference_code: string | null;
  equity_method_result_code: string | null;
  equity_method_reserve_code: string | null;
  elimination_difference_policy: EliminationDifferencePolicy;
  goodwill_method: GoodwillMethod;
  goodwill_amortisation_years: number | null;
  require_account_mapping: boolean;
  deferred_tax_on_unrealised_profit: boolean;
  unrealised_profit_tax_rate: string | null;
  fair_value_first_year_rule: FairValueFirstYearRule;
  goodwill_translation: GoodwillTranslation;
  negative_goodwill_treatment: NegativeGoodwillTreatment;
  synthetic_accounts: Record<string, string>;
  is_active: boolean;
  notes: string | null;
  members?: ConsolidationMemberRow[];
  relations?: IntercompanyRelation[];
}

/** Body of `POST /consolidation/groups` and `PUT /consolidation/groups/{id}` (`StoreConsolidationGroupRequest`, `UpdateConsolidationGroupRequest`). */
export interface ConsolidationGroupPayload {
  name?: string;
  group_currency?: string;
  translation_reserve_code?: string | null;
  consolidation_difference_code?: string | null;
  equity_method_result_code?: string | null;
  equity_method_reserve_code?: string | null;
  is_active?: boolean;
  elimination_difference_policy?: EliminationDifferencePolicy;
  goodwill_method?: GoodwillMethod;
  goodwill_amortisation_years?: number | null;
  require_account_mapping?: boolean;
  deferred_tax_on_unrealised_profit?: boolean;
  unrealised_profit_tax_rate?: number | null;
  fair_value_first_year_rule?: FairValueFirstYearRule;
  negative_goodwill_treatment?: NegativeGoodwillTreatment;
  goodwill_translation?: GoodwillTranslation;
  notes?: string | null;
}

/** Body of `POST` and `PUT /consolidation/groups/{id}/members` (`StoreConsolidationMemberRequest`); `member_tenant_id` only on create. */
export interface ConsolidationMemberPayload {
  member_tenant_id?: string;
  ownership_percentage: number;
  consolidation_method: ConsolidationMethod;
  holder_tenant_id?: string | null;
  fiscal_year_offset_months?: number | null;
  consolidation_basis?: ConsolidationBasis | null;
  tax_rate?: number | null;
}

export interface IntercompanyRelationPayload {
  entity_a_tenant_id: string;
  entity_b_tenant_id: string;
  tolerance_amount?: number | null;
  /** Optional; must be the group currency, which is the default. */
  currency?: string | null;
  description?: string | null;
}

export interface IntercompanyMappingPayload {
  mapping_type: IntercompanyMappingType;
  account_a_id: string;
  account_b_id?: string | null;
}

export interface ConsolidationAccountMapping {
  id: string;
  group_id: string;
  member_tenant_id: string;
  account_id: string;
  group_account_code: string;
  group_account_name: string | null;
}

export interface ConsolidationAccountMappingPayload {
  member_tenant_id: string;
  account_id: string;
  group_account_code: string;
  group_account_name?: string | null;
}

export interface ConsolidationFairValueAdjustment {
  id: string;
  account_code: string;
  account_name: string | null;
  account_type: FairValueAccountType;
  amount: string;
  useful_life_years: number | null;
}

export interface ConsolidationGoodwillImpairment {
  id: string;
  fiscal_year: number;
  amount: string;
}

export interface ConsolidationAcquisition {
  id: string;
  group_id: string;
  member_tenant_id: string;
  acquisition_date: string;
  cost: string | null;
  net_assets_at_acquisition: string;
  acquired_percentage: string | null;
  recognise_deferred_tax: boolean;
  deferred_tax_rate: string | null;
  expected_future_charges: string | null;
  provision_release_years: number | null;
  input_currency: string | null;
  fair_value_adjustments?: ConsolidationFairValueAdjustment[];
  impairments?: ConsolidationGoodwillImpairment[];
}

export interface FairValueAdjustmentPayload {
  account_code: string;
  account_name?: string | null;
  account_type: FairValueAccountType;
  amount: number;
  useful_life_years?: number | null;
}

export interface ConsolidationAcquisitionPayload {
  member_tenant_id: string;
  acquisition_date: string;
  cost?: number | null;
  net_assets_at_acquisition: number;
  acquired_percentage?: number | null;
  expected_future_charges?: number | null;
  provision_release_years?: number | null;
  input_currency?: string | null;
  recognise_deferred_tax?: boolean;
  deferred_tax_rate?: number | null;
  fair_value_adjustments?: FairValueAdjustmentPayload[];
}

export interface GoodwillImpairmentPayload {
  fiscal_year: number;
  amount: number;
}

export interface IntragroupTransaction {
  id: string;
  group_id: string;
  relation_id: string | null;
  seller_tenant_id: string;
  buyer_tenant_id: string;
  asset_type: IntragroupAssetType;
  description: string | null;
  transaction_date: string;
  /** Group currency, the currency of every amount of the transaction. */
  currency?: string;
  sale_price: string | null;
  seller_cost: string | null;
  margin_amount: string | null;
  remaining_percentage: string | null;
  opening_remaining_percentage: string | null;
  useful_life_years: number | null;
  asset_account_id: string;
  profit_account_id: string;
  depreciation_account_id: string | null;
}

export interface IntragroupTransactionPayload {
  relation_id?: string | null;
  seller_tenant_id: string;
  buyer_tenant_id: string;
  asset_type: IntragroupAssetType;
  description?: string | null;
  transaction_date: string;
  /** Optional; must be the group currency, which is the default. */
  currency?: string | null;
  sale_price?: number | null;
  seller_cost?: number | null;
  margin_amount?: number | null;
  remaining_percentage?: number | null;
  opening_remaining_percentage?: number | null;
  useful_life_years?: number | null;
  asset_account_id: string;
  profit_account_id: string;
  depreciation_account_id?: string | null;
}

export interface IntragroupDividend {
  id: string;
  group_id: string;
  payer_tenant_id: string;
  receiver_tenant_id: string;
  dividend_date: string;
  amount: string;
  income_account_id: string;
  equity_account_id: string;
}

export interface IntragroupDividendPayload {
  payer_tenant_id: string;
  receiver_tenant_id: string;
  dividend_date: string;
  amount: number;
  income_account_id: string;
  equity_account_id: string;
}

export interface ConsolidationWarning {
  code: string;
  message: string;
  [key: string]: unknown;
}

export interface ConsolidationAdjustmentLine {
  entity_tenant_id: string | null;
  account_code: string;
  account_name: string | null;
  account_type: string;
  debit: string;
  credit: string;
}

export interface ConsolidationAdjustment {
  id: string;
  adjustment_type: string;
  relation_id: string | null;
  member_tenant_id: string | null;
  description: string | null;
  amount: string;
  lines: ConsolidationAdjustmentLine[];
}

export interface ConsolidationRunMemberSnapshot {
  tenant_id: string;
  name: string;
  currency: string;
  ownership_percentage: string;
  consolidation_method: ConsolidationMethod;
  is_parent: boolean;
  effective_ownership: string;
  consolidation_share: string;
  year_start: string;
}

export interface ConsolidationRunRate {
  tenant_id: string;
  currency: string;
  closing: string;
  average: string;
  historical: string;
}

export interface ConsolidationRunTotals {
  adjustment_count?: number;
  warning_count?: number;
  trial_balance_is_balanced?: boolean;
  total_assets?: string;
  total_liabilities?: string;
  total_equity?: string;
  balance_sheet_is_balanced?: boolean;
  [key: string]: unknown;
}

export interface ConsolidationRun {
  id: string;
  group_id: string;
  fiscal_period_id: string;
  version: number;
  status: ConsolidationRunStatus;
  group_currency: string;
  year_start: string;
  period_start: string;
  period_end: string;
  input_fingerprint: string;
  members: ConsolidationRunMemberSnapshot[];
  rates: ConsolidationRunRate[];
  warnings: ConsolidationWarning[];
  totals: ConsolidationRunTotals;
  locked_at: string | null;
  locked_by: string | null;
  created_by: string | null;
  created_at: string | null;
  adjustments?: ConsolidationAdjustment[];
}

export interface ConsolidationRunVerification {
  matches: boolean;
  stored_fingerprint: string;
  current_fingerprint: string;
}

/** Header carried by every consolidated statement of a run. */
export interface ConsolidatedStatementHeader {
  run_id: string;
  version: number;
  status: ConsolidationRunStatus;
  currency: string;
  period_start: string;
  period_end: string;
  amounts_basis: string;
}

export interface ConsolidatedTrialBalanceRow {
  account_code: string;
  account_name: string;
  account_type: string;
  aggregated_net: string;
  adjustments_net: string;
  net: string;
  debit: string;
  credit: string;
}

export interface ConsolidatedTrialBalance extends ConsolidatedStatementHeader {
  accounts: ConsolidatedTrialBalanceRow[];
  total_debit: string;
  total_credit: string;
  is_balanced: boolean;
}

export interface ConsolidatedStatementLine {
  account_code: string;
  account_name: string;
  amount: string;
}

export interface ConsolidatedBalanceSheet extends ConsolidatedStatementHeader {
  assets: ConsolidatedStatementLine[];
  total_assets: string;
  liabilities: ConsolidatedStatementLine[];
  total_liabilities: string;
  equity: ConsolidatedStatementLine[];
  total_equity_reserves: string;
  result_of_the_period: string;
  total_equity: string;
  non_controlling_interests: string;
  equity_attributable_to_owners: string;
  total_liabilities_and_equity: string;
  deferred_tax_asset: string;
  deferred_tax_liability: string;
  is_balanced: boolean;
}

export interface ConsolidatedIncomeStatement extends ConsolidatedStatementHeader {
  revenues: ConsolidatedStatementLine[];
  total_revenue: string;
  cogs: ConsolidatedStatementLine[];
  total_cogs: string;
  gross_profit: string;
  operating_expenses: ConsolidatedStatementLine[];
  total_operating_expenses: string;
  income_tax: string;
  net_income: string;
  net_income_attributable_to_non_controlling_interests: string;
  net_income_attributable_to_owners: string;
}

export interface ConsolidatedReclassifiedRow {
  code: string;
  label: string;
  row_type: string;
  amount: string | null;
}

export interface ConsolidatedReclassifiedStatement extends ConsolidatedStatementHeader {
  scheme: string;
  statement_type: string;
  rows: ConsolidatedReclassifiedRow[];
  unmapped_accounts: { account_code: string; account_name: string; amount: string }[];
}

export interface GoodwillScheduleRow {
  fiscal_year: number;
  period_start: string;
  period_end: string;
  opening_balance: string;
  amortisation: string;
  impairment: string;
  closing_balance: string;
  is_run_year?: boolean;
  amortisation_to_period_end?: string;
  impairment_to_period_end?: string;
}

export interface GoodwillScheduleAcquisition {
  member_tenant_id: string;
  name: string;
  acquisition_date: string;
  goodwill: string;
  rows: GoodwillScheduleRow[];
}

export interface GoodwillSchedule {
  run_id: string;
  currency: string;
  goodwill_method: GoodwillMethod;
  goodwill_amortisation_years: number | null;
  acquisitions: GoodwillScheduleAcquisition[];
}

export interface IntercompanyReconciliationSide {
  tenant_id: string;
  name: string;
  account_id: string;
  account_code: string | null;
  account_name: string | null;
  year_start: string;
  local_currency: string;
  local_amount: string;
  group_amount: string;
  consolidated_share: string;
}

export interface IntercompanyReconciliationRow {
  relation_id: string;
  mapping_type: IntercompanyMappingType;
  entity_a: IntercompanyReconciliationSide;
  entity_b: IntercompanyReconciliationSide;
  difference: string;
  tolerance: string;
  has_difference: boolean;
  status: 'matched' | 'difference';
}

export interface IntercompanyReconciliation {
  group_id: string;
  fiscal_period_id: string;
  year_start: string;
  period_end: string;
  currency: string;
  amounts_basis: string;
  rows: IntercompanyReconciliationRow[];
  summary: {
    pairs: number;
    pairs_with_difference: number;
    absolute_difference: Record<string, string>;
  };
}
