/** Employee file: contracts, salary components, documents, org chart, collective agreements. */

export type ContractType = 'permanent' | 'fixed_term' | 'apprenticeship' | 'contractor' | 'internship' | 'seasonal';
export type ContractEmploymentType = 'full_time' | 'part_time' | 'contractor' | 'apprentice' | 'seasonal';
export type SalaryFrequency = 'monthly' | 'annual';

export interface SalaryComponentResource {
  id: string;
  contract_id: string;
  wage_type_code: string;
  description: string;
  /** Decimal string. */
  amount: string;
  frequency: SalaryFrequency | string;
  valid_from: string;
  valid_to: string | null;
}

export interface SalaryComponentPayload {
  wage_type_code: string;
  description: string;
  /** Decimal string. */
  amount: string;
  frequency?: SalaryFrequency;
  valid_from?: string;
  valid_to?: string | null;
}

export interface EmploymentContractResource {
  id: string;
  employee_id: string;
  contract_number: string;
  contract_type: ContractType | string;
  job_title: string;
  job_grade_id: string | null;
  collective_agreement: string | null;
  collective_agreement_id: string | null;
  collective_agreement_level_id: string | null;
  level_code: string | null;
  start_date: string;
  end_date: string | null;
  probation_end_date: string | null;
  weekly_hours: string;
  fte_percentage: string;
  base_annual_salary: string;
  hourly_rate: string;
  loaded_hourly_cost: string;
  currency: string;
  status: string;
  is_active: boolean;
  superseded_by_contract_id: string | null;
  terms: unknown[] | null;
  notes: string | null;
  salary_components: SalaryComponentResource[];
}

export interface NewContractPayload {
  contract_number?: string;
  contract_type: ContractType;
  employment_type?: ContractEmploymentType;
  job_title: string;
  job_grade_id?: string | null;
  collective_agreement?: string | null;
  collective_agreement_id?: string | null;
  collective_agreement_level_id?: string | null;
  level_code?: string | null;
  start_date: string;
  end_date?: string | null;
  probation_end_date?: string | null;
  /** Decimal strings from here down. */
  weekly_hours: string;
  fte_percentage?: string;
  base_annual_salary: string;
  hourly_rate?: string;
  loaded_hourly_cost?: string;
  currency?: string;
  notes?: string | null;
  salary_components?: SalaryComponentPayload[];
}

export interface UpdateContractPayload {
  job_title?: string;
  end_date?: string | null;
  probation_end_date?: string | null;
  collective_agreement?: string | null;
  collective_agreement_id?: string | null;
  collective_agreement_level_id?: string | null;
  level_code?: string | null;
  notes?: string | null;
}

export type EmployeeDocumentType =
  | 'contract'
  | 'amendment'
  | 'id_card'
  | 'work_permit'
  | 'medical_fitness'
  | 'certificate'
  | 'training'
  | 'nda'
  | 'warning'
  | 'payslip'
  | 'other';

export const EMPLOYEE_DOCUMENT_TYPES: EmployeeDocumentType[] = [
  'contract',
  'amendment',
  'id_card',
  'work_permit',
  'medical_fitness',
  'certificate',
  'training',
  'nda',
  'warning',
  'payslip',
  'other',
];

export interface UploadEmployeeDocumentPayload {
  file: File;
  document_type: EmployeeDocumentType;
  title: string;
  issue_date?: string | null;
  expiry_date?: string | null;
  retention_until?: string | null;
  contains_health_data?: boolean;
  is_confidential?: boolean;
  visible_to_employee?: boolean;
}

export interface TransferEmployeePayload {
  to_department_id?: string | null;
  to_team_id?: string | null;
  to_business_unit_id?: string | null;
  to_cost_center_id?: string | null;
  to_position_id?: string | null;
  to_manager_id?: string | null;
  effective_date?: string | null;
  reason?: string | null;
}

export interface EmployeeLifecycleEventResource {
  id: string;
  employee_id: string;
  event_type: string;
  effective_date: string;
  from_department_id: string | null;
  to_department_id: string | null;
  from_position_id: string | null;
  to_position_id: string | null;
  reason: string | null;
  approval_status: string;
  is_locked: boolean;
}

export interface DepartmentResource {
  id: string;
  code: string;
  name: string;
  parent_id: string | null;
  business_unit_id: string | null;
  cost_center_id: string | null;
  manager_employee_id: string | null;
  is_active: boolean;
  translations: unknown[];
}

export interface DepartmentPayload {
  code: string;
  name: string;
  parent_id?: string | null;
  business_unit_id?: string | null;
  cost_center_id?: string | null;
  manager_employee_id?: string | null;
  is_active?: boolean;
}

export interface PositionResource {
  id: string;
  code: string;
  title: string;
  department_id: string | null;
  job_grade_id: string | null;
  headcount_budget: number;
  is_critical_role: boolean;
  successor_employee_id: string | null;
  readiness_level: string | null;
  is_active: boolean;
}

export interface PositionPayload {
  code: string;
  title: string;
  department_id?: string | null;
  job_grade_id?: string | null;
  reports_to_position_id?: string | null;
  headcount_budget?: number;
  is_critical_role?: boolean;
  is_active?: boolean;
}

/** Collective agreement (CCNL). The payroll resources are untyped in the OpenAPI: fields mirror the request body. */
export interface CollectiveAgreementLevelResource {
  id: string;
  level: string;
  description: string | null;
  /** Decimal string. */
  monthly_minimum: string;
}

export interface CollectiveAgreementResource {
  id: string;
  code: string;
  name: string;
  is_generic: boolean;
  weekly_hours?: string | null;
  installments?: number | null;
  fourteenth_month?: number | null;
  employer_inps_rate_percent?: string | null;
  notes?: string | null;
  levels?: CollectiveAgreementLevelResource[];
}

export interface CollectiveAgreementPayload {
  code: string;
  name: string;
  weekly_hours?: string;
  installments?: number;
  fourteenth_month?: number;
  employer_inps_rate_percent?: string | null;
  notes?: string | null;
}

export interface CollectiveAgreementLevelPayload {
  level: string;
  description?: string | null;
  /** Decimal string. */
  monthly_minimum: string;
}
