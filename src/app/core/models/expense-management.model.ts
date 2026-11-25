/**
 * Wire types of the expense and travel management module (Mod 075), served under `/api/v1/expense-management`.
 * Amounts travel as decimal strings (a number is accepted on input); dates as `YYYY-MM-DD`, instants as ISO 8601.
 */

export type ExmDecimal = string | number;

export const EXM_REPORT_STATUSES = [
  'draft',
  'submitted',
  'under_review',
  'approved',
  'rejected',
  'posted',
  'reimbursed',
  'cancelled',
] as const;
export type ExmReportStatus = (typeof EXM_REPORT_STATUSES)[number];

export const EXM_PAYMENT_METHODS = ['employee_out_of_pocket', 'corporate_card'] as const;
export type ExmPaymentMethod = (typeof EXM_PAYMENT_METHODS)[number];

export const EXM_CALCULATION_SOURCES = ['CH_TCS', 'CH_SPESENREGLEMENT', 'IT_ACI_TABLE'] as const;
export type ExmCalculationSource = (typeof EXM_CALCULATION_SOURCES)[number];

export const EXM_DESTINATION_TYPES = ['municipality', 'domestic', 'international'] as const;
export type ExmDestinationType = (typeof EXM_DESTINATION_TYPES)[number];

export const EXM_ALLOWANCE_METHODS = ['flat_rate', 'mixed', 'analytic'] as const;
export type ExmAllowanceMethod = (typeof EXM_ALLOWANCE_METHODS)[number];

export const EXM_RECONCILIATION_STATUSES = ['unmatched', 'matched', 'ignored', 'disputed'] as const;
export type ExmReconciliationStatus = (typeof EXM_RECONCILIATION_STATUSES)[number];

export const EXM_SEVERITIES = ['warning', 'blocking'] as const;
export type ExmSeverity = (typeof EXM_SEVERITIES)[number];

export const EXM_PAYOUT_CHANNELS = ['pain001', 'payroll'] as const;
export type ExmPayoutChannel = (typeof EXM_PAYOUT_CHANNELS)[number];

export type ExmJurisdiction = 'CH' | 'IT';

/** Codes of the policy and duplicate violations the API reports (`expenseManagement.violation.<code>`). */
export const EXM_VIOLATION_CODES = [
  'duplicate_receipt_hash',
  'duplicate_merchant_date_amount',
  'exceeds_item_cap',
  'exceeds_daily_cap',
  'receipt_required',
  'non_traceable_payment',
  'taxable_per_diem_excess',
  'missing_merchant_tax_id',
  'outside_report_period',
  'future_date',
  'expense_too_old',
  'low_ocr_confidence',
  'vat_not_recoverable',
] as const;

/** Codes of the problem details (`expenseManagement.error.<code>`). */
export const EXM_ERROR_CODES = [
  'report_not_editable',
  'report_empty',
  'blocking_violations',
  'missing_receipt',
  'invalid_transition',
  'self_approval_forbidden',
  'rejection_reason_required',
  'no_reimbursable_amount',
  'employee_iban_missing',
  'card_transaction_mismatch',
  'card_transaction_already_matched',
  'vehicle_rate_not_found',
  'currency_rate_missing',
  'receipt_not_found',
  'period_invalid',
  'category_not_found',
  'amount_exceeds_transaction',
  'debtor_account_missing',
  'approved_amount_exceeds',
] as const;

/** Expense category codes (`expenseManagement.category.<code>`). */
export const EXM_CATEGORY_CODES = [
  'meals',
  'lodging',
  'local_transport',
  'fuel',
  'mileage',
  'tolls_parking',
  'supplies',
  'representation',
  'other',
] as const;

/** Actions recorded in the audit trail (`expenseManagement.audit.<action>`). */
export const EXM_AUDIT_ACTIONS = [
  'created',
  'updated',
  'line_added',
  'line_updated',
  'line_removed',
  'mileage_added',
  'per_diem_added',
  'per_diem_removed',
  'review_started',
  'card_matched',
  'card_unmatched',
  'submitted',
  'approved',
  'rejected',
  'payout_exported',
  'reimbursed',
  'cancelled',
] as const;

