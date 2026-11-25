import { describe, expect, it } from 'vitest';
import { LpProjection } from '@core';
import {
  AS_OF,
  dailyPoints,
  overview,
  projection,
  weeklyPoints,
} from './liquidity-planning.fixtures';
import {
  addDaysIso,
  buildCashOption,
  capitalTone,
  dscrTone,
  exportFileName,
  hasLevers,
  horizonOf,
  isBelow,
  LP_LEVER_SPECS,
  num,
  sanitizeLevers,
  sliceSeries,
  tierNet,
  toIsoDate,
} from './liquidity-planning.util';

const labels = {
  baseline: 'Baseline',
  scenario: 'Scenario',
  minimum: 'Minimum',
  tiers: { certain: 'Certain', probable: 'Probable', estimated: 'Estimated' },
};

const input = (patch: Partial<Parameters<typeof buildCashOption>[0]> = {}) => ({
  baseline: projection,
  scenario: null,
  asOf: AS_OF,
  horizon: 30 as const,
  granularity: 'daily' as const,
  showTiers: false,
  minimumBalance: 500,
  labels,
  currency: 'EUR',
  ...patch,
});

describe('liquidity planning util', () => {
  it('adds days across month and year ends without shifting through UTC', () => {
    expect(addDaysIso('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDaysIso('2027-03-01', -1)).toBe('2027-02-28');
    expect(toIsoDate(new Date(2027, 0, 5))).toBe('2027-01-05');
  });

  it('parses decimal strings and tolerates garbage', () => {
    expect(num('12.50')).toBe(12.5);
    expect(num(null)).toBe(0);
    expect(num('abc')).toBe(0);
  });

  it('slices the series to the horizon', () => {
    expect(sliceSeries(dailyPoints(180), AS_OF, 30)).toHaveLength(31);
    expect(sliceSeries(dailyPoints(180), AS_OF, 180)).toHaveLength(181);
    expect(sliceSeries(weeklyPoints(26), AS_OF, 30)).toHaveLength(5);
  });

  describe('sanitizeLevers', () => {
    it('clamps to the bounds and drops zero and empty levers', () => {
      expect(
        sanitizeLevers({
          collection_delay_days: 500,
          inflow_change_percent: -250,
          outflow_change_percent: 0,
          capex_acceleration_days: Number.NaN,
        }),
      ).toEqual({
        collection_delay_days: 180,
        collection_delay_share_percent: 100,
        inflow_change_percent: -100,
      });
    });

    it('keeps the financing only with an amount and a date', () => {
      expect(sanitizeLevers({ additional_financing_amount: 5000 })).toEqual({});
      expect(
        sanitizeLevers({
          additional_financing_amount: '5000',
          additional_financing_date: '2027-03-01',
        }),
      ).toEqual({ additional_financing_amount: 5000, additional_financing_date: '2027-03-01' });
    });

    it('keeps an explicit share of the delayed collections', () => {
      expect(
        sanitizeLevers({ collection_delay_days: 10, collection_delay_share_percent: 40 }),
      ).toEqual({
        collection_delay_days: 10,
        collection_delay_share_percent: 40,
      });
    });

    it('covers every lever with a bound', () => {
      expect(LP_LEVER_SPECS.map((spec) => spec.key)).toContain('raw_material_increase_percent');
      expect(LP_LEVER_SPECS.every((spec) => spec.min < spec.max)).toBe(true);
    });
  });

  it('tells a moving lever from a lone share', () => {
    expect(hasLevers(null)).toBe(false);
    expect(hasLevers({})).toBe(false);
    expect(hasLevers({ collection_delay_share_percent: 50 })).toBe(false);
    expect(hasLevers({ capex_acceleration_days: 30 })).toBe(true);
  });

  it('finds a horizon and computes the net of a tier', () => {
    expect(horizonOf(overview, 90)?.days).toBe(90);
    expect(horizonOf(null, 90)).toBeNull();
    expect(tierNet({ ...overview.horizons[0].baseline.tiers }, 'certain')).toBe(200);
  });

  describe('buildCashOption', () => {
    it('draws the baseline curve with the minimum balance line', () => {
      const option = buildCashOption(input()) as { series: { name: string; data: number[] }[] };

      expect(option.series).toHaveLength(1);
      expect(option.series[0].name).toBe('Baseline');
      expect(option.series[0].data).toHaveLength(31);
    });

    it('overlays the scenario when there is one', () => {
      const scenario: LpProjection = { ...projection, daily: dailyPoints(180, 500, 5) };
      const option = buildCashOption(input({ scenario })) as { series: { name: string }[] };

      expect(option.series.map((series) => series.name)).toEqual(['Baseline', 'Scenario']);
    });

    it('stacks the net flow of the three tiers on a second axis', () => {
      const option = buildCashOption(input({ showTiers: true })) as {
        series: { name: string; type: string; yAxisIndex?: number }[];
        yAxis: unknown[];
      };

      expect(option.yAxis).toHaveLength(2);
      expect(
        option.series.filter((series) => series.type === 'bar').map((series) => series.name),
      ).toEqual(['Certain', 'Probable', 'Estimated']);
    });

    it('uses the weekly series when asked', () => {
      const option = buildCashOption(input({ granularity: 'weekly', horizon: 90 })) as {
        xAxis: { data: string[] };
      };

      expect(option.xAxis.data.length).toBeLessThan(15);
    });
  });

  it('maps statuses to tones', () => {
    expect(dscrTone('healthy')).toBe('success');
    expect(dscrTone('warning')).toBe('warning');
    expect(dscrTone('critical')).toBe('error');
    expect(dscrTone('not_applicable')).toBe('default');
    expect(capitalTone('ok')).toBe('success');
    expect(capitalTone('half_capital_lost')).toBe('error');
  });

  it('compares a balance with the minimum and names the export', () => {
    expect(isBelow('100.00', '500.00')).toBe(true);
    expect(isBelow('900.00', '500.00')).toBe(false);
    expect(exportFileName('xlsx', AS_OF)).toBe('liquidity-plan-2027-01-04.xlsx');
  });
});
