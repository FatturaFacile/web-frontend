/** Employee payroll data (`/payroll/employee-profiles|inputs|absences|children`). Resources are untyped in the OpenAPI. */

export interface PayrollEmployeeProfileRecord {
  employee_id: string;
  social_security_number: string | null;
  iban: string | null;
  street: string | null;
  house_number: string | null;
  postal_code: string | null;
  city: string | null;
  gender: 'M' | 'F' | null;
  residence_permit: string | null;
  residence_country: string;
  residence_canton: string | null;
  work_canton: string | null;
  civil_status: string | null;
  church_tax: boolean;
  pay_type: 'monthly' | 'hourly';
  salary_installments_per_year: number;
  hourly_wage: string;
  weekly_hours: string;
  holiday_weeks: string;
  is_fixed_term_contract: boolean;
  is_withholding_tax_subject: boolean;
  withholding_tax_code: string | null;
  withholding_tax_rate_percent: string | null;
  italian_tax_code: string | null;
  frontier_regime: 'old' | 'new' | 'not_covered' | null;
  collective_agreement_code: string | null;
  contract_level: string | null;
}

/** Every field is optional: the server keeps what is not sent. Decimals are strings. */
export type PayrollEmployeeProfilePayload = Partial<
  Omit<PayrollEmployeeProfileRecord, 'employee_id' | 'salary_installments_per_year'>
> & { salary_installments_per_year?: number };

export interface PayrollInputRecord {
  id: string;
  year: number;
  month: number;
  employee_id: string;
  wage_type_code: string;
  quantity: string;
  rate: string;
  amount: string;
  note: string | null;
}

export interface PayrollInputPayload {
  year: number;
  month: number;
  employee_id: string;
  wage_type_code: string;
  quantity?: string;
  rate?: string;
  amount?: string;
  note?: string | null;
}

export type PayrollAbsenceType =
  | 'Sickness'
  | 'Accident'
  | 'Maternity'
  | 'Paternity'
  | 'Military'
  | 'Vacation'
  | 'Unpaid'
  | 'Other';

export interface PayrollAbsenceRecord {
  id: string;
  employee_id: string;
  absence_type: PayrollAbsenceType | string;
  start_date: string;
  end_date: string;
  percent: string;
  note: string | null;
}

export interface PayrollAbsencePayload {
  employee_id: string;
  absence_type: PayrollAbsenceType;
  start_date: string;
  end_date: string;
  percent?: string;
  note?: string | null;
}

export interface PayrollChildRecord {
  id: string;
  employee_id: string;
  first_name: string;
  last_name: string | null;
  date_of_birth: string;
  in_education: boolean;
  education_end_date: string | null;
  allowance_eligible: boolean;
}

export interface PayrollChildPayload {
  employee_id: string;
  first_name: string;
  last_name?: string | null;
  date_of_birth: string;
  in_education?: boolean;
  education_end_date?: string | null;
  allowance_eligible?: boolean;
}
