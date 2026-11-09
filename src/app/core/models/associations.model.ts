export type AssociationMemberStatus = 'candidate' | 'active' | 'inactive' | 'ceased';

export interface AssociationMember {
  id: string;
  contact_id?: string | null;
  member_number?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  fiscal_code?: string | null;
  status: AssociationMemberStatus;
  joined_on?: string | null;
  membership_expiry?: string | null;
  has_medical_certificate?: boolean;
  medical_certificate_expiry?: string | null;
  created_at?: string;
}

export interface AssociationMemberRequest {
  contact_id?: string;
  first_name: string;
  last_name: string;
  email?: string;
  fiscal_code?: string;
  joined_on: string;
  member_number?: string;
}

export interface AssociationFeeAssignment {
  id: string;
  member_id: string;
  member_name?: string;
  fee_type: string;
  year: number;
  amount: string;
  due_date: string;
  status: 'pending' | 'paid' | 'cancelled';
  paid_at?: string | null;
}

export interface AssociationFeeAssignmentRequest {
  member_id: string;
  fee_type: string;
  year: number;
  amount: string;
  due_date: string;
}

export interface AssociationCourse {
  id: string;
  name: string;
  discipline?: string;
  instructor_name?: string;
  max_participants?: number;
  enrolled_count?: number;
  status: 'active' | 'completed' | 'cancelled';
  season?: string;
}

export interface AssociationCourseRequest {
  name: string;
  discipline?: string;
  max_participants?: number;
  season?: string;
}

export interface AssociationDonation {
  id: string;
  donor_name: string;
  fiscal_code?: string | null;
  amount: string;
  currency: string;
  donation_date: string;
  is_cash: boolean;
  receipt_number?: string | null;
  notes?: string | null;
}

export interface AssociationDonationRequest {
  donor_name: string;
  fiscal_code?: string;
  amount: string;
  currency?: string;
  donation_date: string;
  is_cash?: boolean;
  notes?: string;
}

export interface AssociationMeeting {
  id: string;
  title: string;
  meeting_type: 'ordinary' | 'extraordinary' | 'board';
  meeting_date: string;
  location?: string;
  is_convoked: boolean;
  has_quorum?: boolean;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
}

export interface AssociationMeetingRequest {
  title: string;
  meeting_type: 'ordinary' | 'extraordinary' | 'board';
  meeting_date: string;
  location?: string;
}

export interface AssociationVolunteer {
  id: string;
  member_id: string;
  name: string;
  insurance_policy_number?: string;
  insurance_expiry?: string;
  is_registered_in_runts_book: boolean;
  reimbursements_total?: string;
}

export interface AssociationReimbursement {
  id: string;
  volunteer_id: string;
  volunteer_name?: string;
  amount: string;
  description: string;
  expense_date: string;
  status: 'pending' | 'approved' | 'rejected' | 'paid';
  paid_at?: string | null;
}

export interface AssociationMemberParams {
  status?: AssociationMemberStatus;
  search?: string;
  medical_certificate_expired?: boolean;
  page?: number;
  per_page?: number;
}

export interface AssociationFeeParams {
  year?: number;
  status?: 'pending' | 'paid' | 'cancelled';
  member_id?: string;
  page?: number;
  per_page?: number;
}

export interface AssociationCourseParams {
  season?: string;
  status?: 'active' | 'completed' | 'cancelled';
  page?: number;
  per_page?: number;
}

export interface AssociationDonationParams {
  year?: number;
  page?: number;
  per_page?: number;
}
