/** Event management. Mirrors the API FormRequests and resources of the Events module. */

export type ManagedEventStatus = 'draft' | 'published' | 'closed' | 'cancelled';
export type EventRegistrationStatus = 'confirmed' | 'waitlisted' | 'cancelled';

export const MANAGED_EVENT_STATUSES: readonly ManagedEventStatus[] = ['draft', 'published', 'closed', 'cancelled'];
export const EVENT_REGISTRATION_STATUSES: readonly EventRegistrationStatus[] = ['confirmed', 'waitlisted', 'cancelled'];

/** Timestamps travel as `Y-m-d H:i:s`. */
export interface ManagedEvent {
  id: string;
  code: string;
  name: string;
  description: string | null;
  venue: string | null;
  starts_at: string;
  ends_at: string;
  status: ManagedEventStatus;
  capacity: number | null;
  waitlist_enabled: boolean;
  currency: string;
  notes: string | null;
  confirmed_count?: number;
  waitlisted_count?: number;
  sessions?: EventSession[];
  ticket_types?: EventTicketType[];
}

export interface ManagedEventRequest {
  code: string;
  name: string;
  description?: string | null;
  venue?: string | null;
  starts_at: string;
  ends_at: string;
  capacity?: number | null;
  waitlist_enabled?: boolean;
  currency?: string;
  notes?: string | null;
}

export interface ManagedEventFilters {
  status?: ManagedEventStatus;
  from?: string;
  to?: string;
  search?: string;
  per_page?: number;
}

export interface EventSession {
  id: string;
  event_id: string;
  title: string;
  speaker: string | null;
  room: string | null;
  starts_at: string;
  ends_at: string;
  description: string | null;
}

export interface EventSessionRequest {
  event_id?: string;
  title: string;
  speaker?: string | null;
  room?: string | null;
  starts_at: string;
  ends_at: string;
  description?: string | null;
}

export interface EventTicketType {
  id: string;
  event_id: string;
  name: string;
  price: string;
  quantity: number | null;
  is_active: boolean;
  sold_count?: number;
}

export interface EventTicketTypeRequest {
  event_id?: string;
  name: string;
  price: string;
  quantity?: number | null;
  is_active?: boolean;
}

export interface EventRegistration {
  id: string;
  event_id: string;
  event?: { id: string; code: string; name: string } | null;
  ticket_type_id: string;
  ticket_type?: { id: string; name: string } | null;
  contact_id: string | null;
  attendee_name: string;
  attendee_email: string | null;
  status: EventRegistrationStatus;
  qr_token: string;
  price: string;
  registered_at: string;
  paid_at: string | null;
  checked_in_at: string | null;
  cancelled_at: string | null;
  notes: string | null;
}

export interface EventRegistrationRequest {
  event_id?: string;
  ticket_type_id?: string;
  contact_id?: string | null;
  attendee_name: string;
  attendee_email?: string | null;
  notes?: string | null;
}

export interface EventRegistrationFilters {
  event_id?: string;
  status?: EventRegistrationStatus;
  checked_in?: boolean;
  search?: string;
  per_page?: number;
}

export interface EventRegistrationQr {
  qr_token: string;
  data_uri: string;
}

export interface EventCheckInRequest {
  qr_token: string;
  event_id?: string | null;
}

export interface ManagedEventReport {
  event_id: string;
  currency: string;
  capacity: number | null;
  confirmed: number;
  waitlisted: number;
  cancelled: number;
  checked_in: number;
  no_show: number;
  occupancy_percent: string | null;
  expected_revenue: string;
  collected_revenue: string;
  outstanding_revenue: string;
  by_ticket_type: {
    ticket_type_id: string;
    name: string;
    price: string;
    quantity: number | null;
    sold: number;
    waitlisted: number;
    expected_revenue: string;
    collected_revenue: string;
  }[];
}

/** The API wraps every record or list in `data`; lists that paginate add the Laravel `meta`. */
export interface EventsResponse<T> {
  data: T;
  meta?: { current_page: number; last_page: number; per_page: number; total: number };
}
