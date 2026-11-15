import { HttpErrorResponse } from '@angular/common/http';
import { describe, expect, it } from 'vitest';
import { BiQueryResult } from '@core';
import { BUSINESS_INTELLIGENCE_ROUTES } from './business-intelligence.routes';
import { apiErrorText, blankToNull, chartPoints, dimensionKey, formatBiValue, specDimensionKeys, toNumber } from './bi.util';

describe('business intelligence screens', () => {
  it('every route loads its standalone component', async () => {
    for (const route of BUSINESS_INTELLIGENCE_ROUTES) {
      const component = await (route.loadComponent as () => Promise<unknown>)();
      expect(component).toBeTruthy();
    }
    expect(BUSINESS_INTELLIGENCE_ROUTES.map((route) => route.path)).toEqual(['', 'dashboards/:id', 'explorer', 'queries', 'measures']);
  });

  it('reads the first validation message of a 422 and falls back to the summary', () => {
    const validation = new HttpErrorResponse({ status: 422, error: { message: 'Invalid', errors: { name: ['Name required'] } } });
    expect(apiErrorText(validation)).toBe('Name required');
    expect(apiErrorText(new HttpErrorResponse({ status: 422, error: { message: 'Invalid' } }))).toBe('Invalid');
    expect(apiErrorText(new Error('boom'))).toBeNull();
  });

  it('normalises blanks, numbers and dimension keys', () => {
    expect(blankToNull('  ')).toBeNull();
    expect(blankToNull(' a ')).toBe('a');
    expect(toNumber('12.50')).toBe(12.5);
    expect(toNumber('abc')).toBe(0);
    expect(dimensionKey('date:month')).toBe('date');
    expect(specDimensionKeys({ dimensions: ['date:month', 'customer'] } as never)).toEqual(['date', 'customer']);
    expect(formatBiValue(null, 'count')).toBe('');
    expect(formatBiValue(10, 'percent')).toContain('%');
  });

  it('builds chart points from the first dimension against the first measure', () => {
    const result = {
      columns: [
        { key: 'customer', kind: 'dimension' },
        { key: 'revenue', kind: 'measure' },
      ],
      rows: [
        { customer: 'Acme', revenue: '100.5' },
        { customer: null, revenue: '3' },
      ],
    } as unknown as BiQueryResult;

    expect(chartPoints(result)).toEqual([
      { label: 'Acme', value: 100.5, raw: 'Acme' },
      { label: '-', value: 3, raw: null },
    ]);
    expect(chartPoints(null)).toEqual([]);
  });
});
