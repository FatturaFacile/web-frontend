import { HttpErrorResponse } from '@angular/common/http';
import { describe, expect, it } from 'vitest';
import {
  bookingActions,
  bookingStatusColor,
  clockMinutes,
  errorKey,
  expiryColor,
  expiryState,
  failureOf,
  flightStatusColor,
  formatMinutes,
  gaugePercent,
  gaugeStatus,
  isAssignable,
  isTachographFile,
  kmShares,
  parseInstant,
  sheetStatusColor,
  timelineSpan,
  toApiDateTime,
  toDateString,
  toNumber,
  toPeriod,
} from './passenger-transport.util';

describe('passenger transport util', () => {
  it('builds the error key from the problem code with a generic fallback', () => {
    expect(errorKey('assignment_blocked')).toBe('passengerTransport.error.assignment_blocked');
    expect(errorKey(null)).toBe('passengerTransport.error.generic');
    expect(errorKey(undefined)).toBe('passengerTransport.error.generic');
  });

  it('reads the code, the scalar parameters and the legal findings of a refused assignment', () => {
    const issue = {
      code: 'cqc_expired',
      severity: 'blocking',
      citation: 'D.Lgs. 286/2005 (CQC Persone)',
      params: { expired_on: '2028-03-01' },
      message: 'CQC Persone expired',
    };
    const outcome = failureOf(
      new HttpErrorResponse({
        status: 422,
        error: {
          code: 'assignment_blocked',
          detail: 'blocked',
          params: { blocking_count: 1, issues: [issue] },
        },
      }),
    );

    expect(outcome.ok).toBe(false);
    expect(outcome.errorKey).toBe('passengerTransport.error.assignment_blocked');
    expect(outcome.code).toBe('assignment_blocked');
    expect(outcome.params).toEqual({ blocking_count: 1 });
    expect(outcome.issues).toEqual([issue]);
  });

  it('keeps the first field error of a validation failure as the detail', () => {
    const outcome = failureOf(
      new HttpErrorResponse({
        status: 422,
        error: { errors: { agreed_price_net: ['The fare is required.'] } },
      }),
    );

    expect(outcome.detail).toBe('The fare is required.');
    expect(outcome.errors['agreed_price_net']).toEqual(['The fare is required.']);
    expect(outcome.errorKey).toBe('passengerTransport.error.generic');
  });

  it('answers a generic failure for an error that is not an HTTP response', () => {
    const outcome = failureOf(new Error('boom'));

    expect(outcome.ok).toBe(false);
    expect(outcome.issues).toEqual([]);
    expect(outcome.errorKey).toBe('passengerTransport.error.generic');
  });

  it('offers each booking status the actions the API accepts from it', () => {
    expect(bookingActions('draft')).toEqual(['confirm', 'cancel']);
    expect(bookingActions('assigned')).toEqual(['start_run', 'cancel']);
    expect(bookingActions('passenger_on_board')).toEqual(['complete']);
    expect(bookingActions('completed')).toEqual([]);
    expect(bookingActions('invoiced')).toEqual([]);
    expect(isAssignable('confirmed')).toBe(true);
    expect(isAssignable('completed')).toBe(false);
  });

  it('colours the statuses', () => {
    expect(bookingStatusColor('completed')).toBe('green');
    expect(bookingStatusColor('cancelled')).toBe('red');
    expect(flightStatusColor('delayed')).toBe('orange');
    expect(flightStatusColor(null)).toBe('default');
    expect(sheetStatusColor('transmitted')).toBe('green');
  });

  it('reads decimals tolerantly', () => {
    expect(toNumber('133.33')).toBe(133.33);
    expect(toNumber(7)).toBe(7);
    expect(toNumber(null)).toBe(0);
    expect(toNumber('abc')).toBe(0);
  });

  it('splits minutes into hours and minutes and prints the clock form', () => {
    expect(formatMinutes(270)).toEqual({ hours: 4, minutes: 30 });
    expect(formatMinutes(-5)).toEqual({ hours: 0, minutes: 0 });
    expect(clockMinutes(270)).toBe('4:30');
    expect(clockMinutes(65)).toBe('1:05');
  });

  it('measures the driving-time gauges and turns them red near the limit', () => {
    expect(gaugePercent(270, 540)).toBe(50);
    expect(gaugePercent(900, 540)).toBe(100);
    expect(gaugePercent(10, null)).toBe(0);
    expect(gaugePercent(10, 0)).toBe(0);
    expect(gaugeStatus(50)).toBe('success');
    expect(gaugeStatus(80)).toBe('normal');
    expect(gaugeStatus(95)).toBe('exception');
  });

  it('shares the kilometres between the territories so that they add up to 100', () => {
    expect(kmShares('40', '20', '0')).toEqual({ it: 67, ch: 33, other: 0 });
    expect(kmShares('10', '10', '10')).toEqual({ it: 33, ch: 33, other: 34 });
    expect(kmShares(0, 0, 0)).toEqual({ it: 0, ch: 0, other: 0 });
    expect(kmShares('42.5', null, undefined)).toEqual({ it: 100, ch: 0, other: 0 });
  });

  it('classifies the expiry of a document against today', () => {
    const today = new Date('2028-03-10T10:00:00');

    expect(expiryState(null, today)).toBe('missing');
    expect(expiryState('not a date', today)).toBe('missing');
    expect(expiryState('2028-03-09', today)).toBe('expired');
    expect(expiryState('2028-03-10', today)).toBe('expiring');
    expect(expiryState('2028-05-01', today)).toBe('expiring');
    expect(expiryState('2028-06-01', today)).toBe('valid');
    expect(expiryColor('expired')).toBe('red');
    expect(expiryColor('expiring')).toBe('orange');
    expect(expiryColor('valid')).toBe('green');
  });

  it('places a trip in the window of the timeline', () => {
    const start = new Date('2028-03-10T00:00:00');
    const end = new Date('2028-03-11T00:00:00');

    expect(timelineSpan('2028-03-10T12:00:00', '2028-03-10T18:00:00', start, end)).toEqual({
      left: 50,
      width: 25,
    });
    expect(timelineSpan('2028-03-09T20:00:00', '2028-03-10T06:00:00', start, end)).toEqual({
      left: 0,
      width: 25,
    });
    expect(timelineSpan('2028-03-10T23:59:00', '2028-03-10T23:59:30', start, end)?.width).toBe(1);
    expect(timelineSpan('2028-03-12T08:00:00', '2028-03-12T09:00:00', start, end)).toBeNull();
    expect(timelineSpan('2028-03-09T08:00:00', '2028-03-09T09:00:00', start, end)).toBeNull();
    expect(timelineSpan('2028-03-10T12:00:00', null, start, end)?.width).toBeCloseTo(4.17, 1);
  });

  it('formats dates for the API in the local time zone', () => {
    const date = new Date(2028, 2, 5, 9, 7, 30);

    expect(toDateString(date)).toBe('2028-03-05');
    expect(toPeriod(date)).toBe('2028-03');
    expect(toApiDateTime(date)).toBe('2028-03-05 09:07:00');
    expect(toApiDateTime(null)).toBeNull();
    expect(toApiDateTime(new Date('invalid'))).toBeNull();
    expect(parseInstant('2028-03-05T09:07:00')?.getFullYear()).toBe(2028);
    expect(parseInstant('nope')).toBeNull();
    expect(parseInstant(null)).toBeNull();
  });

  it('recognises the tachograph file names', () => {
    expect(isTachographFile('driver.DDD')).toBe(true);
    expect(isTachographFile('C_2028.c1b')).toBe(true);
    expect(isTachographFile('V_2028.v1b')).toBe(true);
    expect(isTachographFile('notes.txt')).toBe(false);
  });
});
