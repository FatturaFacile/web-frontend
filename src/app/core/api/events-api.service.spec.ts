import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EventsApiService } from './events-api.service';

describe('EventsApiService', () => {
  let service: EventsApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [EventsApiService, provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(EventsApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('lists events with the filters and skips the empty ones', () => {
    service.getEvents({ status: 'published', search: undefined, per_page: 100 }).subscribe();

    const request = httpMock.expectOne((r) => r.url.endsWith('/events') && r.params.get('status') === 'published' && r.params.get('per_page') === '100' && !r.params.has('search'));
    expect(request.request.method).toBe('GET');
    request.flush({ data: [] });
  });

  it('creates an event and moves it through publish, close and cancel', () => {
    service.createEvent({ code: 'EV-1', name: 'Conf', starts_at: '2027-09-10 09:00:00', ends_at: '2027-09-10 18:00:00' }).subscribe();
    const create = httpMock.expectOne((r) => r.url.endsWith('/events') && r.method === 'POST');
    expect(create.request.body).toEqual({ code: 'EV-1', name: 'Conf', starts_at: '2027-09-10 09:00:00', ends_at: '2027-09-10 18:00:00' });
    create.flush({ data: {} });

    for (const [call, path] of [
      [service.publishEvent('ev-1'), 'publish'],
      [service.closeEvent('ev-1'), 'close'],
      [service.cancelEvent('ev-1'), 'cancel'],
    ] as const) {
      call.subscribe();
      httpMock.expectOne((r) => r.url.endsWith(`/events/ev-1/${path}`) && r.method === 'POST').flush({ data: {} });
    }

    service.getReport('ev-1').subscribe();
    httpMock.expectOne((r) => r.url.endsWith('/events/ev-1/report')).flush({ data: {} });
  });

  it('manages sessions and ticket types through the flat endpoints', () => {
    service.createSession({ event_id: 'ev-1', title: 'Keynote', starts_at: '2027-09-10 10:00:00', ends_at: '2027-09-10 11:00:00' }).subscribe();
    httpMock.expectOne((r) => r.url.endsWith('/events/sessions') && r.method === 'POST').flush({ data: {} });

    service.getTicketTypes({ event_id: 'ev-1' }).subscribe();
    httpMock.expectOne((r) => r.url.endsWith('/events/ticket-types') && r.params.get('event_id') === 'ev-1').flush({ data: [] });

    service.updateTicketType('tk-1', { is_active: false }).subscribe();
    const update = httpMock.expectOne((r) => r.url.endsWith('/events/ticket-types/tk-1') && r.method === 'PUT');
    expect(update.request.body).toEqual({ is_active: false });
    update.flush({ data: {} });

    service.deleteSession('se-1').subscribe();
    httpMock.expectOne((r) => r.url.endsWith('/events/sessions/se-1') && r.method === 'DELETE').flush(null);
  });

  it('registers, pays, cancels, reads the QR code and checks in', () => {
    service.createRegistration({ event_id: 'ev-1', ticket_type_id: 'tk-1', attendee_name: 'Anna' }).subscribe();
    httpMock.expectOne((r) => r.url.endsWith('/events/registrations') && r.method === 'POST').flush({ data: {} });

    service.getRegistrations({ event_id: 'ev-1', checked_in: true }).subscribe();
    httpMock.expectOne((r) => r.url.endsWith('/events/registrations') && r.params.get('checked_in') === '1').flush({ data: [] });

    service.payRegistration('rg-1').subscribe();
    httpMock.expectOne((r) => r.url.endsWith('/registrations/rg-1/pay') && r.method === 'POST').flush({ data: {} });

    service.cancelRegistration('rg-1').subscribe();
    httpMock.expectOne((r) => r.url.endsWith('/registrations/rg-1/cancel') && r.method === 'POST').flush({ data: {} });

    service.getRegistrationQr('rg-1').subscribe();
    httpMock.expectOne((r) => r.url.endsWith('/registrations/rg-1/qr')).flush({ data: {} });

    service.checkIn({ qr_token: 'tok', event_id: null }).subscribe();
    const checkIn = httpMock.expectOne((r) => r.url.endsWith('/events/check-in') && r.method === 'POST');
    expect(checkIn.request.body).toEqual({ qr_token: 'tok', event_id: null });
    checkIn.flush({ data: {} });
  });
});
