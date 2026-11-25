import { HttpErrorResponse } from '@angular/common/http';
import { describe, expect, it } from 'vitest';
import {
  barValue,
  cascadeDiscount,
  cleanTiers,
  contractActions,
  errorKey,
  failureOf,
  num,
  percentText,
  promotionActions,
  tiersProblem,
} from './gdo-trade-terms.util';

const tier = (threshold: string, rate: string, flat: string | null = null) => ({
  threshold,
  rate_percent: rate,
  flat_amount: flat,
  label: null,
});

describe('gdo trade terms util', () => {
  it('builds the error key from the problem code with a generic fallback', () => {
    expect(errorKey('contract_overlap')).toBe('gdoTradeTerms.error.contract_overlap');
    expect(errorKey(null)).toBe('gdoTradeTerms.error.generic');
  });

  it('reads the code and the field errors of a problem response', () => {
    const outcome = failureOf(
      new HttpErrorResponse({ status: 422, error: { code: 'scale_overlap', detail: 'Overlap', errors: { code: ['Taken'] } } }),
    );

    expect(outcome.ok).toBe(false);
    expect(outcome.errorKey).toBe('gdoTradeTerms.error.scale_overlap');
    expect(outcome.detail).toBe('Taken');
    expect(failureOf(new Error('x')).errorKey).toBe('gdoTradeTerms.error.generic');
  });

  it('shows decimals as numbers and percentages without trailing zeros', () => {
    expect(num('12.5000')).toBe(12.5);
    expect(num(null)).toBe(0);
    expect(num('abc')).toBe(0);
    expect(percentText('3.5000')).toBe('3.5%');
    expect(percentText('2.0000')).toBe('2%');
    expect(barValue('140')).toBe(100);
    expect(barValue('-4')).toBe(0);
  });

  it('sorts the tiers and drops the empty rows', () => {
    const clean = cleanTiers([tier('200000', '2'), tier('', ''), tier('100000', '1', '')]);

    expect(clean.map((row) => row.threshold)).toEqual(['100000', '200000']);
    expect(clean[0].flat_amount).toBeNull();
  });

  it('validates the brackets like the API does', () => {
    expect(tiersProblem([])).toBe('tiers_required');
    expect(tiersProblem([tier('100', '1'), tier('100', '2')])).toBe('tier_duplicate_threshold');
    expect(tiersProblem([tier('100', '3'), tier('200', '2')])).toBe('tier_rate_decreasing');
    expect(tiersProblem([tier('100', '101')])).toBe('tier_invalid');
    expect(tiersProblem([tier('100', '1'), tier('200', '2')])).toBeNull();
  });

  it('combines the on-invoice discounts as a cascade', () => {
    expect(cascadeDiscount(['3', '2', '1.5', '1'])).toBe(7.3022);
    expect(cascadeDiscount(['0', '0'])).toBe(0);
  });

  it('offers the lifecycle actions of the status', () => {
    expect(contractActions('draft')).toContain('activate');
    expect(contractActions('cancelled')).toEqual([]);
    expect(promotionActions('draft')).toContain('activate');
  });
});