/** Fiscal notices the UI shows by jurisdiction (`expenseManagement.fiscal.<code>`). */
export const EXM_FISCAL_NOTICES = [
  'it_art51_tuir',
  'it_traceable_payment',
  'ch_spesenreglement',
  'ch_tcs_mileage',
  'it_aci_tables',
  'it_per_diem_limits',
] as const;

export interface ExmEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface ExmPageMeta {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

export interface ExmPage<T> extends ExmEnvelope<T[]> {
  meta: ExmPageMeta;
}

/** RFC 7807 problem; `code` is the suffix of `expenseManagement.error.<code>`. */
export interface ExmProblem {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  code?: string;
  message?: string;
  errors?: Record<string, string[]>;
}

export interface ExmViolation {
  code: string;
  severity: ExmSeverity;
  params?: Record<string, string | number | null> | null;
}

export interface ExmCategory {
  id: string;
  code: string;
  name_key: string;
  is_meal: boolean;
  is_lodging: boolean;
  is_transport: boolean;
  is_mileage: boolean;
  vat_recoverable: boolean;
  requires_receipt: boolean;
}

export interface ExmEmployeeRef {
  id: string;
  name: string;
}

export interface ExmLookups {
  categories: ExmCategory[];
  statuses: ExmReportStatus[];
  payment_methods: ExmPaymentMethod[];
  calculation_sources: ExmCalculationSource[];
  destination_types: ExmDestinationType[];
  allowance_methods: ExmAllowanceMethod[];
  reconciliation_statuses: ExmReconciliationStatus[];
  jurisdiction: ExmJurisdiction;
  base_currency: string;
  /** Codes of the fiscal notices (`expenseManagement.fiscal.<code>`) of the active jurisdiction. */
  fiscal_notice_codes?: string[];
  employees: ExmEmployeeRef[];
}

export interface ExmAbilities {
  update: boolean;
  submit: boolean;
  approve: boolean;
  settle: boolean;
}

export interface ExmReportTotals {
  total_amount: ExmDecimal;
  approved_amount: ExmDecimal | null;
  reimbursable_amount: ExmDecimal;
  non_reimbursable_amount: ExmDecimal;
  taxable_amount: ExmDecimal;
  violations_count?: number;
  blocking_violations_count?: number;
}

export interface ExmReport extends ExmReportTotals {
  id: string;
  report_number: string;
  title: string | null;
  employee_id: string;
  employee: ExmEmployeeRef | null;
  user_id: string | null;
  cost_center_id: string | null;
  company_id: string | null;
  jurisdiction: ExmJurisdiction;
  period_start: string;
  period_end: string;
  currency: string;
  status: ExmReportStatus;
  submitted_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  posted_at: string | null;
  reimbursed_at: string | null;
  violations_count: number;
  blocking_violations_count: number;
  abilities: ExmAbilities;
}

export interface ExmMileage {
  id: string;
  origin_address: string;
  destination_address: string;
  waypoint_addresses: string[] | null;
  distance_km: ExmDecimal;
  is_round_trip: boolean;
  vehicle_class_code: string;
  vehicle_make_model: string | null;
  rate_per_km: ExmDecimal;
  calculated_amount: ExmDecimal;
  calculation_source: ExmCalculationSource;
  rate_effective_date: string | null;
  rate_period: string | null;
}

export interface ExmLine {
  id: string;
  expense_report_id: string;
  expense_date: string;
  category_id: string;
  category: Pick<ExmCategory, 'id' | 'code' | 'name_key'> | null;
  merchant_name: string | null;
  merchant_tax_id: string | null;
  description: string | null;
  original_amount: ExmDecimal;
  original_currency: string;
  exchange_rate: ExmDecimal | null;
  exchange_rate_date: string | null;
  amount_in_base_currency: ExmDecimal;
  vat_rate: ExmDecimal | null;
  vat_amount: ExmDecimal | null;
  vat_recoverable_amount: ExmDecimal | null;
  payment_method: ExmPaymentMethod;
  corporate_card_transaction_id: string | null;
  is_traceable_payment: boolean;
  is_taxable_benefit: boolean;
  is_reimbursable: boolean;
  policy_violations: ExmViolation[];
  project_id: string | null;
  billable_to_customer: boolean;
  receipt_id: string | null;
  receipt_sha256: string | null;
  has_receipt: boolean;
  mileage: ExmMileage | null;
}

export interface ExmLinePayload {
  expense_date: string;
  category_id: string;
  merchant_name: string;
  merchant_tax_id?: string | null;
  description?: string | null;
  original_amount: ExmDecimal;
  original_currency: string;
  exchange_rate?: ExmDecimal | null;
  exchange_rate_date?: string | null;
  vat_rate?: ExmDecimal | null;
  vat_amount?: ExmDecimal | null;
  payment_method: ExmPaymentMethod;
  corporate_card_transaction_id?: string | null;
  project_id?: string | null;
  billable_to_customer?: boolean;
  /** False when an out-of-pocket expense was paid in cash (default true). */
  is_traceable_payment?: boolean;
  receipt_id?: string | null;
}

/** What a line mutation answers: the line in `data`, the recalculated totals of its report in `meta`. */
export interface ExmLineResult extends ExmEnvelope<ExmLine> {
  meta?: { report_totals?: ExmReportTotals };
}

/** What the removal of a line answers: the recalculated totals of its report in `meta`. */
export interface ExmTotalsResult extends ExmEnvelope<null> {
  meta?: { report_totals?: ExmReportTotals };
}

export interface ExmCardImportRow {
  external_id?: string | null;
  merchant_name: string;
  transaction_date: string;
  posting_date?: string | null;
  amount: ExmDecimal;
  currency?: string | null;
}

export interface ExmCardImportPayload {
  card_account_id: string;
  transactions: ExmCardImportRow[];
}

export interface ExmMileagePayload {
  expense_date: string;
  origin_address: string;
  destination_address: string;
  waypoint_addresses?: string[];
  distance_km: ExmDecimal;
  is_round_trip: boolean;
  vehicle_class_code: string;
  vehicle_make_model?: string | null;
  calculation_source?: ExmCalculationSource | null;
  annual_km_bracket?: number | null;
  description?: string | null;
  project_id?: string | null;
}

export interface ExmMileageQuotePayload {
  vehicle_class_code: string;
  distance_km: ExmDecimal;
  is_round_trip: boolean;
  on_date?: string | null;
  calculation_source?: ExmCalculationSource | null;
  annual_km_bracket?: number | null;
}

export interface ExmMileageQuote {
  rate_per_km: ExmDecimal;
  total_km: ExmDecimal;
  calculated_amount: ExmDecimal;
  calculation_source: ExmCalculationSource;
  rate_effective_date: string | null;
  rate_period: string | null;
  currency: string;
}

export interface ExmPerDiemPayload {
  country_code: string;
  destination_type: ExmDestinationType;
  allowance_method: ExmAllowanceMethod;
  trip_start_at: string;
  trip_end_at: string;
  allowance_rate_per_day?: ExmDecimal | null;
  lodging_reimbursed?: boolean;
  meals_reimbursed?: boolean;
}

export interface ExmPerDiem {
  id?: string;
  country_code: string;
  destination_type: ExmDestinationType;
  allowance_method: ExmAllowanceMethod;
  trip_start_at: string;
  trip_end_at: string;
  duration_hours: ExmDecimal;
  days_count: ExmDecimal;
  allowance_rate_per_day: ExmDecimal;
  gross_allowance_amount: ExmDecimal;
  daily_tax_free_limit: ExmDecimal;
  tax_free_amount: ExmDecimal;
  taxable_excess_amount: ExmDecimal;
  meals_lodging_reductions: ExmDecimal;
  warnings: { code: string; params?: Record<string, string | number | null> | null }[];
}

export interface ExmAuditEntry {
  id: string;
  action: string;
  from_status: ExmReportStatus | null;
  to_status: ExmReportStatus | null;
  actor_id: string | null;
  actor_name?: string | null;
  payload?: Record<string, unknown> | null;
  created_at: string;
}

export interface ExmPayout {
  id: string;
  channel: ExmPayoutChannel;
  status: string;
  total_amount: ExmDecimal;
  taxable_amount: ExmDecimal;
  exempt_amount: ExmDecimal;
  file_name: string | null;
}

export interface ExmReportDetail extends ExmReport {
  lines: ExmLine[];
  per_diems: ExmPerDiem[];
  audit: ExmAuditEntry[];
  payouts: ExmPayout[];
}

export interface ExmReportFilters {
  status?: ExmReportStatus;
  employee_id?: string;
  period_from?: string;
  period_to?: string;
  q?: string;
  page?: number;
  per_page?: number;
}

export interface ExmReportPayload {
  title?: string | null;
  employee_id?: string | null;
  period_start: string;
  period_end: string;
  currency?: string | null;
  cost_center_id?: string | null;
}

export interface ExmApprovePayload {
  approved_amount?: ExmDecimal | null;
  comment?: string | null;
}

export interface ExmExportPayoutPayload {
  channel: ExmPayoutChannel;
  execution_date?: string | null;
}

export interface ExmOcrLine {
  description: string;
  amount: ExmDecimal;
}

export interface ExmOcr {
  provider: string;
  confidence: number;
  merchant_name: string | null;
  expense_date: string | null;
  currency: string | null;
  total_amount: ExmDecimal | null;
  vat_amount: ExmDecimal | null;
  vat_rate: ExmDecimal | null;
  lines: ExmOcrLine[];
}

export interface ExmDuplicateWarning extends ExmViolation {
  matched_line_id?: string | null;
  matched_report_number?: string | null;
}

export interface ExmReceiptScan {
  receipt_id: string;
  sha256: string;
  mime_type: string;
  size_bytes: number;
  file_name: string;
  ocr: ExmOcr;
  duplicate_warnings: ExmDuplicateWarning[];
}

export interface ExmAciRate {
  id: string;
  source: ExmCalculationSource;
  vehicle_code: string;
  make_model: string | null;
  fuel: string | null;
  vehicle_class: string | null;
  annual_km_bracket: number | null;
  rate_per_km: ExmDecimal;
  rate_period: string | null;
  valid_from: string | null;
  valid_to: string | null;
}

export interface ExmAciRateFilters {
  source?: ExmCalculationSource;
  vehicle_code?: string;
  fuel?: string;
  q?: string;
  on_date?: string;
}

export interface ExmBalance {
  open_reports: number;
  open_amount: ExmDecimal;
  approved_unpaid_amount: ExmDecimal;
  advances_outstanding: ExmDecimal;
  per_diem_taxable_ytd: ExmDecimal;
  currency: string;
}

export interface ExmCardAccount {
  id: string;
  holder_name: string;
  card_last4: string;
  currency: string;
  issuer: string | null;
}

export interface ExmCardMatchedLine {
  id: string;
  expense_report_id: string;
  report_number: string;
  amount: ExmDecimal;
}

export interface ExmCardTransaction {
  id: string;
  card_account_id: string;
  merchant_name: string;
  transaction_date: string;
  posting_date: string | null;
  amount: ExmDecimal;
  currency: string;
  card_last4: string;
  holder_name: string;
  status: ExmReconciliationStatus;
  matched_amount: ExmDecimal;
  remaining_amount: ExmDecimal;
  matched_lines: ExmCardMatchedLine[];
}

export interface ExmCardFilters {
  status?: ExmReconciliationStatus;
  card_account_id?: string;
  page?: number;
  per_page?: number;
}

export type ExmReconcileAction = 'match' | 'unmatch' | 'ignore' | 'dispute';

export interface ExmReconcilePayload {
  action: ExmReconcileAction;
  matches?: { expense_line_id: string; amount?: ExmDecimal }[];
}

export interface ExmViolationRow {
  line_id: string;
  report_id: string;
  report_number: string;
  employee: ExmEmployeeRef | null;
  expense_date: string;
  merchant_name: string | null;
  amount: ExmDecimal;
  violations: ExmViolation[];
}

export interface ExmViolationFilters {
  report_id?: string;
  severity?: ExmSeverity;
  employee_id?: string;
  page?: number;
  per_page?: number;
}
