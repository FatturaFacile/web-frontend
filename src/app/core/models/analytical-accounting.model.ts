/** Industrial and analytical cost accounting (Mod 018): contract of /api/v1/analytical. */

export const CENTER_TYPES = ['COST_CENTER', 'PROFIT_CENTER'] as const;
export type AnalyticalCenterType = (typeof CENTER_TYPES)[number];

export const CENTER_CATEGORIES = [
  'STRUCTURAL',
  'AUXILIARY',
  'PRODUCTION',
  'LOGISTICS',
  'COMMERCIAL',
  'PROFIT',
] as const;
export type AnalyticalCenterCategory = (typeof CENTER_CATEGORIES)[number];

export const DRIVER_TYPES = [
  'AREA_SQM',
  'HEADCOUNT_FTE',
  'MACHINE_HOURS',
  'REVENUE_VOLUME',
  'FIXED_PERCENTAGE',
  'CUSTOM',
] as const;
export type AllocationDriverType = (typeof DRIVER_TYPES)[number];

export const COST_ELEMENT_TYPES = [
  'VARIABLE_DIRECT',
  'FIXED_DIRECT',
  'INDIRECT_AUXILIARY',
  'REVENUE',
  'NON_OPERATING',
] as const;
export type CostElementType = (typeof COST_ELEMENT_TYPES)[number];

export type AnalyticalEntryType =
  | 'GL_ALLOCATION'
  | 'SALES_INVOICE'
  | 'PURCHASE_INVOICE'
  | 'CREDIT_NOTE'
  | 'STEP_DOWN_APPORTIONMENT'
  | 'MANUAL_ADJUSTMENT'
  | 'REVERSAL';

export type DerivationSource = 'MANUAL' | 'RULE' | 'MASTER_DEFAULT' | 'APPORTIONMENT';
export type ApportionmentRunStatus = 'PREVIEW' | 'CONSOLIDATED' | 'REVERSED';

export interface AnalyticalResponse<T> {
  data: T;
}

export interface AnalyticalPage<T> {
  data: T[];
  meta?: { current_page: number; last_page: number; per_page: number; total: number };
}

export interface AnalyticalCenter {
  id: string;
  parent_id: string | null;
  code: string;
  name: string;
  name_translations?: Record<string, string> | null;
  center_type: AnalyticalCenterType;
  category: AnalyticalCenterCategory;
  path: string;
  depth: number;
  manager_user_id: string | null;
  manager_name: string | null;
  is_active: boolean;
  valid_from: string | null;
  valid_to: string | null;
  default_profit_center_id?: string | null;
  default_project_id?: string | null;
  default_product_line_id?: string | null;
  default_cost_element_type?: CostElementType | null;
}

export interface AnalyticalCenterNode extends AnalyticalCenter {
  children: AnalyticalCenterNode[];
}

export interface AnalyticalCenterPayload {
  parent_id?: string | null;
  code: string;
  name: string;
  center_type: AnalyticalCenterType;
  category: AnalyticalCenterCategory;
  manager_name?: string | null;
  manager_user_id?: string | null;
  is_active?: boolean;
  valid_from?: string | null;
  valid_to?: string | null;
  default_profit_center_id?: string | null;
  default_cost_element_type?: CostElementType | null;
}

export interface DerivationRule {
  id: string;
  name: string;
  priority: number;
  is_active: boolean;
  valid_from: string | null;
  valid_to: string | null;
  accounting_cause_id: string | null;
  journal_type: string | null;
  product_id: string | null;
  product_category_id: string | null;
  account_id: string | null;
  counterparty_type: string | null;
  counterparty_id: string | null;
  cost_center_id: string | null;
  profit_center_id: string | null;
  project_id: string | null;
  product_line_id: string | null;
  cost_element_type: CostElementType | null;
}

export type DerivationRulePayload = Partial<Omit<DerivationRule, 'id'>> &
  Pick<DerivationRule, 'name' | 'priority'>;

export interface DerivationTestPayload {
  date?: string;
  accounting_cause_id?: string;
  journal_type?: string;
  product_id?: string;
  product_category_id?: string;
  account_id?: string;
  counterparty_type?: string;
  counterparty_id?: string;
  explicit?: Partial<AllocationDimensions>;
}

export interface AllocationDimensions {
  cost_center_id: string | null;
  profit_center_id: string | null;
  project_id: string | null;
  product_line_id: string | null;
  cost_element_type: CostElementType | null;
}

export interface DerivationTestResult {
  dimensions: AllocationDimensions;
  provenance: Partial<Record<keyof AllocationDimensions, DerivationSource>>;
  source: DerivationSource;
  rule_ids: string[];
}

/** One allocation vector of a line: either a percentage or an exact amount (never both). */
export interface AllocationVector {
  cost_center_id?: string | null;
  profit_center_id?: string | null;
  project_id?: string | null;
  product_line_id?: string | null;
  cost_element_type?: CostElementType | null;
  percentage?: number | null;
  amount?: string | null;
}

