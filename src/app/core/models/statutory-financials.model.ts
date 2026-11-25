/**
 * Types of the statutory financial statements module (Mod 167): the Italian OIC / XBRL dossier and the Swiss CO Art. 959
 * and Swiss GAAP FER annual accounts. Amounts travel as decimal strings ("1234.5600"); never turn them into floats for
 * money logic.
 */

export type SfDecimal = string;

export const SF_STANDARDS = [
  'IT_OIC_Ordinario',
  'IT_OIC_Abbreviato',
  'IT_OIC_Micro',
  'CH_CO_Art959',
  'CH_SwissGaapFer',
] as const;
export type SfStandard = (typeof SF_STANDARDS)[number];

export const SF_JURISDICTIONS = ['IT', 'CH'] as const;
export type SfJurisdiction = (typeof SF_JURISDICTIONS)[number];

export const SF_ROUNDING_MODES = ['ExactCents', 'IntegerUnits_Euro_Chf'] as const;
export type SfRoundingMode = (typeof SF_ROUNDING_MODES)[number];

export const SF_INCOME_STATEMENT_METHODS = ['total_cost', 'cost_of_sales'] as const;
export type SfIncomeStatementMethod = (typeof SF_INCOME_STATEMENT_METHODS)[number];

export const SF_CASH_FLOW_METHODS = ['indirect', 'direct'] as const;
export type SfCashFlowMethod = (typeof SF_CASH_FLOW_METHODS)[number];

export const SF_STATUSES = [
  'draft',
  'reclassified',
  'notes_populated',
  'validated',
  'locked',
  'filed',
] as const;
export type SfStatus = (typeof SF_STATUSES)[number];

export const SF_LOCALES = ['it', 'en', 'de', 'fr'] as const;
export type SfLocale = (typeof SF_LOCALES)[number];

export const SF_VALIDATION_STATUSES = ['not_run', 'valid', 'warnings', 'invalid'] as const;
export type SfValidationStatus = (typeof SF_VALIDATION_STATUSES)[number];

export const SF_TRANSITION_TARGETS = ['locked', 'filed', 'draft'] as const;
export type SfTransitionTarget = (typeof SF_TRANSITION_TARGETS)[number];

export const SF_PDFA_KINDS = [
  'management_report',
  'board_minutes',
  'shareholders_minutes',
  'dossier',
] as const;
export type SfPdfaKind = (typeof SF_PDFA_KINDS)[number];

export const SF_ARTIFACT_KINDS = [
  'xbrl_instance',
  'pdfa_management_report',
  'pdfa_board_minutes',
  'pdfa_shareholders_minutes',
  'pdfa_dossier',
] as const;
export type SfArtifactKind = (typeof SF_ARTIFACT_KINDS)[number];

export const SF_ISSUE_CATEGORIES = [
  'schema',
  'taxonomy',
  'cross_statement',
  'notes',
  'reclassification',
] as const;
export type SfIssueCategory = (typeof SF_ISSUE_CATEGORIES)[number];

export const SF_NOTES_TABLES = [
  'fixed_assets',
  'equity',
  'maturity',
  'compensation',
  'leases',
  'off_balance',
  'workforce',
  'related_parties',
  'taxes',
] as const;
export type SfNotesTableName = (typeof SF_NOTES_TABLES)[number];

export const SF_WHAT_IF_PARAMETERS = [
  'ebitda_change_percent',
  'revenue_change_percent',
  'debt_service_change_percent',
  'extra_liquidity',
  'expected_cash_flow_6m',
  'debt_service_6m',
  'opening_liquidity',
] as const;
export type SfWhatIfParameter = (typeof SF_WHAT_IF_PARAMETERS)[number];

/** Error codes of the problems the API answers (`statutoryFinancials.error.<code>`). */
export const SF_ERROR_CODES = [
  'generic',
  'unsupported_standard',
  'fiscal_year_not_found',
  'comparative_year_same',
  'income_statement_method_not_allowed',
  'transition_not_allowed',
  'filing_requires_valid_xbrl',
  'dossier_locked',
  'statements_not_generated',
  'notes_not_populated',
  'artifact_missing',
  'artifact_not_pdfa',
  'pdfa_kind_unknown',
  'pdfa_not_compliant',
  'pdfa_font_missing',
  'pdfa_font_invalid',
  'pdfa_profile_missing',
  'pdfa_profile_unsupported',
] as const;

// --- Envelopes and problems ---

