/** Member area (token of the personal link) and public enrolment form of an association. */

export type AssociationAreaMemberStatus = 'candidate' | 'active' | 'inactive' | 'ceased';

export interface AssociationAreaProfile {
  id: string;
  status: AssociationAreaMemberStatus;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  is_minor: boolean;
  birth_date: string | null;
  birth_place: string | null;
  tax_code: string | null;
  allergies: string | null;
  emergency_contact: string | null;
  custom_fields: unknown[];
}

export interface AssociationAreaMe {
  roles: unknown[];
  contact: {
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    phone: string | null;
  };
  profile: AssociationAreaProfile | null;
  wards: AssociationAreaProfile[];
}

export interface AssociationAreaContactRequest {
  email?: string;
  phone?: string | null;
  address?: {
    street?: string;
    house_number?: string | null;
    postal_code?: string;
    city?: string;
    state_canton?: string | null;
  };
}

export interface AssociationAreaContact {
  email: string | null;
  phone: string | null;
}

export type AssociationMembershipStatus = 'pending' | 'active' | 'suspended' | 'expired' | 'ceased' | 'rejected';

export interface AssociationAreaCard {
  membership_id: string | null;
  card_number: string | null;
  status: AssociationMembershipStatus | null;
  valid_to: string | null;
  qr: string | null;
}

export interface AssociationAreaInstalment {
  id: string;
  sequence: number;
  due_on: string;
  amount: string;
  paid_amount: string;
  status: string;
}

export interface AssociationAreaFeeAssignment {
  id: string;
  member_id: string;
  description: string;
  starts_on: string;
  ends_on: string | null;
  gross_amount: string;
  discount_amount: string;
  net_amount: string;
  lessons_total: number | null;
  lessons_remaining: number | null;
  status: string;
  /** Loaded by the API with the assignment (not described by the OpenAPI schema). */
  instalments?: AssociationAreaInstalment[];
}

export interface AssociationAreaFees {
  standing: 'settled' | 'attention' | 'overdue';
  color: 'green' | 'orange' | 'red';
  assignments: AssociationAreaFeeAssignment[];
}

export interface AssociationAreaPaymentLink {
  url: string;
  amount: string;
  expires_at: string | null;
}

export interface AssociationAreaCalendarEntry {
  course_id: string;
  title: string;
  date: string;
  starts_at: string;
  ends_at: string;
  resource_id: string | null;
  suspended: boolean;
}

/** Receipts, documents and authorizations come as free records: the schema does not describe them. */
export type AssociationAreaRecord = Record<string, unknown>;

export interface AssociationAreaInstructorCourse {
  id: string;
  title: string;
  kind: 'recurring' | 'event' | 'big_event';
  starts_on: string;
  ends_on: string | null;
}

export interface AssociationAreaParticipant {
  member_id: string;
  name: string;
}

export interface AssociationAttendanceEntry {
  member_id: string;
  status: 'present' | 'absent';
}

export interface AssociationAttendanceRequest {
  date: string;
  entries: AssociationAttendanceEntry[];
}

export type AssociationApplicationStatus = 'submitted' | 'pending_board' | 'approved' | 'rejected';

export interface AssociationPublicFormField {
  code: string;
  label: string;
  type?: 'text' | 'number' | 'date' | 'boolean' | 'select';
  required?: boolean;
  options?: string[];
}

export interface AssociationPublicFormDocument {
  id: string;
  title: string;
  mode: 'required' | 'optional' | 'download_only';
  has_template: boolean;
}

export interface AssociationPublicForm {
  association: string;
  title: string;
  description: string | null;
  is_open: boolean;
  fields: AssociationPublicFormField[];
  documents: AssociationPublicFormDocument[];
}

export interface AssociationPublicSubmission {
  tracking_code: string;
  received: boolean;
}
