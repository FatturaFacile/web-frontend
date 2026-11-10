/** Short-time work, bad weather and construction wage (`/payroll/short-time/*`, `/payroll/construction/*`). */

export type ShortTimeKind = 'short_time' | 'bad_weather';
export type ShortTimeClaimStatus = 'draft' | 'submitted' | 'reimbursed';

export interface ShortTimeCasePayload {
  kind: ShortTimeKind;
  department_id?: string | null;
  cause: string;
  notified_on?: string | null;
  is_urgent?: boolean;
  starts_on: string;
  ends_on?: string | null;
  authority_reference?: string | null;
}

export interface ShortTimeClaimSummary {
  id: string;
  year?: number;
  month?: number;
  status: ShortTimeClaimStatus;
  total_compensation?: string;
}

export interface ShortTimeCaseRecord extends ShortTimeCasePayload {
  id: string;
  claims?: ShortTimeClaimSummary[];
}

export interface ShortTimeClaimEmployeePayload {
  employee_id: string;
  target_hours?: number | null;
  worked_hours?: number | null;
  absence_hours?: number | null;
  overtime_hours?: number | null;
  regular_allowances?: number | null;
  consented?: boolean;
}

export interface ShortTimeClaimPayload {
  year: number;
  month: number;
  employees: ShortTimeClaimEmployeePayload[];
}

export interface ShortTimeClaim {
  id: string;
  status: ShortTimeClaimStatus;
  loss_percent: string;
  meets_minimum_loss: boolean;
  total_compensation: string;
  claim_due_on: string;
  warnings: string[];
  lines: Record<string, unknown>[];
}

export interface ShortTimeReimbursementPayload {
  amount: number;
  paid_on?: string | null;
}

export interface ConstructionParametersPayload {
  agreement_code: string;
  valid_from: string;
  annual_hours: number;
  accounting_year_start_month: number;
  /** qualification > zone > {monthly, hourly}. */
  minimum_wages: Record<string, Record<string, { monthly: number; hourly: number }>>;
  source: string;
}

export interface ConstructionCalendarPayload {
  agreement_code: string;
  months: { year: number; month: number; planned_hours: number }[];
}

export interface ConstructionQuery {
  agreement_code: string;
  accounting_year: number;
  employee_id?: string;
}

export interface ConstructionHoursMonth {
  year: string;
  month: string;
  planned_hours: string;
  worked_hours: string;
  balance_hours: string;
}

export interface ConstructionHours {
  agreement_code: string;
  accounting_year: number;
  months: ConstructionHoursMonth[];
  balance_hours: string;
  hourly_wage: string;
  constant_monthly_wage: string;
}

export interface JointCommissionRow {
  qualification: string;
  zone: string;
  headcount: number;
  worked_hours: string;
  gross_salary: string;
  average_hourly: string | null;
  average_monthly: string | null;
  minimum_hourly: string | null;
  minimum_monthly: string | null;
  below_minimum: string[];
}

export interface JointCommissionReport {
  agreement_code: string;
  accounting_year: number;
  parameters_valid_from: string;
  annual_hours: string;
  source: string;
  rows: JointCommissionRow[];
}
