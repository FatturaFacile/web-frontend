export type AssociationMemberStatus = 'candidate' | 'active' | 'inactive' | 'ceased';

export interface AssociationMember {
  id: string;
  contact_id?: string | null;
  member_number?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  company_name?: string | null;
  email?: string | null;
  tax_code?: string | null;
  status: AssociationMemberStatus;
  joined_on?: string | null;
  membership_expiry?: string | null;
  has_medical_certificate?: boolean;
  medical_certificate_expiry?: string | null;
  created_at?: string;
}

/** Body of `POST /associations/members` (SaveMemberRequest). */
export interface AssociationMemberRequest {
  contact_id?: string;
  first_name?: string;
  last_name?: string;
  email?: string | null;
  tax_code?: string;
  joined_on?: string | null;
}

/** Contact of the member a row belongs to, as embedded by the fee and reimbursement lists. */
export interface AssociationRowMember {
  contact?: { first_name?: string | null; last_name?: string | null; company_name?: string | null } | null;
}

export type AssociationFeeAssignmentStatus = 'active' | 'cancelled' | string;

export interface AssociationFeeInstalment {
  id: string;
  sequence: number;
  due_on: string;
  amount: string;
  paid_amount: string;
  status: 'open' | 'paid' | string;
}

export interface AssociationFeeAssignment {
  id: string;
  member_id: string;
  fee_plan_id?: string | null;
  description?: string;
  starts_on: string;
  ends_on?: string | null;
  net_amount: string;
  status: AssociationFeeAssignmentStatus;
  instalments?: AssociationFeeInstalment[];
  /** Embedded by the list endpoint, so the grid shows the name of every row, not only of the loaded registry page. */
  member?: AssociationRowMember | null;
}

/** Body of `POST /associations/fee-assignments` (AssignFeeRequest). */
export interface AssociationFeeAssignmentRequest {
  member_id: string;
  fee_plan_id: string;
  starts_on?: string | null;
  ends_on?: string | null;
}

export interface AssociationFeePlan {
  id: string;
  name: string;
  amount?: string;
}

/** Payment methods accepted by `POST /associations/instalments/{id}/payments` (PaymentMethod enum). */
export type AssociationPaymentMethod = 'cash' | 'bank_transfer' | 'card' | 'online' | 'cheque';

/** Body of `POST /associations/instalments/{id}/payments` (RecordPaymentRequest). */
export interface AssociationPaymentRequest {
  amount: string;
  paid_on: string;
  method: AssociationPaymentMethod;
}

export interface AssociationCourse {
  id: string;
  title: string;
  kind?: 'recurring' | 'event' | 'big_event';
  starts_on?: string | null;
  ends_on?: string | null;
  capacity?: number | null;
  enrolled_count?: number;
  status: 'active' | 'cancelled' | 'ended';
}

/** Body of `POST /associations/courses` (SaveCourseRequest). */
export interface AssociationCourseRequest {
  title: string;
  starts_on: string;
  ends_on?: string | null;
  capacity?: number | null;
}

export type AssociationDonationKind = 'money' | 'in_kind';

export interface AssociationDonation {
  id: string;
  kind: AssociationDonationKind;
  amount: string;
  received_on: string;
  payment_method?: 'cash' | 'bank' | null;
  in_kind_description?: string | null;
  purpose?: string | null;
  receipts?: { id: string; number?: string | null }[];
}

/** Body of `POST /associations/donations` (RecordDonationRequest). */
export interface AssociationDonationRequest {
  kind: AssociationDonationKind;
  amount: string;
  received_on: string;
  payment_method?: 'cash' | 'bank' | null;
  in_kind_description?: string | null;
  purpose?: string | null;
}

export type AssociationMeetingBody = 'assembly' | 'board' | 'other';

export interface AssociationMeeting {
  id: string;
  body: AssociationMeetingBody;
  body_name?: string | null;
  title: string;
  scheduled_at?: string | null;
  second_call_at?: string | null;
  location?: string | null;
  status: string;
}

/** Body of `POST /associations/meetings` (SaveMeetingRequest). */
export interface AssociationMeetingRequest {
  body: AssociationMeetingBody;
  body_name?: string | null;
  title: string;
  scheduled_at?: string | null;
  second_call_at?: string | null;
  location?: string | null;
}

export interface AssociationVolunteer {
  id: string;
  member_id: string;
  activity?: string;
  started_on?: string;
  insurance_expires_on?: string | null;
  member?: { contact?: { first_name?: string | null; last_name?: string | null } | null } | null;
}

export type AssociationReimbursementKind = 'mileage' | 'expense';

export interface AssociationReimbursement {
  id: string;
  member_id: string;
  kind?: AssociationReimbursementKind;
  amount: string;
  description: string;
  incurred_on: string;
  status: 'submitted' | 'approved' | 'rejected' | 'paid' | string;
  member?: AssociationRowMember | null;
}

/** Body of `POST /associations/reimbursements` (StoreReimbursementRequest). */
export interface AssociationReimbursementRequest {
  member_id: string;
  kind: AssociationReimbursementKind;
  incurred_on: string;
  description: string;
  amount?: string | null;
  vehicle?: string | null;
  plate?: string | null;
  distance_km?: string | null;
  unit_price?: string | null;
}

export interface AssociationMemberParams {
  status?: AssociationMemberStatus;
  search?: string;
  medical_certificate_expired?: boolean;
  page?: number;
  per_page?: number;
}

export interface AssociationFeeParams {
  status?: string;
  member_id?: string;
  page?: number;
  per_page?: number;
}

export interface AssociationCourseParams {
  status?: 'active' | 'cancelled' | 'ended';
  page?: number;
  per_page?: number;
}

export interface AssociationDonationParams {
  year?: number;
  page?: number;
  per_page?: number;
}

export interface AssociationReimbursementParams {
  year?: number;
  status?: string;
  member_id?: string;
  page?: number;
  per_page?: number;
}

export interface AssociationMeetingParams {
  body?: AssociationMeetingBody;
  status?: string;
  page?: number;
  per_page?: number;
}
