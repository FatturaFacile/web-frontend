import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NzMessageService } from 'ng-zorro-antd/message';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { icons } from '../../icons-provider';
import { EventRegistration, EventsApiService, ManagedEvent, TranslateService } from '@core';
import { EventDetailComponent } from './event-detail.component';
import { EventsCheckinComponent } from './events-checkin.component';
import { EventsListComponent } from './events-list.component';
import { apiErrorText, blankToNull, toApiDateTime, toInputDateTime } from './events.util';

const event: ManagedEvent = {
  id: 'ev-1',
  code: 'EV-1',
  name: 'Annual conference',
  description: null,
  venue: 'Milano',
  starts_at: '2027-09-10 09:00:00',
  ends_at: '2027-09-10 18:00:00',
  status: 'published',
  capacity: 2,
  waitlist_enabled: true,
  currency: 'EUR',
  notes: null,
  confirmed_count: 1,
  waitlisted_count: 0,
  sessions: [],
  ticket_types: [{ id: 'tk-1', event_id: 'ev-1', name: 'Standard', price: '50.00', quantity: null, is_active: true, sold_count: 1 }],
};

const registration: EventRegistration = {
  id: 'rg-1',
  event_id: 'ev-1',
  event: { id: 'ev-1', code: 'EV-1', name: 'Annual conference' },
  ticket_type_id: 'tk-1',
  ticket_type: { id: 'tk-1', name: 'Standard' },
  contact_id: null,
  attendee_name: 'Anna',
  attendee_email: null,
  status: 'confirmed',
  qr_token: 'tok',
  price: '50.00',
  registered_at: '2027-06-15 09:00:00',
  paid_at: null,
  checked_in_at: null,
  cancelled_at: null,
  notes: null,
};

const messageSpy = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() };
const translateSpy = { instant: vi.fn().mockImplementation((key: string) => key), translate: vi.fn().mockImplementation((key: string) => key) };

function configure(api: Record<string, unknown>): void {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: EventsApiService, useValue: api },
      { provide: NzMessageService, useValue: messageSpy },
      { provide: TranslateService, useValue: translateSpy },
      { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: 'ev-1' }) } } },
      provideNzIcons(icons),
    ],
  });
}

describe('events util', () => {
  it('reads the first validation message of a 422', () => {
    expect(apiErrorText(new HttpErrorResponse({ status: 422, error: { errors: { qr_token: ['Already checked in'] } } }))).toBe('Already checked in');
    expect(apiErrorText(new Error('boom'))).toBeNull();
  });

  it('converts blanks and the datetime-local format', () => {
    expect(blankToNull('  ')).toBeNull();
    expect(toApiDateTime('2027-09-10T09:00')).toBe('2027-09-10 09:00:00');
    expect(toInputDateTime('2027-09-10 09:00:00')).toBe('2027-09-10T09:00');
  });
});

describe('EventsListComponent', () => {
  const api = { getEvents: vi.fn(), createEvent: vi.fn(), updateEvent: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    api.getEvents.mockReturnValue(of({ data: [event] }));
    api.createEvent.mockReturnValue(of({ data: event }));
    configure(api);
  });

  it('lists the events and filters by status', () => {
    const fixture = TestBed.createComponent(EventsListComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.events()).toEqual([event]);

    fixture.componentInstance.statusFilter.set('draft');
    fixture.componentInstance.load();
    expect(api.getEvents).toHaveBeenLastCalledWith({ status: 'draft', per_page: 100 });
  });

  it('creates an event with the API timestamp format', () => {
    const fixture = TestBed.createComponent(EventsListComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.openModal();
    component.form.patchValue({ code: 'EV-1', name: 'Annual conference', starts_at: '2027-09-10T09:00', ends_at: '2027-09-10T18:00', capacity: 2 });
    component.save();

    expect(api.createEvent).toHaveBeenCalledWith({
      code: 'EV-1',
      name: 'Annual conference',
      description: null,
      venue: null,
      starts_at: '2027-09-10 09:00:00',
      ends_at: '2027-09-10 18:00:00',
      capacity: 2,
      waitlist_enabled: true,
      currency: 'EUR',
    });
    expect(messageSpy.success).toHaveBeenCalledWith('EVENTS.EVENT_SAVED');
  });
});