export interface SfEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface SfPageMeta {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

export interface SfPage<T> extends SfEnvelope<T[]> {
  meta: SfPageMeta;
}

/** RFC 7807 problem of a refused rule: `code` picks the translated text, 422 brings the field errors. */
export interface SfProblem {
  code?: string;
  detail?: string;
  errors?: Record<string, string[]>;
  params?: Record<string, string | number>;
}

// --- Lookups ---

export interface SfStandardLookup {
  value: SfStandard;
  jurisdiction: SfJurisdiction;
  scheme: 'ord' | 'abb' | 'micro';
  legal_reference: string;
  label: string;
  description: string;
  income_statement_methods: SfIncomeStatementMethod[];
  cash_flow_methods: SfCashFlowMethod[];
  cash_flow_label: 'OIC 10' | 'FER 4';
  pdfa_profile: string;
  notes: { sections: string[]; tables: string[] };
}

export interface SfRoundingModeLookup {
  value: SfRoundingMode;
  scale: 0 | 2;
}

export interface SfFiscalYearRef {
  id: string;
  year_code: string;
  start_date: string;
  end_date: string;
  status?: string;
}

export interface SfNarrativeTemplate {
  key: string;
  family: string;
  title: string;
  body: string;
  placeholders: string[];
}

export interface SfRatioDefinition {
  code: string;
  family: string;
  unit: 'percent' | 'ratio' | 'amount';
  direction: 'min' | 'max' | null;
  warning_threshold: SfDecimal | null;
  critical_threshold: SfDecimal | null;
  is_crisis_indicator: boolean;
  label: string;
  description: string;
}

export interface SfLookups {
  locale: SfLocale;
  standards: SfStandardLookup[];
  rounding_modes: SfRoundingModeLookup[];
  statuses: SfStatus[];
  fiscal_years: SfFiscalYearRef[];
  /** Seeded report headings and eligibility texts, keyed like `report.balance_sheet`. */
  labels: Record<string, { title: string; body: string }>;
  narrative_templates: SfNarrativeTemplate[];
  ratios: SfRatioDefinition[];
  what_if_parameters: string[];
}

// --- Dossier ---

export interface SfDossierSummary {
  id: string;
  title: string;
  fiscal_year_id: string;
  fiscal_year: { id: string; year_code: string; start_date: string; end_date: string } | null;
  comparative_prior_year_id: string | null;
  accounting_standard: SfStandard;
  status: SfStatus;
  rounding_to_unit_mode: SfRoundingMode;
  income_statement_method: SfIncomeStatementMethod;
  cash_flow_method: SfCashFlowMethod;
  locale: SfLocale;
  currency: string;
  has_statements: boolean;
  validation_status: SfValidationStatus | null;
  net_result: SfDecimal | null;
  generated_at: string | null;
  validated_at: string | null;
  locked_at: string | null;
  filed_at: string | null;
  created_at: string;
}

export interface SfFilters {
  status?: SfStatus;
  standard?: SfStandard;
  fiscal_year_id?: string;
  per_page?: number;
  page?: number;
}

export type SfLineSide = 'asset' | 'liability_equity' | 'revenue' | 'cost' | 'subtotal' | 'flow';

export interface SfLine {
  code: string;
  parent_code: string | null;
  sign: 1 | -1;
  side: SfLineSide;
  sort_order: number;
  level: number;
  is_leaf: boolean;
  is_total: boolean;
  is_rounding: boolean;
  xbrl_element: string | null;
  amount: SfDecimal;
  exact_amount: SfDecimal;
  comparative_amount: SfDecimal | null;
  label: string;
}

export interface SfBalanceSheet {
  lines: SfLine[];
  total_assets: SfDecimal;
  total_liabilities_equity: SfDecimal;
}

export interface SfIncomeStatement {
  method: SfIncomeStatementMethod;
  lines: SfLine[];
  net_result: SfDecimal;
}

export interface SfCashFlow {
  method: SfCashFlowMethod;
  lines: SfLine[];
  opening_cash: SfDecimal;
  closing_cash: SfDecimal;
  balance_sheet_cash: SfDecimal;
  unexplained: SfDecimal;
  reconciled: boolean;
  residual: SfDecimal;
  standard_label: string;
}

export interface SfStatements {
  balance_sheet: SfBalanceSheet | null;
  income_statement: SfIncomeStatement | null;
  cash_flow: SfCashFlow | null;
}

export interface SfQuadrature {
  scale: 0 | 2;
  rounding_reserve: SfDecimal;
  rounding_income: SfDecimal;
  rounding_cost: SfDecimal;
  balance_sheet_residual: SfDecimal;
  income_statement_residual: SfDecimal;
  reserve_line_code: string | null;
  income_line_code: string | null;
  cost_line_code: string | null;
}

export interface SfBifrontAccount {
  account_code: string;
  account_name: string;
  balance: SfDecimal;
  line: string;
  line_label: string;
  side: 'normal' | 'opposite';
}

export interface SfUnmappedAccount {
  account_code: string;
  account_name: string;
  line: string | null;
  line_label: string | null;
}

export interface SfReclassificationWarning {
  code: string;
  severity: 'info' | 'warning';
  params: Record<string, string | number>;
  message: string;
}

export interface SfReclassification {
  bifront: SfBifrontAccount[];
  unmapped: SfUnmappedAccount[];
  warnings: SfReclassificationWarning[];
}

export interface SfEligibilityLimits {
  assets_limit: SfDecimal | number;
  revenue_limit: SfDecimal | number;
  employees_limit: number;
}

export interface SfEligibilityMetrics {
  total_assets: SfDecimal;
  revenue: SfDecimal;
  average_employees: SfDecimal | number;
}

export interface SfEligibilityWarning {
  code: string;
  params: Record<string, string | number>;
  message: string;
}

/** The dimensional threshold check (art. 2435-bis / 2435-ter c.c. for IT, art. 727 CO for CH). */
export interface SfEligibility {
  recommended_standard: SfStandard;
  chosen_allowed: boolean;
  exceeded: string[];
  limits: SfEligibilityLimits;
  message_key: string;
  message: { title: string; body: string };
  warnings: SfEligibilityWarning[];
  required_statements: string[];
  metrics: SfEligibilityMetrics;
  cash_flow_required: boolean;
}

export interface SfProfitAllocation {
  article: string;
  net_profit: SfDecimal;
  carried_forward_in: SfDecimal;
  balance_sheet_profit: SfDecimal;
  share_capital: SfDecimal;
  legal_reserve_cap: SfDecimal;
  legal_reserve_existing: SfDecimal;
  legal_reserve_room: SfDecimal;
  legal_reserve_allocation: SfDecimal;
  legal_reserve_cap_reached: boolean;
  dividends: SfDecimal;
  other_reserves: SfDecimal;
  carried_forward_out: SfDecimal;
  warnings: string[];
}

export interface SfHiddenReserveItem {
  label: string;
  book_value: SfDecimal;
  fer_value: SfDecimal;
}

export interface SfHiddenReservesConfig {
  enabled?: boolean;
  tax_rate_percent?: SfDecimal | number;
  reserves_created?: SfDecimal | number;
  reserves_released?: SfDecimal | number;
  items?: SfHiddenReserveItem[];
}

export interface SfHiddenReservesResult {
  enabled: boolean;
  items: (SfHiddenReserveItem & { hidden_reserve: SfDecimal })[];
  total_hidden_reserves: SfDecimal;
  deferred_tax_on_reserves: SfDecimal;
  statutory_view: { equity: SfDecimal; profit: SfDecimal };
  fer_view: { equity: SfDecimal; profit: SfDecimal };
  net_release: SfDecimal;
  anhang_disclosure_required: boolean;
  warnings: string[];
}

export interface SfHiddenReservesState extends SfHiddenReservesConfig {
  result?: SfHiddenReservesResult;
}

export interface SfCogsAllocation {
  personnel?: number | null;
  other_opex?: number | null;
  depr?: number | null;
}

export interface SfDossierOptions {
  cogs_allocation?: SfCogsAllocation;
}

// --- Notes (Nota Integrativa / Anhang) ---

export interface SfTableBase {
  source?: string;
  available?: boolean;
  fallback?: boolean;
  manual?: boolean;
}

export interface SfFixedAssetRow {
  category_id?: string | null;
  category: string;
  asset_type?: string | null;
  opening_cost: SfDecimal;
  additions: SfDecimal;
  disposals_cost: SfDecimal;
  revaluations: SfDecimal;
  impairments: SfDecimal;
  closing_cost: SfDecimal;
  opening_accumulated: SfDecimal;
  depreciation: SfDecimal;
  disposals_accumulated: SfDecimal;
  closing_accumulated: SfDecimal;
  net_book_value: SfDecimal;
}

export interface SfEquityRow {
  line_code: string;
  label: string;
  opening: SfDecimal;
  movements: SfDecimal;
  result_for_year: SfDecimal;
  allocation_of_prior_result: SfDecimal;
  closing: SfDecimal;
}

export interface SfMaturityBuckets {
  within_1y: SfDecimal;
  between_1y_5y: SfDecimal;
  beyond_5y: SfDecimal;
  total: SfDecimal;
  secured: SfDecimal;
}

export interface SfCompensationRow {
  role: 'directors' | 'auditors';
  fees: SfDecimal;
  advances: SfDecimal;
  guarantees: SfDecimal;
}

export interface SfLeaseRow {
  number: string;
  title: string;
  lessor: string;
  asset_class: string;
  within_1y: SfDecimal;
  between_1y_5y: SfDecimal;
  beyond_5y: SfDecimal;
  total_commitment: SfDecimal;
  closing_liability: SfDecimal;
  interest_year: SfDecimal;
  depreciation_year: SfDecimal;
  redemption_value: SfDecimal;
}

export interface SfOffBalanceRow {
  type: string;
  description: string;
  amount: SfDecimal;
}

export interface SfWorkforceRow {
  category: string;
  average_headcount: SfDecimal | number;
  average_fte: SfDecimal | number;
}

export interface SfRelatedPartyRow {
  party: string;
  relationship: string;
  amount: SfDecimal;
  description: string;
}

export interface SfTaxRow {
  kind: 'current' | 'deferred';
  amount: SfDecimal;
}

export interface SfQuantitativeTables {
  fixed_assets?: SfTableBase & { rows: SfFixedAssetRow[]; totals?: Record<string, SfDecimal> };
  equity?: SfTableBase & {
    rows: SfEquityRow[];
    totals?: { opening: SfDecimal; closing: SfDecimal };
  };
  maturity?: SfTableBase & {
    basis?: string;
    receivables: SfMaturityBuckets;
    payables: SfMaturityBuckets;
    payables_due_6m?: SfDecimal;
  };
  compensation?: SfTableBase & { rows: SfCompensationRow[] };
  leases?: SfTableBase & {
    rows: SfLeaseRow[];
    totals?: Record<string, SfDecimal>;
    due_6m?: SfDecimal;
  };
  off_balance?: SfTableBase & { rows: SfOffBalanceRow[] };
  workforce?: SfTableBase & {
    rows: SfWorkforceRow[];
    total_headcount?: SfDecimal | number;
    total_fte?: SfDecimal | number;
  };
  related_parties?: SfTableBase & { rows: SfRelatedPartyRow[] };
  taxes?: SfTableBase & { rows: SfTaxRow[]; total?: SfDecimal };
}

export interface SfNarrativeSection {
  key: string;
  title: string;
  body: string;
  edited: boolean;
}

export interface SfNotes {
  id: string;
  dossier_id: string;
  taxonomy_version: string | null;
  quantitative_tables: SfQuantitativeTables;
  narrative_text_sections: SfNarrativeSection[];
  sources: Record<string, string>;
  populated_at: string | null;
}

export interface SfNotesPayload {
  tables?: Partial<Record<SfNotesTableName, object>>;
  sections?: { key: string; title?: string; body: string }[];
}

// --- Indicators and the DSCR simulator ---

export interface SfWhatIf {
  ebitda_change_percent?: number | null;
  revenue_change_percent?: number | null;
  debt_service_change_percent?: number | null;
  extra_liquidity?: number | null;
  expected_cash_flow_6m?: number | null;
  debt_service_6m?: number | null;
  opening_liquidity?: number | null;
}

export type SfIndicatorStatus = 'ok' | 'warning' | 'critical' | 'n/a';

export interface SfIndicator {
  code: string;
  label: string;
  description: string;
  unit: 'percent' | 'ratio' | 'amount';
  value: SfDecimal | null;
  status: SfIndicatorStatus;
  direction: 'min' | 'max' | null;
  warning_threshold: SfDecimal | null;
  critical_threshold: SfDecimal | null;
  is_crisis_indicator: boolean;
  message: string | null;
}

export interface SfDscr {
  horizon_months: number;
  expected_cash_flow: SfDecimal | null;
  opening_liquidity: SfDecimal | null;
  debt_service: SfDecimal | null;
  value: SfDecimal | null;
}

export interface SfIndicatorsResult {
  indicators: SfIndicator[];
  alert_level: 'ok' | 'warning' | 'critical';
  alerts: { code: string; status: string; message: string }[];
  dscr: SfDscr;
  what_if: Record<string, unknown>;
  inputs: Record<string, unknown>;
}

// --- Preview ---

export interface SfPreviewRow {
  code: string;
  label: string;
  level: number;
  is_total: boolean;
  is_rounding: boolean;
  xbrl_element: string | null;
  amount: SfDecimal;
  comparative_amount: SfDecimal | null;
}

export interface SfPreviewSection {
  statement: string;
  title: string;
  rows: SfPreviewRow[];
}

export interface SfPreview {
  title: string;
  standard: SfStandard;
  legal_reference: string;
  scale: 0 | 2;
  currency: string;
  taxonomy: { version: string; prefix: string; namespace: string; entry_point: string };
  has_comparative: boolean;
  sections: SfPreviewSection[];
  notes: { tables: SfQuantitativeTables; sections: SfNarrativeSection[] } | null;
  validation: SfValidationReport | null;
  xbrl_excerpt: string;
  xbrl_truncated: boolean;
}

// --- Package, validation and artifacts ---

export interface SfIssue {
  severity: string;
  category: SfIssueCategory;
  code: string;
  params: Record<string, string | number>;
  message: string;
}

export interface SfValidationReport {
  status: 'valid' | 'warnings' | 'invalid';
  taxonomy_version: string;
  entry_point: string;
  facts: number;
  errors: SfIssue[];
  warnings: SfIssue[];
  info: SfIssue[];
  scope: string;
  validated_at: string;
}

export interface SfArtifactCheck {
  id: string;
  passed: boolean;
  detail: string | null;
}

export interface SfArtifact {
  id: string;
  dossier_id: string;
  kind: SfArtifactKind;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  sha256: string;
  pdfa_conformance: 'PDF/A-1b' | 'PDF/A-2b' | null;
  verification: {
    profile: string;
    compliant: boolean;
    checks: SfArtifactCheck[];
    verified_by: string | null;
  } | null;
  created_at: string;
}

export interface SfPackage {
  id: string;
  dossier_id: string;
  generated_xbrl_instance_file_id: string | null;
  tebeni_validation_report: SfValidationReport | null;
  validation_status: SfValidationStatus | null;
  management_report_pdf_a_id: string | null;
  shareholders_minutes_pdf_a_id: string | null;
  board_minutes_pdf_a_id: string | null;
  dossier_pdf_a_id: string | null;
  financial_ratios_crisi_impresa: Record<string, unknown> | null;
  exported_at: string | null;
}

export interface SfPackageBundle {
  package: SfPackage | null;
  artifacts: SfArtifact[];
}

export interface SfMeeting {
  meeting_date?: string;
  meeting_place?: string;
  chair?: string;
  secretary?: string;
  attendees?: string[];
}

export interface SfPdfaPayload {
  kinds: SfPdfaKind[];
  meeting?: SfMeeting;
}

// --- Detail and payloads ---

export interface SfDossier extends SfDossierSummary {
  share_capital: SfDecimal | null;
  options: SfDossierOptions | null;
  statements: SfStatements;
  quadrature: SfQuadrature | null;
  reclassification: SfReclassification | null;
  eligibility: {
    recommended_standard: SfStandard;
    chosen_allowed: boolean;
    exceeded: string[];
    limits: SfEligibilityLimits;
    message_key: string;
    warnings: unknown[];
    required_statements: string[];
    metrics: SfEligibilityMetrics;
  } | null;
  profit_allocation_proposal: SfProfitAllocation | null;
  hidden_reserves_config: SfHiddenReservesState | null;
  cash_flow_statement: {
    method: SfCashFlowMethod;
    reconciled: boolean;
    standard_label: string;
  } | null;
  notes: SfNotes | null;
  package: SfPackage | null;
  artifacts: SfArtifact[];
  filing_reference: string | null;
}

export interface SfDossierPayload {
  fiscal_year_id?: string;
  comparative_prior_year_id?: string | null;
  title?: string;
  accounting_standard?: SfStandard;
  rounding_to_unit_mode?: SfRoundingMode;
  income_statement_method?: SfIncomeStatementMethod;
  cash_flow_method?: SfCashFlowMethod;
  locale?: SfLocale;
  currency?: string;
  share_capital?: number | null;
  options?: SfDossierOptions;
  dividends?: number | null;
  other_reserves?: number | null;
  carried_forward?: number | null;
  hidden_reserves_config?: SfHiddenReservesConfig;
}
