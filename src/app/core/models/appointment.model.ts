import { QueryFilterParams } from './api.models';

export interface AppointmentAttendee {
  id?: string;
  user_id: string;
  role?: 'lead' | 'technician' | 'assistant';
  is_organizer?: boolean;
  status?: 'accepted' | 'pending' | 'declined';
  user?: {
    id: string;
    name: string;
    email: string;
  };
}

export interface AppointmentStatus {
  id?: string;
  code: string;
  label: string;
}

export interface Appointment {
  id: string;
  appointment_number?: string;
  title: string;
  description?: string;
  status?: AppointmentStatus | string;
  contact?: {
    id: string;
    name: string;
    email?: string;
    phone?: string;
  };
  contact_id?: string;
  ticket?: {
    id: string;
    subject?: string;
    priority?: string;
    status?: string;
  };
  ticket_id?: string | null;
  service_report_id?: string | null;
  starts_at: string;
  ends_at: string;
  all_day?: boolean;
  address?: string;
  latitude?: string | null;
  longitude?: string | null;
  estimated_travel_minutes?: number | null;
  estimated_duration_minutes?: number | null;
  technician_notes?: string | null;
  customer_notes?: string | null;
  is_portal_visible?: boolean;
  reminder_sent_at?: string | null;
  confirmed_at?: string | null;
  cancelled_at?: string | null;
  cancellation_reason?: string | null;
  attendees?: AppointmentAttendee[];
  created_at?: string;
  updated_at?: string;
}

export interface CreateAppointmentRequest {
  title: string;
  starts_at: string;
  ends_at: string;
  contact_id?: string;
  ticket_id?: string;
  description?: string;
  all_day?: boolean;
  address?: string;
  estimated_duration_minutes?: number;
  attendees?: {
    user_id: string;
    role?: 'lead' | 'technician' | 'assistant';
    is_organizer?: boolean;
  }[];
}

export interface UpdateAppointmentRequest {
  title?: string;
  starts_at?: string;
  ends_at?: string;
  contact_id?: string;
  ticket_id?: string | null;
  status_id?: string;
  description?: string | null;
  all_day?: boolean | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  estimated_travel_minutes?: number | null;
  estimated_duration_minutes?: number | null;
  technician_notes?: string | null;
  customer_notes?: string | null;
  is_portal_visible?: boolean | null;
  allow_conflicts?: boolean | null;
  attendees?: {
    user_id: string;
    role?: 'lead' | 'technician' | 'assistant';
    is_organizer?: boolean;
    status?: 'accepted' | 'pending' | 'declined';
  }[] | null;
}

export interface AppointmentConflictCheckRequest {
  starts_at: string;
  ends_at: string;
  user_ids: string[];
  ignore_appointment_id?: string;
}

export interface AppointmentConflictCheckResponse {
  has_conflicts: boolean;
  conflicting_appointments?: Appointment[];
}

export interface AppointmentCalendarItem {
  id: string;
  title: string;
  start: string;
  end: string;
  all_day?: boolean;
  status?: string;
  technician_name?: string;
  contact_name?: string;
}

export interface CancelAppointmentRequest {
  reason: string;
}

/** Filters of the appointments list (the grid adds sorting, column filters and paging). */
export interface AppointmentFilterParams extends QueryFilterParams {
  technician_id?: string;
  contact_id?: string;
  ticket_id?: string;
  status_id?: string;
  date?: string;
}