describe('EventDetailComponent', () => {
  const api = {
    getEvent: vi.fn(),
    getRegistrations: vi.fn(),
    getReport: vi.fn(),
    publishEvent: vi.fn(),
    closeEvent: vi.fn(),
    cancelEvent: vi.fn(),
    createRegistration: vi.fn(),
    payRegistration: vi.fn(),
    cancelRegistration: vi.fn(),
    getRegistrationQr: vi.fn(),
    createTicketType: vi.fn(),
    updateTicketType: vi.fn(),
    deleteTicketType: vi.fn(),
    createSession: vi.fn(),
    updateSession: vi.fn(),
    deleteSession: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    api.getEvent.mockReturnValue(of({ data: event }));
    api.getRegistrations.mockReturnValue(of({ data: [registration] }));
    api.getReport.mockReturnValue(of({ data: { event_id: 'ev-1', by_ticket_type: [] } }));
    api.publishEvent.mockReturnValue(of({ data: event }));
    api.createRegistration.mockReturnValue(of({ data: { ...registration, status: 'waitlisted' } }));
    api.payRegistration.mockReturnValue(of({ data: registration }));
    api.cancelRegistration.mockReturnValue(of({ data: registration }));
    api.getRegistrationQr.mockReturnValue(of({ data: { qr_token: 'tok', data_uri: 'data:image/png;base64,AAA' } }));
    api.createTicketType.mockReturnValue(of({ data: {} }));
    api.createSession.mockReturnValue(of({ data: {} }));
    configure(api);
  });

  it('loads the event with its registrations and the report on the report tab', () => {
    const fixture = TestBed.createComponent(EventDetailComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    expect(api.getEvent).toHaveBeenCalledWith('ev-1');
    expect(api.getRegistrations).toHaveBeenCalledWith({ event_id: 'ev-1', per_page: 100 });
    expect(component.registrations()).toEqual([registration]);

    component.onTab(3);
    expect(api.getReport).toHaveBeenCalledWith('ev-1');
  });

  it('registers an attendee and tells when the registration went to the waiting list', () => {
    const fixture = TestBed.createComponent(EventDetailComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.openRegistration();
    component.registrationForm.patchValue({ attendee_name: 'Bruno', attendee_email: '' });
    component.saveRegistration();

    expect(api.createRegistration).toHaveBeenCalledWith({ event_id: 'ev-1', ticket_type_id: 'tk-1', attendee_name: 'Bruno', attendee_email: null });
    expect(messageSpy.success).toHaveBeenCalledWith('EVENTS.WAITLISTED_MESSAGE');
  });

  it('pays, cancels, shows the QR code and publishes', () => {
    const fixture = TestBed.createComponent(EventDetailComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.pay(registration);
    component.cancelRegistration(registration);
    component.showQr(registration);
    component.transition('publish');

    expect(api.payRegistration).toHaveBeenCalledWith('rg-1');
    expect(api.cancelRegistration).toHaveBeenCalledWith('rg-1');
    expect(component.qr()?.data_uri).toBe('data:image/png;base64,AAA');
    expect(component.qrVisible()).toBe(true);
    expect(api.publishEvent).toHaveBeenCalledWith('ev-1');
  });

  it('creates a ticket type and a session for the event and shows API errors', () => {
    const fixture = TestBed.createComponent(EventDetailComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.openTicket();
    component.ticketForm.patchValue({ name: 'VIP', price: 120, quantity: 10 });
    component.saveTicket();
    expect(api.createTicketType).toHaveBeenCalledWith({ name: 'VIP', price: '120', quantity: 10, is_active: true, event_id: 'ev-1' });

    component.openSession();
    component.sessionForm.patchValue({ title: 'Keynote', starts_at: '2027-09-10T10:00', ends_at: '2027-09-10T11:00' });
    component.saveSession();
    expect(api.createSession).toHaveBeenCalledWith({ title: 'Keynote', speaker: null, room: null, starts_at: '2027-09-10 10:00:00', ends_at: '2027-09-10 11:00:00', event_id: 'ev-1' });

    api.payRegistration.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 422, error: { errors: { registration: ['Only a confirmed registration can be paid.'] } } })));
    component.pay(registration);
    expect(messageSpy.error).toHaveBeenCalledWith('Only a confirmed registration can be paid.');
  });
});

describe('EventsCheckinComponent', () => {
  const api = { getEvents: vi.fn(), checkIn: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    api.getEvents.mockReturnValue(of({ data: [event] }));
    configure(api);
  });

  it('checks in by token and clears the field, then shows the refusal of a second check-in', () => {
    api.checkIn.mockReturnValueOnce(of({ data: registration }));
    const fixture = TestBed.createComponent(EventsCheckinComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.token.set(' tok ');
    component.submit();
    expect(api.checkIn).toHaveBeenCalledWith({ qr_token: 'tok', event_id: null });
    expect(component.last()).toEqual(registration);
    expect(component.token()).toBe('');

    api.checkIn.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 422, error: { errors: { qr_token: ['This attendee already checked in.'] } } })));
    component.token.set('tok');
    component.submit();
    expect(component.error()).toBe('This attendee already checked in.');
    expect(component.last()).toBeNull();
  });

  it('ignores an empty token', () => {
    const fixture = TestBed.createComponent(EventsCheckinComponent);
    fixture.detectChanges();
    fixture.componentInstance.submit();

    expect(api.checkIn).not.toHaveBeenCalled();
  });
});
