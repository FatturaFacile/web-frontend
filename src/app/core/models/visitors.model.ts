export type VisitStatus = 'expected' | 'checked_in' | 'checked_out' | 'cancelled';

export interface VisitorsVisitor {
  id: string;
  contact_id?: string | null;
  first_name: string;
  last_name: string;
  full_name: string;
  company_name?: string | null;
  email?: string | null;
  phone?: string | null;
  has_document: boolean;
  last_visit_at?: string | null;
  created_at: string;
}

export interface VisitorsVisitorRequest {
  contact_id?: string | null;
  first_name: string;
  last_name: string;
  company_name?: string | null;
  email?: string | null;
  phone?: string | null;
  document_number?: string | null;
}

export interface VisitorsHostInfo {
  id: string;
  name: string;
}

export interface VisitorsVisit {
  id: string;
  visitor_id: string;
  visitor?: VisitorsVisitor | null;
  host_user_id?: string | null;
  host?: VisitorsHostInfo | null;
  expected_at: string;
  expected_until?: string | null;
  purpose?: string | null;
  status: VisitStatus;
  badge_number?: string | null;
  checked_in_at?: string | null;
  checked_out_at?: string | null;
  kiosk_id?: string | null;
  host_notified_at?: string | null;
}

export interface VisitorsVisitRequest {
  visitor_id?: string | null;
  visitor?: VisitorsVisitorRequest | null;
  host_user_id: string;
  expected_at: string;
  expected_until?: string | null;
  purpose?: string | null;
}

export interface VisitorsCheckInRequest {
  badge_number: string;
}

export interface VisitorsKiosk {
  id: string;
  name: string;
  device_key: string;
  is_active: boolean;
  last_seen_at?: string | null;
  created_at: string;
  secret?: string;
}

export interface VisitorsKioskRequest {
  name: string;
}

export interface VisitorsKioskVisit {
  id: string;
  visitor_name: string;
  host_name?: string | null;
  expected_at: string;
  status: string;
  badge_number?: string | null;
  checked_in_at?: string | null;
  checked_out_at?: string | null;
}

export interface VisitorsKioskCheckInRequest {
  visit_id?: string | null;
  visitor?: {
    first_name: string;
    last_name: string;
    company_name?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;
  host_user_id?: string | null;
  purpose?: string | null;
  badge_number: string;
}

export interface VisitorsKioskCheckOutRequest {
  badge_number: string;
}
