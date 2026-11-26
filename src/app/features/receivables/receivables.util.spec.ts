import { HttpErrorResponse } from '@angular/common/http';
import { describe, expect, it } from 'vitest';
import {
  addAmounts,
  AR_OK,
  arFailure,
  apiErrorMessage,
  bucketPartsFromKey,
  drilldownQuery,
  barShare,
  bucketColor,
  bucketLabel,
  compareAmounts,
  dateRange,
  defaultStatementPeriod,
  fieldErrors,
  formatAmount,
  fromIsoDate,
  isOpenItem,
  isPositiveAmount,
  itemFiltersFromQuery,
  itemFiltersToQuery,
  minAmount,
  outcomeColor,
  parseAmount,
  ratingColor,
  statementFileName,
  statusColor,
  subAmounts,
  sumAmounts,
  toIsoDate,
  todayIso,
  utilizationStatus,
  utilizationValue,
} from './receivables.util';

const translate = (key: string, params?: Record<string, string | number>): string =>
  params ? `${key}:${JSON.stringify(params)}` : key;

describe('decimal amounts', () => {
  it('parses plain amounts into cents and rejects anything else', () => {
    expect(parseAmount('1234.50')).toBe(123450n);
    expect(parseAmount('7')).toBe(700n);
    expect(parseAmount('0.5')).toBe(50n);
    expect(parseAmount('-12.30')).toBe(-1230n);
    expect(parseAmount('1.234')).toBeNull();
    expect(parseAmount('1,50')).toBeNull();
    expect(parseAmount('abc')).toBeNull();
    expect(parseAmount('')).toBeNull();
    expect(parseAmount(null)).toBeNull();
    expect(parseAmount(undefined)).toBeNull();
  });

  it('formats cents with two decimals', () => {
    expect(formatAmount(123450n)).toBe('1234.50');
    expect(formatAmount(5n)).toBe('0.05');
    expect(formatAmount(-1230n)).toBe('-12.30');
    expect(formatAmount(0n)).toBe('0.00');
  });

  it('adds, subtracts and compares without floating point drift', () => {
    expect(addAmounts('0.10', '0.20')).toBe('0.30');
    expect(subAmounts('100.00', '33.33')).toBe('66.67');
    expect(subAmounts('10.00', '12.50')).toBe('-2.50');
    expect(compareAmounts('10.00', '9.99')).toBe(1);
    expect(compareAmounts('9.99', '10.00')).toBe(-1);
    expect(compareAmounts('10', '10.00')).toBe(0);
    expect(minAmount('5.00', '4.99')).toBe('4.99');
    expect(sumAmounts(['0.10', '0.20', '0.30'])).toBe('0.60');
    expect(sumAmounts([])).toBe('0.00');
  });

  it('knows a positive amount', () => {
    expect(isPositiveAmount('0.01')).toBe(true);
    expect(isPositiveAmount('0.00')).toBe(false);
    expect(isPositiveAmount('-1.00')).toBe(false);
    expect(isPositiveAmount('x')).toBe(false);
  });

  it('computes the width of a bar and caps it at 100', () => {
    expect(barShare('50.00', '200.00')).toBe(25);
    expect(barShare('200.00', '100.00')).toBe(100);
    expect(barShare('0.00', '100.00')).toBe(0);
    expect(barShare('10.00', '0.00')).toBe(0);
    expect(barShare(null, '10.00')).toBe(0);
  });
});

describe('dates', () => {
  it('formats a local date without a UTC shift and parses it back', () => {
    const date = new Date(2026, 2, 5);
    expect(toIsoDate(date)).toBe('2026-03-05');
    expect(toIsoDate(null)).toBeNull();
    expect(fromIsoDate('2026-03-05')?.getDate()).toBe(5);
    expect(fromIsoDate('2026-03-05')?.getMonth()).toBe(2);
    expect(fromIsoDate('')).toBeNull();
    expect(fromIsoDate('garbage')).toBeNull();
    expect(todayIso(new Date(2026, 11, 31))).toBe('2026-12-31');
  });

  it('gives the two ends of a range for the date picker, or nothing', () => {
    const range = dateRange('2026-01-01', '2026-03-31');
    expect(range).toHaveLength(2);
    expect(toIsoDate(range[0])).toBe('2026-01-01');
    expect(toIsoDate(range[1])).toBe('2026-03-31');
    expect(dateRange('2026-01-01', undefined)).toEqual([]);
    expect(dateRange(null, null)).toEqual([]);
  });

  it('starts the default statement period on 1 January', () => {
    expect(defaultStatementPeriod(new Date(2026, 5, 15))).toEqual({
      from: '2026-01-01',
      to: '2026-06-15',
    });
  });
});

