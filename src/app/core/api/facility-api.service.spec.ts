import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FacilityBookingRequest, FacilityBookingSeriesRequest, FacilityMeterReadingRequest } from '../models';
import { FacilityApiService } from './facility-api.service';

describe('FacilityApiService', () => {
  let service: FacilityApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [FacilityApiService, provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(FacilityApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lists bookings with the filters as query parameters and booleans as 1 or 0', () => {
    service.getBookings({ from: '2027-05-13', to: '2027-05-13', active: true, mine: false, member_id: 'usr-1' }).subscribe();

    const request = http.expectOne((r) => r.url.endsWith('/facility/bookings'));
    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('from')).toBe('2027-05-13');
    expect(request.request.params.get('active')).toBe('1');
    expect(request.request.params.get('mine')).toBe('0');
    expect(request.request.params.get('member_id')).toBe('usr-1');
    expect(request.request.params.has('user_id')).toBe(false);
    request.flush({ data: [] });
  });

  it('checks, creates and cancels bookings and series with the field names of the form requests', () => {
    const payload: FacilityBookingRequest = { space_id: 's-1', starts_at: '2027-05-13T09:00:00Z', ends_at: '2027-05-13T10:00:00Z', title: 'Planning', attendees: 4 };
    service.checkBooking({ space_id: 's-1', starts_at: payload.starts_at, ends_at: payload.ends_at }).subscribe();
    http.expectOne((r) => r.url.endsWith('/facility/bookings/check')).flush({ data: { available: true, violations: [], conflicts: [] } });

    service.createBooking(payload).subscribe();
    const create = http.expectOne((r) => r.url.endsWith('/facility/bookings') && r.method === 'POST');
    expect(create.request.body).toEqual(payload);
    create.flush({ data: {} });

    service.checkInBooking('b-1').subscribe();
    http.expectOne((r) => r.url.endsWith('/facility/bookings/b-1/check-in')).flush({ data: {} });

    service.cancelBooking('b-1', 'No longer needed').subscribe();
    const cancel = http.expectOne((r) => r.url.endsWith('/facility/bookings/b-1/cancel'));
    expect(cancel.request.body).toEqual({ reason: 'No longer needed' });
    cancel.flush({ data: {} });

    const series: FacilityBookingSeriesRequest = { space_id: 's-1', recurrence: 'weekly', weekdays: [1, 3], start_date: '2027-05-17', until_date: '2027-06-11', start_time: '09:00', end_time: '17:00', skip_conflicts: true };
    service.createBookingSeries(series).subscribe();
    const created = http.expectOne((r) => r.url.endsWith('/facility/booking-series'));
    expect(created.request.body).toEqual(series);
    created.flush({ data: {} });
  });

  it('runs the status actions of a service request through one endpoint per action', () => {
    service.actOnServiceRequest('r-1', 'assign', { assignee_id: 'usr-2' }).subscribe();
    const assign = http.expectOne((r) => r.url.endsWith('/facility/service-requests/r-1/assign'));
    expect(assign.request.method).toBe('POST');
    expect(assign.request.body).toEqual({ assignee_id: 'usr-2' });
    assign.flush({ data: {} });

    service.actOnServiceRequest('r-1', 'raise-work-order').subscribe();
    http.expectOne((r) => r.url.endsWith('/facility/service-requests/r-1/raise-work-order')).flush({ data: {} });

    service.addRequestComment('r-1', { body: 'On it', is_internal: true }).subscribe();
    http.expectOne((r) => r.url.endsWith('/facility/service-requests/r-1/comments') && r.method === 'POST').flush({ data: {} });
  });

  it('works inspections, templates and the scheduler', () => {
    service.generateInspections({ as_of: '2027-06-02' }).subscribe();
    const generate = http.expectOne((r) => r.url.endsWith('/facility/inspection-templates/generate'));
    expect(generate.request.body).toEqual({ as_of: '2027-06-02' });
    generate.flush({ data: [] });

    service.completeInspection('i-1', { answers: [{ key: 'visual', result: 'fail' }], notes: 'Seal broken' }).subscribe();
    const complete = http.expectOne((r) => r.url.endsWith('/facility/inspections/i-1/complete'));
    expect(complete.request.body.answers[0]).toEqual({ key: 'visual', result: 'fail' });
    complete.flush({ data: {} });

    service.cancelInspection('i-1', 'Closed').subscribe();
    expect(http.expectOne((r) => r.url.endsWith('/facility/inspections/i-1/cancel')).request.body).toEqual({ reason: 'Closed' });
  });

  it('records meter readings and asks for the monthly summary of a year', () => {
    const reading: FacilityMeterReadingRequest = { read_on: '2027-05-10', value: 1250.5, reading_type: 'regular' };
    service.recordMeterReading('m-1', reading).subscribe();
    const record = http.expectOne((r) => r.url.endsWith('/facility/meters/m-1/readings') && r.method === 'POST');
    expect(record.request.body).toEqual(reading);
    record.flush({ data: {} });

    service.getMeterSummary({ year: 2027, kind: 'water' }).subscribe();
    const summary = http.expectOne((r) => r.url.endsWith('/facility/meters/summary'));
    expect(summary.request.params.get('year')).toBe('2027');
    expect(summary.request.params.get('kind')).toBe('water');
    summary.flush({ data: { year: 2027, rows: [], totals: [] } });

    service.deleteMeterReading('m-1', 'rd-1').subscribe();
    expect(http.expectOne((r) => r.url.endsWith('/facility/meters/m-1/readings/rd-1')).request.method).toBe('DELETE');
  });

  it('reads the register: buildings, the space tree and the free spaces of an interval', () => {
    service.getSpaceTree('b-1').subscribe();
    http.expectOne((r) => r.url.endsWith('/facility/buildings/b-1/tree')).flush({ data: [] });

    service.getAvailableSpaces({ starts_at: '2027-05-13T09:00:00Z', ends_at: '2027-05-13T10:00:00Z', kind: 'meeting_room', min_capacity: 6 }).subscribe();
    const available = http.expectOne((r) => r.url.endsWith('/facility/spaces/available'));
    expect(available.request.params.get('min_capacity')).toBe('6');
    available.flush({ data: [] });

    service.getBookingRules().subscribe();
    http.expectOne((r) => r.url.endsWith('/facility/booking-rules')).flush({ data: [] });

    service.saveBookingRule('desk', { max_bookings_per_user_per_day: 1, max_minutes_per_booking: 600, max_advance_days: 30, checkin_grace_minutes: 15, requires_checkin: true }).subscribe();
    expect(http.expectOne((r) => r.url.endsWith('/facility/booking-rules/desk')).request.method).toBe('PUT');
  });
});
