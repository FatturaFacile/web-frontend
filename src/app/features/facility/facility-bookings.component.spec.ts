import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NzMessageService } from 'ng-zorro-antd/message';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { icons } from '../../icons-provider';
import { AuthStore, FacilityApiService, FacilityBooking, FacilityBookingCheckResult, FacilitySpace, TranslateService } from '@core';
import { FacilityBookingsComponent } from './facility-bookings.component';
import { toIsoDate } from './facility.util';

describe('FacilityBookingsComponent', () => {
  const room: FacilitySpace = {
    id: 'sp-1',
    building_id: 'b-1',
    parent_id: null,
    kind: 'meeting_room',
    code: 'R1',
    name: 'Sala Duomo',
    floor_level: null,
    capacity: 8,
    area_sqm: null,
    is_bookable: true,
    is_active: true,
    amenities: [],
    notes: null,
  };

  const today = toIsoDate(new Date());
  const booking: FacilityBooking = {
    id: 'bk-1',
    space_id: 'sp-1',
    series_id: null,
    user_id: 'usr-1',
    user: { id: 'usr-1', name: 'Laura Bianchi' },
    title: 'Planning',
    attendees: 4,
    starts_at: new Date(`${today}T09:00:00`).toISOString(),
    ends_at: new Date(`${today}T10:00:00`).toISOString(),
    status: 'booked',
    checked_in_at: null,
    released_at: null,
    cancelled_at: null,
    cancel_reason: null,
  };

  const free: FacilityBookingCheckResult = { available: true, violations: [], conflicts: [], rules: { max_bookings_per_user_per_day: null, max_minutes_per_booking: 480, max_advance_days: 90, checkin_grace_minutes: 15, requires_checkin: true } };
  const taken: FacilityBookingCheckResult = { ...free, available: false, violations: [{ code: 'conflict', field: 'starts_at', message: 'The space is already booked in this interval.' }], conflicts: [booking] };

  const api = {
    getBuildings: vi.fn(),
    getSpaces: vi.fn(),
    getBookings: vi.fn(),
    checkBooking: vi.fn(),
    createBooking: vi.fn(),
    createBookingSeries: vi.fn(),
    checkInBooking: vi.fn(),
    cancelBooking: vi.fn(),
  };
  const message = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() };
  const translate = { instant: vi.fn().mockImplementation((key: string) => key), translate: vi.fn().mockImplementation((key: string) => key) };
  const auth = { user: () => ({ id: 'usr-1' }), activeRoles: () => ['member'], userPermissions: () => [] as string[] };

  function create(): FacilityBookingsComponent {
    const fixture = TestBed.createComponent(FacilityBookingsComponent);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    api.getBuildings.mockReturnValue(of({ data: [] }));
    api.getSpaces.mockReturnValue(of({ data: [room] }));
    api.getBookings.mockReturnValue(of({ data: [booking] }));
    api.checkBooking.mockReturnValue(of({ data: free }));
    api.createBooking.mockReturnValue(of({ data: booking }));
    api.createBookingSeries.mockReturnValue(of({ data: { id: 'sr-1', space_id: 'sp-1', status: 'active', occurrences: 8, created: 7, skipped: [{ date: '2027-05-26', reasons: ['conflict'] }] } }));
    api.checkInBooking.mockReturnValue(of({ data: { ...booking, status: 'checked_in' } }));
    api.cancelBooking.mockReturnValue(of({ data: { ...booking, status: 'cancelled' } }));

    TestBed.configureTestingModule({
      imports: [FacilityBookingsComponent],
      providers: [
        { provide: FacilityApiService, useValue: api },
        { provide: NzMessageService, useValue: message },
        { provide: TranslateService, useValue: translate },
        { provide: AuthStore, useValue: auth },
        provideNzIcons(icons),
      ],
    });
  });

  afterEach(() => vi.useRealTimers());

  it('loads the bookable spaces and the bookings of the day and places them on the timeline', () => {
    const component = create();

    expect(api.getSpaces).toHaveBeenCalledWith(expect.objectContaining({ bookable: true, active: true }));
    expect(api.getBookings).toHaveBeenCalledWith(expect.objectContaining({ from: today, to: today, active: true }));
    expect(component.rows()).toHaveLength(1);
    expect(component.rows()[0].slots).toHaveLength(1);
    expect(component.rows()[0].slots[0].slot.width).toBeGreaterThan(0);
    expect(component.todayCount()).toBe(1);
  });

  it('checks the interval while the user types and only allows saving a free slot', () => {
    const component = create();
    component.openModal('sp-1', new Date(`${today}T11:00:00`));

    api.checkBooking.mockReturnValueOnce(of({ data: taken }));
    component.form.patchValue({ title: 'Retro' });
    vi.advanceTimersByTime(350);

    expect(api.checkBooking).toHaveBeenCalledTimes(1);
    expect(api.checkBooking.mock.calls[0][0]).toMatchObject({ space_id: 'sp-1' });
    expect(component.check()?.available).toBe(false);
    expect(component.check()?.conflicts[0].id).toBe('bk-1');
    expect(component.canSave()).toBe(false);

    component.form.patchValue({ title: 'Retro 2' });
    vi.advanceTimersByTime(350);
    expect(component.check()?.available).toBe(true);
    expect(component.canSave()).toBe(true);
  });

  it('saves a single booking with UTC instants and reloads the day', () => {
    const component = create();
    component.openModal('sp-1', new Date(`${today}T11:00:00`));
    component.form.patchValue({ title: 'Retro', attendees: 5 });
    vi.advanceTimersByTime(350);

    component.save();

    expect(api.createBooking).toHaveBeenCalledWith({
      space_id: 'sp-1',
      starts_at: new Date(`${today}T11:00:00`).toISOString(),
      ends_at: new Date(`${today}T12:00:00`).toISOString(),
      title: 'Retro',
      attendees: 5,
    });
    expect(message.success).toHaveBeenCalledWith('FACILITY.BOOKING_SAVED');
    expect(component.modalVisible()).toBe(false);
    expect(api.getBookings.mock.calls.length).toBeGreaterThan(2);
  });

  it('sends a recurring booking to the series endpoint and reports the skipped dates', () => {
    const component = create();
    component.openModal('sp-1', new Date(`${today}T11:00:00`));
    component.form.patchValue({ recurring: true, recurrence: 'weekly', weekdays: [1, 3], until_date: '2027-12-31', skip_conflicts: true });

    component.save();

    expect(api.createBookingSeries).toHaveBeenCalledWith(
      expect.objectContaining({ space_id: 'sp-1', recurrence: 'weekly', weekdays: [1, 3], start_date: today, until_date: '2027-12-31', start_time: '11:00', end_time: '12:00', skip_conflicts: true }),
    );
    expect(api.createBooking).not.toHaveBeenCalled();
    expect(message.warning).toHaveBeenCalled();
  });

  it('shows the reason of a refused booking and refreshes the conflict feedback', () => {
    api.createBooking.mockReturnValue(throwError(() => ({ error: { errors: { starts_at: ['The space is already booked in this interval.'] } } })));
    const component = create();
    component.openModal('sp-1', new Date(`${today}T11:00:00`));
    vi.advanceTimersByTime(350);

    component.save();

    expect(message.error).toHaveBeenCalled();
    expect(component.modalVisible()).toBe(true);
    expect(api.checkBooking).toHaveBeenCalled();
  });

  it('checks in and cancels a booking of the list', () => {
    const component = create();

    component.checkIn(booking);
    expect(api.checkInBooking).toHaveBeenCalledWith('bk-1');
    expect(message.success).toHaveBeenCalledWith('FACILITY.CHECKED_IN');

    component.cancel(booking);
    expect(api.cancelBooking).toHaveBeenCalledWith('bk-1');
    expect(message.success).toHaveBeenCalledWith('FACILITY.BOOKING_CANCELLED');
  });
});
