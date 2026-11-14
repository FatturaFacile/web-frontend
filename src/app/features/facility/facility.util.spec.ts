import { HttpErrorResponse } from '@angular/common/http';
import { describe, expect, it } from 'vitest';
import { apiErrorText, facilityAbilities, instantToLocalInput, localInputToInstant, nextFullHour, timelineSlot, toIsoDate, toLocalInput } from './facility.util';

describe('facility util', () => {
  it('reads the first validation message of a 422 and falls back to the summary message', () => {
    const withErrors = new HttpErrorResponse({ status: 422, error: { message: 'Invalid', errors: { starts_at: ['The space is already booked in this interval.'] } } });
    const summaryOnly = new HttpErrorResponse({ status: 403, error: { message: 'Forbidden' } });

    expect(apiErrorText(withErrors)).toBe('The space is already booked in this interval.');
    expect(apiErrorText(summaryOnly)).toBe('Forbidden');
    expect(apiErrorText(new Error('x'))).toBeNull();
  });

  it('formats dates and datetime-local values in the browser time zone and round-trips them', () => {
    const date = new Date(2027, 4, 13, 9, 5);

    expect(toIsoDate(date)).toBe('2027-05-13');
    expect(toLocalInput(date)).toBe('2027-05-13T09:05');
    expect(new Date(localInputToInstant('2027-05-13T09:05')).getTime()).toBe(date.getTime());
    expect(instantToLocalInput(date.toISOString())).toBe('2027-05-13T09:05');
  });

  it('rounds up to the next full hour', () => {
    const next = nextFullHour(new Date(2027, 4, 13, 9, 5));

    expect(next.getHours()).toBe(10);
    expect(next.getMinutes()).toBe(0);
  });

  it('mirrors the policy: managers maintain the register, operators work requests and meters', () => {
    expect(facilityAbilities(['owner'], [])).toEqual({ manage: true, operate: true });
    expect(facilityAbilities(['facility_manager'], [])).toEqual({ manage: true, operate: true });
    expect(facilityAbilities(['technician'], [])).toEqual({ manage: false, operate: true });
    expect(facilityAbilities(['member'], [])).toEqual({ manage: false, operate: false });
    expect(facilityAbilities(['member'], ['facility.manage'])).toEqual({ manage: true, operate: true });
    expect(facilityAbilities(['member'], ['facility.operate'])).toEqual({ manage: false, operate: true });
  });

  it('places an interval in the visible window of the day timeline and clips what falls outside', () => {
    const start = new Date(2027, 4, 13, 9, 0).toISOString();
    const end = new Date(2027, 4, 13, 11, 0).toISOString();

    const slot = timelineSlot(start, end, '2027-05-13', 8, 20);
    expect(slot?.left).toBeCloseTo((1 / 12) * 100, 5);
    expect(slot?.width).toBeCloseTo((2 / 12) * 100, 5);

    const before = timelineSlot(new Date(2027, 4, 13, 5, 0).toISOString(), new Date(2027, 4, 13, 6, 0).toISOString(), '2027-05-13', 8, 20);
    expect(before).toBeNull();

    const clipped = timelineSlot(new Date(2027, 4, 13, 6, 0).toISOString(), new Date(2027, 4, 13, 9, 0).toISOString(), '2027-05-13', 8, 20);
    expect(clipped?.left).toBe(0);
    expect(clipped?.width).toBeCloseTo((1 / 12) * 100, 5);
  });
});
