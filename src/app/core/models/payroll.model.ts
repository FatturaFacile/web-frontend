/**
 * Payroll (`/payroll/*`). The OpenAPI describes these resources as untyped payroll records: fields mirror
 * the server tables. Amounts, quantities and rates arrive as decimal strings.
 */

/** Statuses as stored by the server (capitalised). A calculated run is `Calculated`, not `Draft`. */
export type PayrollRunStatus = 'Draft' | 'Calculated' | 'Approved' | 'Final';

export interface PayrollRunEventRecord {
  id: string;
  payroll_run_id: string;
  action: string;
  reason: string | null;
  totals: Record<string, unknown> | null;
  actor_id: string | null;
  actor_name: string;
  occurred_at: string;
}

export interface PayslipLineRecord {
  id: string;
  payslip_id: string;
  wage_type_code: string;
  description: string;
  kind: string;
  quantity: string;
  rate: string;
  amount: string;
  certificate_box: string | null;
  sort_order: number;
}

export interface PayslipRecord {
  id: string;
  payroll_run_id: string;
  employee_id: string;
  year: number;
  month: number;
  employee_name: string;
  paid_days: string;
  gross_salary: string;
  employee_deductions: string;
  net_salary: string;
  payout_amount: string;
  employer_contributions: string;
  withholding_tax_rate_percent: string;
  withholding_tax_code: string | null;
  withholding_tax_canton: string | null;
  warnings: string | null;
  lines?: PayslipLineRecord[];
}

export interface PayrollRunRecord {
  id: string;
  year: number;
  month: number;
  country: string;
  currency: string;
  status: PayrollRunStatus | string;
  payment_date: string | null;
  calculated_at: string | null;
  approved_at: string | null;
  approved_by: string | null;
  finalized_at: string | null;
  finalized_by: string | null;
  reopened_at: string | null;
  reopened_by: string | null;
  reopen_reason: string | null;
  reopen_count: number;
  payslips?: PayslipRecord[];
  events?: PayrollRunEventRecord[];
}

export interface CalculatePayrollRunPayload {
  year: number;
  month: number;
  /** Y-m-d. */
  payment_date?: string | null;
}

export interface PayrollCostAllocation {
  run_id: string;
  year: number;
  month: number;
  currency: string;
  lines: {
    employee_id: string;
    employee_name: string;
    target_type: string;
    target_id: string;
    hours: string;
    amount: string;
  }[];
  totals: unknown[];
}

export interface PayrollYearEndReport {
  year: number;
  employees: Record<string, unknown>[];
}

export type WageTypeKind = 'Earning' | 'NonCash' | 'Expense' | 'Deduction' | 'Employer' | 'Information';

export interface WageTypeRecord {
  id: string;
  code: string;
  name: string;
  kind: WageTypeKind | string;
  subject_to_ahv: boolean;
  subject_to_alv: boolean;
  subject_to_uvg: boolean;
  subject_to_ktg: boolean;
  subject_to_bvg: boolean;
  subject_to_withholding_tax: boolean;
  is_irregular: boolean;
  certificate_box: string | null;
  sort_order: number;
  is_active: boolean;
}

export interface SalaryCertificateRecord {
  id: string;
  employee_id: string;
  year: number;
  period_from: string;
  period_to: string;
  box1_salary: string;
  box2_benefits: string;
  box3_irregular: string;
  box4_capital: string;
  box7_other: string;
  box8_gross: string;
  box9_social_contributions: string;
  box10_pension: string;
  box11_net: string;
  box12_withholding_tax: string;
  box13_expenses: string;
  remarks: string | null;
  generated_at: string | null;
}

export interface PayrollRecordFilterParams {
  employee_id?: string;
  year?: number;
  month?: number;
  per_page?: number;
  page?: number;
}

export interface FamilyAllowanceRateRecord {
  id: string;
  canton: string;
  valid_from: string;
  child_allowance: string;
  education_allowance: string;
}

export interface FamilyAllowanceRatePayload {
  canton: string;
  valid_from: string;
  child_allowance: string;
  education_allowance: string;
}

/** Rates come from the server only: never hard-code IRPEF/INPS/BVG values in the frontend. */
export type PayrollSettingsRecord = Record<string, string | number | boolean | string[] | null>;

export type PayrollSettingsPayload = Record<string, string | number | boolean | string[] | null>;
