/** Employee portal (`/hr/me/*`): only the employee linked to the logged-in user. */

export interface SelfServiceProfile {
  id: string;
  employee_number: string;
  full_name: string;
  work_email: string;
  department_id: string | null;
  position_id: string | null;
  manager_id: string | null;
  employment_status: string;
  employment_type: string;
  hire_date: string | null;
  /** Decimal string. */
  fte_ratio: string;
}

/** Hours are decimal strings. */
export interface SelfServiceLeaveBalance {
  id: string;
  employee_id: string;
  leave_type_id: string;
  fiscal_year: number;
  entitlement_hours: string;
  carryover_hours: string;
  accrued_hours: string;
  used_hours: string;
  pending_hours: string;
  available_hours: string;
}

export interface SelfServiceLeaveRequest {
  id: string;
  request_number: string;
  employee_id: string;
  leave_type_id: string;
  start_date: string;
  end_date: string;
  total_hours: string;
  total_days: string;
  status: string;
  is_locked: boolean;
  reason: string | null;
  approved_at: string | null;
}

export interface SubmitSelfServiceLeaveRequestPayload {
  leave_type_id: string;
  /** Y-m-d. */
  start_date: string;
  /** Y-m-d. */
  end_date: string;
  /** Decimal string. */
  total_hours: string;
  reason?: string | null;
  medical_certificate_ref?: string | null;
}

export interface SelfServiceTrainingRecord {
  id: string;
  course_code: string;
  course_title: string;
  category: string;
  status: string;
  assigned_date: string | null;
  scheduled_date: string | null;
  completed_date: string | null;
}

export interface SelfServiceCertification {
  id: string;
  code: string;
  name: string;
  issue_date: string | null;
  expiry_date: string | null;
  status: string;
}

export interface SelfServiceTraining {
  training_records: SelfServiceTrainingRecord[];
  certifications: SelfServiceCertification[];
}

export interface EmployeeDocumentResource {
  id: string;
  employee_id: string;
  document_type: string;
  title: string;
  original_name: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  issue_date: string | null;
  expiry_date: string | null;
  retention_until: string | null;
  contains_health_data: boolean;
  is_confidential: boolean;
  visible_to_employee: boolean;
  status: string;
  created_at: string | null;
}

export type LeaveCategory =
  | 'vacation'
  | 'sick'
  | 'maternity'
  | 'paternity'
  | 'parental'
  | 'unpaid'
  | 'rol'
  | 'study'
  | 'bereavement'
  | 'military'
  | 'accident'
  | 'other';

export type LeaveAccrualFrequency = 'monthly' | 'yearly' | 'none';

export interface LeaveTypeResource {
  id: string;
  tenant_id: string;
  company_id: string | null;
  code: string;
  name: string;
  category: LeaveCategory;
  is_paid: boolean;
  requires_approval: boolean;
  requires_attachment: boolean;
  annual_entitlement_hours: string;
  accrual_frequency: LeaveAccrualFrequency;
  max_carryover_hours: string;
  is_active: boolean;
  translations: unknown[] | null;
  created_at: string | null;
  updated_at: string | null;
  deleted_at: string | null;
}

export interface LeaveTypePayload {
  code: string;
  name: string;
  category: LeaveCategory;
  is_paid?: boolean;
  requires_approval?: boolean;
  requires_attachment?: boolean;
  /** Decimal string. */
  annual_entitlement_hours: string;
  accrual_frequency?: LeaveAccrualFrequency;
  /** Decimal string. */
  max_carryover_hours?: string;
  is_active?: boolean;
}

/** Absence type as the employee portal sees it (`GET /hr/me/leave-types`). */
export interface SelfServiceLeaveType {
  id: string;
  code: string;
  name: string;
  category: string;
  is_paid: boolean;
  requires_approval: boolean;
  requires_attachment: boolean;
  is_active: boolean;
  translations: unknown[] | null;
}
