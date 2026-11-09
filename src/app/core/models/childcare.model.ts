export type ChildcareChildStatus = 'waitlist' | 'enrolled' | 'graduated' | 'withdrawn';

export interface ChildcareGroup {
  id: string;
  name: string;
  capacity?: number | null;
  enrolled_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface ChildcareGroupRequest {
  name: string;
  capacity?: number;
}

export interface ChildcareChild {
  id: string;
  group_id?: string | null;
  group_name?: string | null;
  billing_contact_id: string;
  billing_contact_name?: string | null;
  first_name: string;
  last_name: string;
  birth_date?: string | null;
  allergies?: string | null;
  dietary_notes?: string | null;
  health_notes?: string | null;
  subsidy_canton?: string | null;
  subsidy_inputs?: Record<string, unknown> | null;
  enrolled_on: string;
  left_on?: string | null;
  status: ChildcareChildStatus;
  created_at?: string;
  updated_at?: string;
}

export interface ChildcareChildRequest {
  group_id?: string;
  billing_contact_id: string;
  first_name: string;
  last_name: string;
  birth_date?: string;
  allergies?: string;
  dietary_notes?: string;
  health_notes?: string;
  subsidy_canton?: string;
  subsidy_inputs?: Record<string, unknown>;
  enrolled_on: string;
  left_on?: string;
  status?: ChildcareChildStatus;
}

export interface ChildcareAdmitRequest {
  group_id?: string;
  enrolled_on?: string;
}

export interface ChildcareReferencePerson {
  id: string;
  child_id: string;
  full_name: string;
  phone?: string | null;
  email?: string | null;
  relationship: string;
  is_guardian: boolean;
  can_pick_up: boolean;
  portal_contact_id?: string | null;
}

export interface ChildcareReferencePersonRequest {
  full_name: string;
  phone?: string;
  email?: string;
  relationship: string;
  is_guardian: boolean;
  can_pick_up: boolean;
  portal_contact_id?: string;
}

export interface ChildcareWeeklyPlan {
  id: string;
  child_id: string;
  valid_from: string;
  valid_to?: string | null;
  days: Record<string, unknown>;
}

export interface ChildcareWeeklyPlanRequest {
  valid_from: string;
  valid_to?: string;
  days: Record<string, unknown>;
}

export interface ChildcareAttendance {
  id: string;
  child_id: string;
  child_name?: string | null;
  date: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  check_in_at?: string | null;
  check_out_at?: string | null;
  picked_up_by?: string | null;
  temperature?: string | null;
  absence_reason?: string | null;
  correction_reason?: string | null;
}

export interface ChildcareCheckInRequest {
  child_id: string;
  at?: string;
  temperature?: string;
}

export interface ChildcareCheckOutRequest {
  child_id: string;
  at?: string;
  picked_up_by: string;
}

export interface ChildcareAbsenceRequest {
  child_id: string;
  date: string;
  reason?: string;
}

export interface ChildcareCorrectionRequest {
  reason: string;
  status?: string;
  absence_reason?: string;
  check_in_at?: string;
  check_out_at?: string;
  temperature?: string;
}

export interface ChildcareDailyNote {
  id: string;
  child_id: string;
  child_name?: string | null;
  date: string;
  category: 'meal' | 'nap' | 'diaper' | 'activity' | 'mood' | 'incident';
  body: string;
  visible_to_family: boolean;
  created_at?: string;
}

export interface ChildcareNoteRequest {
  child_id: string;
  date: string;
  category: string;
  body: string;
  visible_to_family?: boolean;
}

export interface ChildcareActivity {
  id: string;
  name: string;
  weekday: number;
  starts_at: string;
  ends_at: string;
  capacity?: number | null;
  monthly_fee: string;
  tax_rate: string;
  currency?: string;
}

export interface ChildcareActivityRequest {
  name: string;
  weekday: number;
  starts_at: string;
  ends_at: string;
  capacity?: number;
  monthly_fee: string;
  tax_rate: string;
}

export interface ChildcareStaffShift {
  id: string;
  user_id: string;
  user_name?: string | null;
  group_id?: string | null;
  group_name?: string | null;
  date: string;
  starts_at: string;
  ends_at: string;
  break_minutes?: number | null;
}

export interface ChildcareStaffShiftRequest {
  user_id: string;
  group_id?: string;
  date: string;
  starts_at: string;
  ends_at: string;
  break_minutes?: number;
}

export interface ChildcareFeePlan {
  id: string;
  name: string;
  basis: 'monthly' | 'daily' | 'hourly';
  amount: string;
  meal_amount?: string | null;
  tax_rate: string;
  currency: string;
}

export interface ChildcareFeePlanRequest {
  name: string;
  basis: string;
  amount: string;
  meal_amount?: string;
  tax_rate: string;
  currency: string;
}

export interface ChildcareBillingRunRequest {
  period: string;
  date?: string;
}

export interface ChildcareBill {
  id: string;
  child_id: string;
  child_name?: string | null;
  contact_id: string;
  contact_name?: string | null;
  period: string;
  gross_amount: string;
  subsidy_amount: string;
  net_amount: string;
  currency: string;
  invoice_id?: string | null;
  status: 'draft' | 'issued' | 'paid';
}

export interface ChildcareRequirement {
  id: string;
  name: string;
  requires_signature: boolean;
  is_mandatory: boolean;
}

export interface ChildcareRequirementRequest {
  name: string;
  requires_signature?: boolean;
  is_mandatory?: boolean;
}

export interface ChildcareDocument {
  id: string;
  child_id: string;
  child_name?: string | null;
  title: string;
  requirement_id?: string | null;
  requirement_name?: string | null;
  signed_at?: string | null;
  signed_by?: string | null;
  status: 'pending' | 'signed' | 'expired';
  created_at?: string;
}

export interface ChildcareParams {
  status?: string;
  group_id?: string;
  search?: string;
  page?: number;
  per_page?: number;
}
