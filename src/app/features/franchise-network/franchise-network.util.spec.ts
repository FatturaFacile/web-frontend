import { HttpErrorResponse } from '@angular/common/http';
import { describe, expect, it } from 'vitest';
import {
  agreementStatusColor,
  benchmarkBars,
  defaultPeriod,
  errorKey,
  failureOf,
  findingColor,
  isPeriod,
  periodOf,
  positionColor,
  pushStatusColor,
  scoreColor,
  statementStatusColor,
  storeStatusColor,
  targetStatusColor,
  toNumber,
} from './franchise-network.util';

describe('franchise network util', () => {
  it('builds the translation key of a problem code, with a generic fallback', () => {
    expect(errorKey('run_already_invoiced')).toBe('franchiseNetwork.error.run_already_invoiced');
    expect(errorKey(null)).toBe('franchiseNetwork.error.generic');
  });

  it('reads the code, the params and the first field error of a failed call', () => {
    const response = new HttpErrorResponse({
      status: 422,
      error: {
        code: 'exclusivity_zone_overlap',
        detail: 'overlap',
        params: { store: 'MI-001', nested: { ignored: true } },
        errors: { end_date: ['The end date is invalid.'] },
      },
    });

    const outcome = failureOf(response);

    expect(outcome.ok).toBe(false);
    expect(outcome.errorKey).toBe('franchiseNetwork.error.exclusivity_zone_overlap');
    expect(outcome.params).toEqual({ store: 'MI-001' });
    expect(outcome.detail).toBe('The end date is invalid.');
  });

  it('falls back to the generic key when the failure is not an API problem', () => {
    expect(failureOf(new Error('boom')).errorKey).toBe('franchiseNetwork.error.generic');
  });

  it('works on the month that just ended, also across the new year', () => {
    expect(defaultPeriod(new Date(2028, 4, 15))).toBe('2028-04');
    expect(defaultPeriod(new Date(2028, 0, 3))).toBe('2027-12');
  });

  it('validates a period and turns a picked date into one', () => {
    expect(isPeriod('2028-04')).toBe(true);
    expect(isPeriod('2028-13')).toBe(false);
    expect(isPeriod('04/2028')).toBe(false);
    expect(periodOf(new Date(2028, 6, 20))).toBe('2028-07');
    expect(periodOf(null)).toBeNull();
  });

  it('reads decimals sent as strings and ignores what is not a number', () => {
    expect(toNumber('12.50')).toBe(12.5);
    expect(toNumber(7)).toBe(7);
    expect(toNumber(null)).toBe(0);
    expect(toNumber('n/a')).toBe(0);
  });

  it('colours the statuses', () => {
    expect(agreementStatusColor('active')).toBe('green');
    expect(agreementStatusColor('expired')).toBe('orange');
    expect(storeStatusColor('suspended')).toBe('orange');
    expect(pushStatusColor('partial')).toBe('orange');
    expect(targetStatusColor('failed')).toBe('red');
    expect(statementStatusColor('skipped')).toBe('default');
    expect(findingColor({ code: 'guarantee_expired', severity: 'error', params: {} })).toBe('red');
    expect(findingColor({ code: 'renewal_due', severity: 'warning', params: {} })).toBe('orange');
    expect(positionColor('top_quartile')).toBe('green');
    expect(positionColor(null)).toBe('default');
  });

  it('colours an audit score against the pass threshold', () => {
    expect(scoreColor('85.00', '80')).toBe('green');
    expect(scoreColor('72', '80')).toBe('orange');
    expect(scoreColor('50', '80')).toBe('red');
  });

  describe('benchmark bars', () => {
    it('scales the four bars to the longest value', () => {
      const bars = benchmarkBars('50', { median: '40', p75: '100' }, { average: '25', p75: '90' });

      expect(bars).toEqual({ own: 50, median: 40, average: 25, top: 100 });
    });

    it('uses the network top quartile when the cluster is hidden', () => {
      const bars = benchmarkBars('10', null, { average: '20', p75: '40' });

      expect(bars).toEqual({ own: 25, median: null, average: 50, top: 100 });
    });

    it('draws an empty bar for a negative value and none for a missing one', () => {
      const bars = benchmarkBars('-4.5', { median: null, p75: '8' }, { average: '3', p75: '8' });

      expect(bars.own).toBe(0);
      expect(bars.median).toBeNull();
      expect(bars.top).toBe(100);
    });

    it('does not divide by zero when every value is zero', () => {
      expect(benchmarkBars('0', { median: '0', p75: '0' }, { average: '0', p75: '0' })).toEqual({
        own: 0,
        median: 0,
        average: 0,
        top: 0,
      });
    });
  });
});
