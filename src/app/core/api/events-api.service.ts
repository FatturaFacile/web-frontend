import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import {
  EventCheckInRequest,
  EventRegistration,
  EventRegistrationFilters,
  EventRegistrationQr,
  EventRegistrationRequest,
  EventSession,
  EventSessionRequest,
  EventsResponse,
  EventTicketType,
  EventTicketTypeRequest,
  ManagedEvent,
  ManagedEventFilters,
  ManagedEventReport,
  ManagedEventRequest,
} from '../models';

@Service()
export class EventsApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/events`;

  // Events
  getEvents(filters?: ManagedEventFilters): Observable<EventsResponse<ManagedEvent[]>> {
    return this.http.get<EventsResponse<ManagedEvent[]>>(this.base, { params: this.params(filters) });
  }

  getEvent(id: string): Observable<EventsResponse<ManagedEvent>> {
    return this.http.get<EventsResponse<ManagedEvent>>(`${this.base}/${id}`);
  }

  createEvent(payload: ManagedEventRequest): Observable<EventsResponse<ManagedEvent>> {
    return this.http.post<EventsResponse<ManagedEvent>>(this.base, payload);
  }

  updateEvent(id: string, payload: Partial<ManagedEventRequest>): Observable<EventsResponse<ManagedEvent>> {
    return this.http.put<EventsResponse<ManagedEvent>>(`${this.base}/${id}`, payload);
  }

  deleteEvent(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  publishEvent(id: string): Observable<EventsResponse<ManagedEvent>> {
    return this.http.post<EventsResponse<ManagedEvent>>(`${this.base}/${id}/publish`, {});
  }

  closeEvent(id: string): Observable<EventsResponse<ManagedEvent>> {
    return this.http.post<EventsResponse<ManagedEvent>>(`${this.base}/${id}/close`, {});
  }

  cancelEvent(id: string): Observable<EventsResponse<ManagedEvent>> {
    return this.http.post<EventsResponse<ManagedEvent>>(`${this.base}/${id}/cancel`, {});
  }

  getReport(id: string): Observable<EventsResponse<ManagedEventReport>> {
    return this.http.get<EventsResponse<ManagedEventReport>>(`${this.base}/${id}/report`);
  }

  // Sessions
  getSessions(filters?: { event_id?: string; per_page?: number }): Observable<EventsResponse<EventSession[]>> {
    return this.http.get<EventsResponse<EventSession[]>>(`${this.base}/sessions`, { params: this.params(filters) });
  }

  createSession(payload: EventSessionRequest): Observable<EventsResponse<EventSession>> {
    return this.http.post<EventsResponse<EventSession>>(`${this.base}/sessions`, payload);
  }

  updateSession(id: string, payload: Partial<EventSessionRequest>): Observable<EventsResponse<EventSession>> {
    return this.http.put<EventsResponse<EventSession>>(`${this.base}/sessions/${id}`, payload);
  }

  deleteSession(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/sessions/${id}`);
  }

  // Ticket types
  getTicketTypes(filters?: { event_id?: string; per_page?: number }): Observable<EventsResponse<EventTicketType[]>> {
    return this.http.get<EventsResponse<EventTicketType[]>>(`${this.base}/ticket-types`, { params: this.params(filters) });
  }

  createTicketType(payload: EventTicketTypeRequest): Observable<EventsResponse<EventTicketType>> {
    return this.http.post<EventsResponse<EventTicketType>>(`${this.base}/ticket-types`, payload);
  }

  updateTicketType(id: string, payload: Partial<EventTicketTypeRequest>): Observable<EventsResponse<EventTicketType>> {
    return this.http.put<EventsResponse<EventTicketType>>(`${this.base}/ticket-types/${id}`, payload);
  }

  deleteTicketType(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/ticket-types/${id}`);
  }

  // Registrations
  getRegistration(id: string): Observable<EventsResponse<EventRegistration>> {
    return this.http.get<EventsResponse<EventRegistration>>(`${this.base}/registrations/${id}`);
  }

  getRegistrations(filters?: EventRegistrationFilters): Observable<EventsResponse<EventRegistration[]>> {
    return this.http.get<EventsResponse<EventRegistration[]>>(`${this.base}/registrations`, { params: this.params(filters) });
  }

  createRegistration(payload: EventRegistrationRequest): Observable<EventsResponse<EventRegistration>> {
    return this.http.post<EventsResponse<EventRegistration>>(`${this.base}/registrations`, payload);
  }

  updateRegistration(id: string, payload: Partial<EventRegistrationRequest>): Observable<EventsResponse<EventRegistration>> {
    return this.http.put<EventsResponse<EventRegistration>>(`${this.base}/registrations/${id}`, payload);
  }

  cancelRegistration(id: string): Observable<EventsResponse<EventRegistration>> {
    return this.http.post<EventsResponse<EventRegistration>>(`${this.base}/registrations/${id}/cancel`, {});
  }

  payRegistration(id: string): Observable<EventsResponse<EventRegistration>> {
    return this.http.post<EventsResponse<EventRegistration>>(`${this.base}/registrations/${id}/pay`, {});
  }

  getRegistrationQr(id: string): Observable<EventsResponse<EventRegistrationQr>> {
    return this.http.get<EventsResponse<EventRegistrationQr>>(`${this.base}/registrations/${id}/qr`);
  }

  checkIn(payload: EventCheckInRequest): Observable<EventsResponse<EventRegistration>> {
    return this.http.post<EventsResponse<EventRegistration>>(`${this.base}/check-in`, payload);
  }

  private params(values?: object): HttpParams {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(values ?? {})) {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, typeof value === 'boolean' ? (value ? '1' : '0') : String(value));
      }
    }
    return params;
  }
}
