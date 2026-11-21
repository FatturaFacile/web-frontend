/** Italian payroll pre-processing (Mod 077): the monthly closing of the payroll month with the labour consultant. */

export type ItalianPayrollStatus =
  'attendance_open' | 'validated' | 'exported_to_cdl' | 'cedolini_imported' | 'paid';

export type ConsultantFormat = 'zucchetti' | 'teamsystem' | 'inaz' | 'gis' | 'generic_csv';

export const CONSULTANT_FORMATS: readonly ConsultantFormat[] = [
  'zucchetti',
  'teamsystem',
  'inaz',
  'gis',
  'generic_csv',
];

export interface ItalianPayrollIssue {
  employee_id: string;
  code: string;
  message: string;
}

export interface ItalianPayrollValidationReport {
  errors: ItalianPayrollIssue[];
  warnings: ItalianPayrollIssue[];
  checked_at?: string;
}

export interface ItalianPayrollPeriod {
  id: string;
  legal_entity_id: string | null;
  year: number;
  month: number;
  include_tredicesima: boolean;
  include_quattordicesima: boolean;
  status: ItalianPayrollStatus;
  export_format: ConsultantFormat | null;
  validated_at: string | null;
  exported_at: string | null;
  paid_at: string | null;
  validation_report: ItalianPayrollValidationReport | null;
  /** True once the accounting summary of the consultant is posted (the status does not change on that import). */
  accounting_imported: boolean;
}

export interface CreateItalianPayrollPeriodPayload {
  year: number;
  month: number;
  legal_entity_id?: string | null;
  include_tredicesima?: boolean;
  include_quattordicesima?: boolean;
}

export interface FringeBenefitInput {
  employee_id: string;
  amount: number;
}

export interface ItalianPayrollValidationResult {
  period_id: string;
  status: ItalianPayrollStatus;
  validated: boolean;
  line_count: number;
  errors: ItalianPayrollIssue[];
  warnings: ItalianPayrollIssue[];
}

export interface CedoliniMatch {
  employee_id: string;
  tax_code_suffix: string;
  pages: string;
}

export interface CedoliniUnmatched {
  tax_code_suffix: string | null;
  pages: string;
}

export interface CedoliniImportResult {
  matched: CedoliniMatch[];
  unmatched: CedoliniUnmatched[];
  status: ItalianPayrollStatus;
}

export interface EmployeeNetInput {
  employee_id: string;
  net_amount: number;
}

/** Amounts of the accounting summary (prospetto contabile) as the consultant states them, in euro. */
export interface AccountingImportPayload {
  total_gross_wages: number;
  inps_employee_withholding: number;
  inps_employer_contribution: number;
  irpef_withholding: number;
  regional_municipal_addizionali: number;
  tfr_monthly_accrual: number;
  tfr_fondo_tesoreria_or_previdenza: number;
  inail_accrual?: number;
  net_payable: number;
  company_id?: string | null;
  employee_nets?: EmployeeNetInput[];
}

export interface AccountingImportResult {
  id: string;
  gl_journal_entry_id: string | null;
  net_payable: string;
}

export interface SepaSalaryPayload {
  debtor_name: string;
  debtor_iban: string;
  debtor_bic?: string | null;
  /** YYYY-MM-DD, today or later. */
  execution_date: string;
}

export interface F24Line {
  section: 'erario' | 'regioni' | 'enti_locali';
  tax_code: string;
  description: string;
  amount: string;
}

export interface F24Summary {
  period_id: string;
  due_date: string;
  lines: F24Line[];
  total: string;
}

export interface PayslipAuditEvent {
  kind: string;
  ip: string | null;
  biometric: boolean;
  at: string;
}

export interface PayslipDownloadAuditRow {
  employee_id: string;
  net_amount: string;
  delivered: boolean;
  first_viewed_at: string | null;
  first_viewed_from_ip: string | null;
  events: PayslipAuditEvent[];
}

export interface TfrLedgerMonth {
  month: number;
  accrual: string;
  running: string;
}

export interface TfrLedger {
  year: number;
  months: TfrLedgerMonth[];
  total: string;
  revaluation: { gross: string; tax: string; net: string; rate: string } | null;
}

export type ItalianPayrollGlRole =
  | 'gross_wages'
  | 'employer_inps'
  | 'tfr_accrual'
  | 'net_payable'
  | 'inps_payable'
  | 'irpef_payable'
  | 'addizionali_payable'
  | 'tfr_fund';

export interface GlAccountAssignment {
  role: ItalianPayrollGlRole;
  account_id: string;
}
