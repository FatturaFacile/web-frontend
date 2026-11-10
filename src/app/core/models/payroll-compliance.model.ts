/** Payroll compliance, legal tables, Swissdec and reports (`/payroll/*`). Money and rates are decimal strings. */

export type SwissdecVersion = '5.0' | '6.0';
export type WithholdingPeriodType = 'monthly' | 'quarterly' | 'annual';

/** A row of the generic payroll tables: the API returns the model attributes. */
export interface PayrollGenericRecord {
  id: string;
  [key: string]: unknown;
}

export interface LegalParameterRecord extends PayrollGenericRecord {
  topic: string;
  year: number;
  source?: string | null;
  parameters: Record<string, unknown>;
}

export interface LegalParametersPayload {
  parameters: Record<string, unknown>;
  source: string;
}

export interface AnnualParameterRecord extends PayrollGenericRecord {
  country: string;
  year: number;
  legal_reference?: string | null;
  tenant_id?: string | null;
  parameters: Record<string, number>;
}

export interface AnnualParametersPayload {
  parameters: Record<string, number>;
  legal_reference?: string | null;
}

export type TariffSummaryRow = Record<string, unknown>;

export interface WithholdingStatementQuery {
  year: number;
  period_type: WithholdingPeriodType;
  period: number;
  canton?: string | null;
}

export interface WithholdingStatementLine {
  entry_type: string;
  employee_id: string;
  month: number;
  last_name: string | null;
  first_name: string | null;
  tariff_code: string | null;
  gross: string;
  basis: string;
  rate_percent: string;
  tax: string;
  missing: unknown[];
}

export interface WithholdingStatementCanton {
  canton: string;
  recommended_period: string;
  lines: WithholdingStatementLine[];
  total_tax: string;
  collection_commission_electronic: string;
  is_closed: boolean;
  missing_data: unknown[];
}

export interface WithholdingStatementReport {
  year: number;
  period_type: string;
  period: number;
  format_status: string;
  statements: WithholdingStatementCanton[];
  warnings: unknown[];
}

export interface FrontierNightsPayload {
  year: number;
  nights_away: number;
}

export interface SwissdecStatus {
  is_certified: boolean;
  structure_basis: string;
  schema_namespace: string;
  schema_validated: boolean;
  current_certification_basis: string;
  domains_built: unknown[];
  domains_not_built: string[];
  missing_for_certification: unknown[];
}

export interface SwissdecReadinessPerson {
  employee_id: string;
  employee_name: string;
  issues: unknown[];
}

export interface SwissdecReadiness {
  company: unknown[];
  persons: SwissdecReadinessPerson[];
  is_complete: boolean;
}

/** The declaration is a deep structure: the page shows the certification block and the raw structure. */
export interface SwissdecDeclaration {
  certification: SwissdecStatus;
  SalaryDeclaration: Record<string, unknown>;
}

export interface SwissdecTransmissionResult {
  declaration_id: string;
  received_at: string;
}

export interface PayslipDeliveryResult {
  sent: number;
  skipped: { employee_id: string; reason: string }[];
}

export interface PaymentBatchAllocation {
  bank_account_id: string;
  employee_ids?: string[] | null;
  department_id?: string | null;
}

export interface PayrollPaymentBatch {
  id: string;
  bank_account_id: string | null;
  batch_reference: string | null;
  total_amount: string;
  item_count: number;
  status: string;
}

export type LabourCostGroupBy = 'department' | 'site';

export interface LabourCostRow {
  group_id: string | null;
  group_name: string | null;
  headcount: string;
  hours: string;
  gross_salary: string;
  employer_contributions: string;
  labour_cost: string;
  cost_per_hour: string | null;
}

export interface LabourCostReport {
  year: number;
  month: number | null;
  group_by: string;
  rows: LabourCostRow[];
  employees_without_hours: number;
}

export interface ChildAllowanceRow {
  child_id: string;
  employee_id: string;
  employee_name: string;
  kind: 'education' | 'child' | null;
  amount: string | null;
  canton: string;
  rate_valid_from: string | null;
}

export interface HiringSimulationPayload {
  year: number;
  annual_gross?: number | null;
  target_net_monthly?: number | null;
  date_of_birth?: string | null;
  fte_ratio?: number | null;
  salary_installments_per_year?: number | null;
  withholding_tax_rate_percent?: number | null;
  pension_fund_employee_rate_percent?: number | null;
  residence_country?: string | null;
}

export interface HiringSimulationResult {
  direction: string;
  currency: 'CHF' | 'EUR';
  annual_gross: string;
  monthly_gross: string;
  total_deductions: string;
  monthly_net: string;
  target_net_monthly: string | null;
  is_exact: boolean;
  employer_total_cost: string;
  deductions: Record<string, string>;
  notes: string;
}
