import { HttpErrorResponse } from '@angular/common/http';
import { describe, expect, it } from 'vitest';
import { dashboard, loans, profile } from './crisis-monitoring.fixtures';
import {
  agreementFileName,
  apiErrorMessage,
  buildGaugeOption,
  buildTimelineOption,
  dscrStatus,
  emptyLoan,
  formatRatio,
  formatSigned,
  isLoanValid,
  isStressed,
  num,
  pickDscr,
  profileDiff,
  progressStatus,
  sanitizeStress,
  statusTone,
  worstStatus,
} from './crisis-monitoring.util';

describe('crisis monitoring helpers', () => {
  it('parses decimal strings safely', () => {
    expect(num('1234.56')).toBe(1234.56);
    expect(num(null)).toBe(0);
    expect(num('abc')).toBe(0);
  });

  it('classifies the DSCR against the bands', () => {
    expect(dscrStatus('0.99')).toBe('red');
    expect(dscrStatus('1.00')).toBe('yellow');
    expect(dscrStatus('1.19')).toBe('yellow');
    expect(dscrStatus('1.20')).toBe('green');
    expect(dscrStatus(null)).toBe('green');
  });

  it('picks the DSCR of an approach and horizon', () => {
    expect(pickDscr(dashboard.dscr, 'operating', 'm6')?.value).toBe('0.90');
    expect(pickDscr(undefined, 'treasury', 'm6')).toBeNull();
  });

  it('keeps the worst status', () => {
    expect(worstStatus(['green', 'yellow'])).toBe('yellow');
    expect(worstStatus(['green', 'red', 'yellow'])).toBe('red');
    expect(worstStatus([])).toBe('green');
  });

  it('maps statuses to tones', () => {
    expect(statusTone('green')).toBe('success');
    expect(statusTone('yellow')).toBe('warning');
    expect(statusTone('red')).toBe('error');
    expect(progressStatus('red')).toBe('exception');
  });

  it('formats ratios and signed variances', () => {
    expect(formatRatio('1.2')).toBe('1.20');
    expect(formatRatio(null)).toBe('');
    expect(formatSigned('0.5')).toBe('+0.50');
    expect(formatSigned('-0.1')).toBe('-0.10');
  });

  it('clamps the stress levers to the bounds of the API', () => {
    expect(
      sanitizeStress({
        revenue_drop_percent: 150,
        dso_delay_days: 12.6,
        interest_rate_bps: -5,
        one_off_outflow_amount: 1000.456,
      }),
    ).toEqual({
      revenue_drop_percent: 100,
      dso_delay_days: 13,
      interest_rate_bps: 0,
      one_off_outflow_amount: 1000.46,
    });
    expect(isStressed(sanitizeStress({}))).toBe(false);
    expect(isStressed(sanitizeStress({ dso_delay_days: 10 }))).toBe(true);
  });

  it('validates a subordinated loan form', () => {
    const loan = emptyLoan('2026-01-01');

    expect(isLoanValid(loan)).toBe(false);
    expect(isLoanValid({ ...loan, creditor_name: 'ACME', principal: '1000.00' })).toBe(true);
    expect(
      isLoanValid({ ...loan, creditor_name: 'ACME', principal: '1000', interest_rate: '120' }),
    ).toBe(false);
  });

  it('sends only the changed profile keys, with empty money as null', () => {
    const diff = profileDiff(profile, {
      ...profile,
      share_capital: '  ',
      employees_count: 20,
      ateco_section: 'K',
    });

    expect(diff).toEqual({ share_capital: null, employees_count: 20 });
  });

  it('names the downloads', () => {
    expect(agreementFileName(loans[0].creditor_name, 'de')).toBe(
      'rangruecktritt-mario-rossi-de.pdf',
    );
    expect(agreementFileName('***', 'it')).toBe('rangruecktritt-agreement-it.pdf');
  });

  it('reads the message of a failed request', () => {
    const error = new HttpErrorResponse({
      status: 422,
      error: { errors: { a: ['crisisApi.bad'] } },
    });

    expect(apiErrorMessage(error)).toBe('crisisApi.bad');
    expect(apiErrorMessage(new Error('x'))).toBeNull();
  });
});

describe('crisis monitoring charts', () => {
  it('builds the 12-month option with the DSCR of the approach', () => {
    const option = buildTimelineOption({
      rows: dashboard.timeline,
      approach: 'operating',
      currency: 'EUR',
      labels: {
        inflows: 'in',
        outflows: 'out',
        debtService: 'ds',
        cumulativeCash: 'cash',
        dscr: 'dscr',
      },
    }) as { series: { name: string; data: (number | null)[] }[] };

    expect(option.series).toHaveLength(5);
    expect(option.series[4].data[0]).toBe(1.1);
    expect(option.series[3].data).toHaveLength(12);
  });

  it('colours the gauge by the bands and hides the pointer when not applicable', () => {
    const bands = { red_below: '1.00', yellow_below: '1.20' };
    const applicable = buildGaugeOption(dashboard.dscr.treasury.m6, bands, 'n/a') as {
      series: {
        axisLine: { lineStyle: { color: [number, string][] } };
        pointer: { show: boolean };
      }[];
    };
    const na = buildGaugeOption(dashboard.dscr.operating.m12, bands, 'n/a') as typeof applicable;

    expect(applicable.series[0].axisLine.lineStyle.color).toHaveLength(3);
    expect(applicable.series[0].axisLine.lineStyle.color[0][0]).toBeCloseTo(0.4);
    expect(applicable.series[0].pointer.show).toBe(true);
    expect(na.series[0].pointer.show).toBe(false);
  });
});