export interface AllocationDriver {
  id: string;
  code: string;
  name: string;
  driver_type: AllocationDriverType;
  unit: string | null;
  is_system: boolean;
  is_active: boolean;
}

export interface DriverValue {
  id: string;
  allocation_driver_id: string;
  analytical_center_id: string;
  period_key: string;
  value: string;
}

export interface DriverValueInput {
  analytical_center_id: string;
  value: number;
}

export interface AnalyticalEntryLine {
  id: string;
  line_number: number;
  cost_center_id: string | null;
  profit_center_id: string | null;
  project_id: string | null;
  product_line_id: string | null;
  cost_element_type: CostElementType;
  amount: string;
  split_percentage: string | null;
  derivation_source: DerivationSource;
  description: string | null;
}

export interface AnalyticalEntry {
  id: string;
  entry_type: AnalyticalEntryType;
  posting_date: string;
  period_key: string;
  currency: string;
  description: string | null;
  source_type: string | null;
  source_id: string | null;
  gl_journal_entry_id: string | null;
  invoice_id: string | null;
  apportionment_run_id: string | null;
  is_reversed: boolean;
  reversed_by_entry_id: string | null;
  lines: AnalyticalEntryLine[];
}

export interface AnalyticalEntryPayload {
  posting_date: string;
  description?: string | null;
  lines: {
    amount: string;
    cost_element_type?: CostElementType | null;
    cost_center_id?: string | null;
    profit_center_id?: string | null;
    project_id?: string | null;
    product_line_id?: string | null;
    vectors?: AllocationVector[];
  }[];
}

export interface ScheduleStep {
  id?: string;
  step_order: number;
  source_center_id: string;
  allocation_driver_id?: string | null;
  driver_type: AllocationDriverType;
  include_descendants?: boolean;
  fixed_weights_json?: Record<string, number> | null;
  target_filter_json?: { center_ids?: string[]; categories?: AnalyticalCenterCategory[] } | null;
}

export interface ApportionmentSchedule {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  steps: ScheduleStep[];
}

export interface SchedulePayload {
  name: string;
  description?: string | null;
  is_active?: boolean;
  steps: ScheduleStep[];
}

export interface RunWarning {
  code: string;
  step_order: number;
  source_center_id: string;
  message: string;
}

export interface ApportionmentRunStep {
  step_order: number;
  source_center_id: string;
  driver_type: AllocationDriverType;
  status: 'EXECUTED' | 'SKIPPED';
  pool_amount: string;
  allocated_amount: string;
  driver_total: string;
  warnings: RunWarning[];
}

export interface ApportionmentAllocation {
  id: string;
  step_order: number;
  source_center_id: string;
  target_center_id: string;
  driver_type: AllocationDriverType;
  driver_value: string;
  driver_total: string;
  share_ratio: string;
  allocated_amount: string;
  rounding_adjustment: string;
  analytical_entry_id: string | null;
}

export interface ApportionmentRun {
  id: string;
  apportionment_schedule_id: string | null;
  period_key: string;
  period_start: string;
  period_end: string;
  status: ApportionmentRunStatus;
  total_pool: string;
  total_allocated: string;
  total_unallocated: string;
  warnings: RunWarning[] | null;
  consolidated_at: string | null;
  reversed_at: string | null;
  reversal_reason: string | null;
  steps?: ApportionmentRunStep[];
  allocations?: ApportionmentAllocation[];
}

export interface ReportFilters {
  from?: string;
  to?: string;
  cost_center_id?: string;
  profit_center_id?: string;
  project_id?: string;
  product_line_id?: string;
  include_descendants?: boolean;
  group_by?: 'cost_center' | 'profit_center' | 'project' | 'product_line';
}

export interface ContributionMarginStatement {
  operating_revenues: string;
  direct_variable_costs: string;
  contribution_margin_1: string;
  contribution_margin_1_pct: string;
  direct_fixed_costs: string;
  contribution_margin_2: string;
  contribution_margin_2_pct: string;
  indirect_costs: string;
  apportioned_costs: string;
  operating_result: string;
  operating_result_pct: string;
  non_operating: string;
}

export interface ContributionMarginReport {
  filters: ReportFilters;
  statement: ContributionMarginStatement;
  breakdown: ({ dimension: string; id: string } & ContributionMarginStatement)[];
}

export interface DirectVsApportionedRow {
  center_id: string;
  code: string;
  name: string;
  center_type: AnalyticalCenterType;
  depth: number;
  direct_cost: string;
  apportioned_in: string;
  apportioned_out: string;
  net_cost: string;
  variance: string;
  variance_pct: string;
  share_pct: string;
}

export interface DirectVsApportionedReport {
  rows: DirectVsApportionedRow[];
  totals: { direct_cost: string; apportioned_in: string; apportioned_out: string; net_cost: string };
}
