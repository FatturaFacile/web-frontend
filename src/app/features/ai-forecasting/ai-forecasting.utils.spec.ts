import { describe, expect, it } from 'vitest';
import { bandsFixture, projections, skuForecastFixture } from './ai-forecasting.testing';
import {
  DEFAULT_WHAT_IF,
  demandChartOption,
  eventLabelsByDate,
  fanChartOption,
  isNeutralWhatIf,
  needsApply,
  riskTierColor,
  runwayDays,
  runwayFromBands,
  totalSales,
} from './ai-forecasting.utils';

const labels = {
  p10: 'P10',
  p50: 'P50',
  p90: 'P90',
  event: (code: string) => `event ${code}`,
  format: (value: number) => `CHF ${value}`,
};

interface Series {
  name: string;
  type: string;
  stack?: string;
  data: number[];
  markPoint?: { data: { name: string; coord: [number, number] }[] };
}

describe('ai forecasting utils', () => {
  it('colours the risk tiers from green to red', () => {
    expect(riskTierColor('low')).toBe('green');
    expect(riskTierColor('moderate')).toBe('gold');
    expect(riskTierColor('high')).toBe('orange');
    expect(riskTierColor('critical')).toBe('red');
  });

  it('knows a neutral what-if', () => {
    expect(isNeutralWhatIf(DEFAULT_WHAT_IF)).toBe(true);
    expect(isNeutralWhatIf({ ...DEFAULT_WHAT_IF, global_customer_delay_shift_days: 15 })).toBe(
      false,
    );
    expect(isNeutralWhatIf({ ...DEFAULT_WHAT_IF, supplier_payment_extension_days: 5 })).toBe(false);
    expect(isNeutralWhatIf({ ...DEFAULT_WHAT_IF, revenue_growth_percentage: -10 })).toBe(false);
  });

  it('counts the days until the expected balance turns negative', () => {
    expect(runwayDays(projections(5, 2000, 500))).toBe(5);
    expect(runwayDays(projections(5, 10000, 500))).toBeNull();
    expect(runwayFromBands({ p50: [100, 50, -1] })).toBe(3);
    expect(runwayFromBands({ p50: [100, 50] })).toBeNull();
  });

  it('joins the statutory events of the same day into one label', () => {
    const labelsByDate = eventLabelsByDate(
      [
        {
          date: '2028-06-30',
          nominal_date: '2028-06-30',
          code: 'TAX_ADVANCE_JUN',
          category: 'tax',
          amount: 1,
        },
        {
          date: '2028-06-30',
          nominal_date: '2028-06-30',
          code: 'SALARY_14TH',
          category: 'payroll',
          amount: 1,
        },
        { date: '2028-07-17', nominal_date: '2028-07-16', code: 'F24', category: 'tax', amount: 1 },
      ],
      (code) => code,
    );

    expect(labelsByDate.get('2028-06-30')).toBe('TAX_ADVANCE_JUN + SALARY_14TH');
    expect(labelsByDate.get('2028-07-17')).toBe('F24');
  });

  describe('fan chart', () => {
    const option = fanChartOption(bandsFixture(), labels) as unknown as {
      series: Series[];
      xAxis: { data: string[] };
      yAxis: { axisLabel: { formatter: (value: number) => string } };
      tooltip: { formatter: (params: unknown) => string };
    };

    it('draws the p10 base, the p90-p10 band and the p50 line', () => {
      expect(option.series.map((series) => series.name)).toEqual(['P10', 'P90', 'P50']);
      expect(option.series[0].stack).toBe('band');
      expect(option.series[1].stack).toBe('band');
      expect(option.series[2].stack).toBeUndefined();
      expect(option.xAxis.data).toHaveLength(5);
    });

    it('keeps the stacked values non-negative by shifting the balances below zero', () => {
      // The lowest p10 of the fixture is -1,500 (the p50 reaches -500 on the last day).
      const bands = bandsFixture();
      const offset = Math.min(0, ...bands.p10);

      expect(Math.min(...option.series[0].data)).toBe(0);
      expect(option.series[0].data).toEqual(bands.p10.map((value) => value - offset));
      expect(option.series[1].data).toEqual(
        bands.p90.map((value, index) => value - bands.p10[index]),
      );
      // The axis undoes the shift, so it shows real balances.
      expect(option.yAxis.axisLabel.formatter(-offset)).toBe('CHF 0');
    });

    it('marks the statutory event on the expected line, on its day', () => {
      const markers = option.series[2].markPoint?.data ?? [];

      expect(markers).toHaveLength(1);
      expect(markers[0].name).toBe('event F24');
      expect(markers[0].coord[0]).toBe(2);
    });

    it('prints the three quantiles of a day in the tooltip', () => {
      const text = option.tooltip.formatter([{ dataIndex: 1 }]);

      expect(text).toContain('P90: CHF 1500');
      expect(text).toContain('P50: CHF 1000');
      expect(text).toContain('P10: CHF 500');
    });

    it('does not mark an event outside the plotted days', () => {
      const bands = bandsFixture({
        statutoryEvents: [
          {
            date: '2030-01-01',
            nominal_date: '2030-01-01',
            code: 'F24',
            category: 'tax',
            amount: 1,
          },
        ],
      });
      const other = fanChartOption(bands, labels) as unknown as { series: Series[] };

      expect(other.series[2].markPoint?.data).toEqual([]);
    });
  });

  describe('demand chart', () => {
    it('puts the history as bars and the forecast with its bounds on the forecast month', () => {
      const option = demandChartOption(skuForecastFixture(), {
        actual: 'Actual',
        forecast: 'Forecast',
        lower: 'Lower',
        upper: 'Upper',
      }) as unknown as {
        xAxis: { data: string[] };
        series: { name: string; data: (number | null)[] }[];
      };

      expect(option.xAxis.data).toEqual(['2027-11', '2027-12', '2028-01']);
      expect(option.series[0].data).toEqual([180, 140, null]);
      expect(option.series[1].data).toEqual([null, null, 150]);
      expect(option.series[2].data).toEqual([null, null, 120]);
      expect(option.series[3].data).toEqual([null, null, 180]);
    });

    it('totals the history', () => {
      expect(totalSales(skuForecastFixture())).toBe(320);
    });
  });

  describe('needsApply', () => {
    it('is true when the recommendation differs from the warehouse thresholds', () => {
      expect(needsApply(skuForecastFixture())).toBe(true);
      expect(needsApply(skuForecastFixture({ current_reorder_point: null }))).toBe(true);
    });

    it('is false once applied, or when the thresholds already match', () => {
      expect(needsApply(skuForecastFixture({ applied_to_wms_at: '2028-01-02T00:00:00Z' }))).toBe(
        false,
      );
      expect(
        needsApply(skuForecastFixture({ current_reorder_point: 145.4, current_safety_stock: 61 })),
      ).toBe(false);
    });
  });
});