describe('labels and colours', () => {
  it('labels the buckets from the bounds of the response', () => {
    expect(bucketLabel({ key: 'current', from: null, to: 0 }, translate)).toBe('AR.BUCKET_CURRENT');
    expect(bucketLabel({ key: '1_30', from: 1, to: 30 }, translate)).toBe(
      'AR.BUCKET_RANGE:{"from":1,"to":30}',
    );
    expect(bucketLabel({ key: '121_plus', from: 121, to: null }, translate)).toBe(
      'AR.BUCKET_OVER:{"from":121}',
    );
  });

  it('turns the bucket colour warmer with the delay', () => {
    expect(bucketColor(0, 6)).toBe('#52c41a');
    expect(bucketColor(1, 6)).toBe('#faad14');
    expect(bucketColor(5, 6)).toBe('#f5222d');
  });

  it('maps statuses, ratings and outcomes to tag colours', () => {
    expect(statusColor('overdue')).toBe('red');
    expect(statusColor('disputed')).toBe('orange');
    expect(statusColor('paid')).toBe('green');
    expect(statusColor('open')).toBe('processing');
    expect(ratingColor('low')).toBe('green');
    expect(ratingColor('critical')).toBe('red');
    expect(outcomeColor('block')).toBe('red');
    expect(outcomeColor('warning')).toBe('orange');
    expect(outcomeColor('ok')).toBe('green');
  });

  it('reads the utilisation as a number', () => {
    expect(utilizationValue('82.50')).toBe(82.5);
    expect(utilizationValue(40)).toBe(40);
    expect(utilizationValue(null)).toBeNull();
    expect(utilizationValue('x')).toBeNull();
    expect(utilizationStatus(120)).toBe('exception');
    expect(utilizationStatus(50)).toBe('success');
    expect(utilizationStatus(null)).toBe('normal');
  });

  it('treats an item with money open as allocatable', () => {
    expect(isOpenItem({ status: 'open', open_amount: '10.00' })).toBe(true);
    expect(isOpenItem({ status: 'overdue', open_amount: '10.00' })).toBe(true);
    expect(isOpenItem({ status: 'paid', open_amount: '0.00' })).toBe(false);
    expect(isOpenItem({ status: 'written_off', open_amount: '10.00' })).toBe(false);
    expect(isOpenItem({ status: 'open', open_amount: '0.00' })).toBe(false);
  });
});

describe('errors', () => {
  it('prefers the first validation message, then detail, then message', () => {
    const validation = new HttpErrorResponse({
      status: 422,
      error: { message: 'Invalid', errors: { reason: ['The reason is required.'] } },
    });
    expect(apiErrorMessage(validation)).toBe('The reason is required.');
    expect(fieldErrors(validation)).toEqual({ reason: ['The reason is required.'] });

    expect(
      apiErrorMessage(new HttpErrorResponse({ status: 403, error: { message: 'Forbidden' } })),
    ).toBe('Forbidden');
    expect(apiErrorMessage(new HttpErrorResponse({ status: 500, error: { detail: 'Boom' } }))).toBe(
      'Boom',
    );
    expect(apiErrorMessage(new Error('x'))).toBeNull();
    expect(fieldErrors(new HttpErrorResponse({ status: 500 }))).toEqual({});
  });
});

describe('open items query string', () => {
  it('reads the drill-down filters and ignores unknown values', () => {
    expect(
      itemFiltersFromQuery({
        bucket: '31_60',
        customer_id: 'c-1',
        status: 'overdue',
        open_only: '0',
        unknown: 'x',
      }),
    ).toEqual({ bucket: '31_60', customer_id: 'c-1', status: 'overdue', open_only: false });

    expect(itemFiltersFromQuery({ status: 'bogus', bucket: '', open_only: '1' })).toEqual({
      open_only: true,
    });
    expect(itemFiltersFromQuery({})).toEqual({});
  });

  it('writes only the filters that are set', () => {
    expect(
      itemFiltersToQuery({
        bucket: '1_30',
        customer_id: 'c-1',
        due_to: '',
        open_only: true,
        page: 3,
      }),
    ).toEqual({ bucket: '1_30', customer_id: 'c-1', open_only: '1' });
  });
});

describe('statement file name', () => {
  it('builds an ascii slug of the customer', () => {
    expect(
      statementFileName('Società Rossi & Figli S.r.l.', '2026-01-01', '2026-03-31', 'pdf'),
    ).toBe('statement-societa-rossi-figli-s-r-l-2026-01-01-2026-03-31.pdf');
    expect(statementFileName('***', '2026-01-01', '2026-03-31', 'xlsx')).toBe(
      'statement-customer-2026-01-01-2026-03-31.xlsx',
    );
  });
});

describe('bucket label from a key', () => {
  it('decodes the bounds out of the key of a bucket', () => {
    expect(bucketPartsFromKey('current')).toEqual({ key: 'AR.BUCKET_CURRENT' });
    expect(bucketPartsFromKey('31_60')).toEqual({
      key: 'AR.BUCKET_RANGE',
      params: { from: 31, to: 60 },
    });
    expect(bucketPartsFromKey('121_plus')).toEqual({
      key: 'AR.BUCKET_OVER',
      params: { from: 121 },
    });
    expect(bucketPartsFromKey('over_90')).toEqual({ key: 'AR.BUCKET_OVER_90' });
    expect(bucketPartsFromKey('weird')).toEqual({
      key: 'AR.BUCKET_OTHER',
      params: { bucket: 'weird' },
    });
  });
});

describe('drill-down and outcomes', () => {
  it('builds the query of a drill-down on a bucket and a customer', () => {
    expect(drilldownQuery('31_60', 'c-1', 'CHF')).toEqual({
      bucket: '31_60',
      customer_id: 'c-1',
      currency: 'CHF',
      open_only: '1',
    });
    expect(drilldownQuery(null, 'c-1')).toEqual({ customer_id: 'c-1', open_only: '1' });
    expect(drilldownQuery('1_30')).toEqual({ bucket: '1_30', open_only: '1' });
  });

  it('turns a failed call into an outcome with the message and the field errors', () => {
    const failure = arFailure(
      new HttpErrorResponse({
        status: 422,
        error: { message: 'Invalid', errors: { amount: ['Too much.'] } },
      }),
    );

    expect(failure).toEqual({ ok: false, message: 'Too much.', errors: { amount: ['Too much.'] } });
    expect(AR_OK).toEqual({ ok: true, message: null, errors: {} });
  });
});
