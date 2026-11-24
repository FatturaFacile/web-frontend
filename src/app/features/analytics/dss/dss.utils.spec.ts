import { describe, expect, it } from 'vitest';
import { alertFixture, bridgeFixture, matrixFixture } from './dss.testing';
import { DssFilterState, VarianceBridgeStep } from './dss.models';
import {
  alertDrillTarget,
  boardPackLocale,
  bridgeDrillMetric,
  DEFAULT_FILTER,
  dimensionEntityType,
  erodingRows,
  filterFromQueryParams,
  filterToBody,
  filterToParams,
  filterToQueryParams,
  formatDeltaPct,
  formatKpiValue,
  fromIsoDay,
  isNeutralScenario,
  kpiDrillMetric,
  marginTone,
  sameFilter,
  sparklinePoints,
  targetProgress,
  toIsoDay,
  waterfallBars,
  waterfallOption,
  whaleCurveOption,
} from './dss.utils';

const filter = (overrides: Partial<DssFilterState> = {}): DssFilterState => ({
  ...DEFAULT_FILTER,
  ...overrides,
});

const labels = {
  step: (key: string) => key,
  format: (value: number) => String(value),
  increase: 'up',
  decrease: 'down',
  total: 'total',
};

describe('filter transport', () => {
  it('sends the default filter as query parameters', () => {
    const params = filterToParams(filter());

    expect(params.get('currency')).toBe('CHF');
    expect(params.get('period_preset')).toBe('YTD');
    expect(params.get('comparison_baseline')).toBe('PRIOR_YEAR');
    expect(params.has('date_from')).toBe(false);
    expect(params.has('legal_entity_ids[]')).toBe(false);
  });

  it('sends arrays in the Laravel form and the custom range only for a custom period', () => {
    const custom = filterToParams(
      filter({
        periodPreset: 'CUSTOM',
        customDateRange: ['2028-02-01', '2028-02-29'],
        legalEntityIds: ['a', 'b'],
        costCenterIds: ['c'],
      }),
    );

    expect(custom.getAll('legal_entity_ids[]')).toEqual(['a', 'b']);
    expect(custom.getAll('cost_center_ids[]')).toEqual(['c']);
    expect(custom.get('date_from')).toBe('2028-02-01');
    expect(custom.get('date_to')).toBe('2028-02-29');
    // The range is kept while another preset is on, but not sent.
    expect(
      filterToParams(filter({ customDateRange: ['2028-02-01', '2028-02-29'] })).has('date_from'),
    ).toBe(false);
  });

  it('sends the same filter as a JSON body without empty lists', () => {
    expect(filterToBody(filter())).toEqual({
      currency: 'CHF',
      period_preset: 'YTD',
      comparison_baseline: 'PRIOR_YEAR',
    });
    expect(filterToBody(filter({ reportingCurrency: 'EUR', legalEntityIds: ['a'] }))).toMatchObject(
      { currency: 'EUR', legal_entity_ids: ['a'] },
    );
  });
});

describe('URL round trip', () => {
  it('leaves the defaults out of the URL', () => {
    expect(Object.values(filterToQueryParams(filter())).every((value) => value === null)).toBe(
      true,
    );
  });

  it('writes and reads back a complete filter', () => {
    const original = filter({
      legalEntityIds: ['a', 'b'],
      costCenterIds: ['c'],
      reportingCurrency: 'EUR',
      periodPreset: 'CUSTOM',
      customDateRange: ['2028-02-01', '2028-02-29'],
      comparisonBaseline: 'BUDGET',
    });
    const params = filterToQueryParams(original);
    const parsed = filterFromQueryParams(
      Object.fromEntries(Object.entries(params).filter(([, value]) => value !== null)),
    );

    expect(params).toMatchObject({
      entities: 'a,b',
      centers: 'c',
      cur: 'EUR',
      period: 'CUSTOM',
      from: '2028-02-01',
      to: '2028-02-29',
      base: 'BUDGET',
    });
    expect(parsed).toEqual(original);
    expect(sameFilter(parsed, original)).toBe(true);
  });

  it('falls back to the defaults for anything invalid', () => {
    const parsed = filterFromQueryParams({
      cur: 'USD',
      period: 'WEEK',
      base: 'FORECAST',
      entities: '',
    });

    expect(parsed).toEqual(DEFAULT_FILTER);
  });

  it('refuses a custom period without a valid range', () => {
    expect(filterFromQueryParams({ period: 'CUSTOM' }).periodPreset).toBe('YTD');
    expect(
      filterFromQueryParams({ period: 'CUSTOM', from: '2028-03-01', to: '2028-02-01' })
        .periodPreset,
    ).toBe('YTD');
    expect(
      filterFromQueryParams({ period: 'CUSTOM', from: 'x', to: 'y' }).customDateRange,
    ).toBeNull();
  });

  it('takes the first value of a repeated parameter', () => {
    expect(filterFromQueryParams({ cur: ['EUR', 'CHF'] }).reportingCurrency).toBe('EUR');
  });

  it('converts days without a time zone shift', () => {
    expect(toIsoDay(fromIsoDay('2028-03-01'))).toBe('2028-03-01');
    expect(toIsoDay(new Date(2028, 0, 5))).toBe('2028-01-05');
  });
});

describe('formatting', () => {
  it('formats an indicator in its unit', () => {
    expect(formatKpiValue({ unit: 'percent', value: 60 }, 'CHF', 'en')).toBe('60%');
    expect(formatKpiValue({ unit: 'days', value: 54.3 }, 'CHF', 'en')).toBe('54.3');
    expect(formatKpiValue({ unit: 'ratio', value: 4.256 }, 'CHF', 'en')).toBe('4.26');
    expect(formatKpiValue({ unit: 'currency', value: 1000 }, 'CHF', 'en')).toContain('1,000');
    expect(formatKpiValue({ unit: 'currency', value: null }, 'CHF', 'en')).toBe('–');
  });

  it('signs the change and shows a dash without a comparison', () => {
    expect(formatDeltaPct(25, 'en')).toBe('+25%');
    expect(formatDeltaPct(-7.7, 'en')).toBe('-7.7%');
    expect(formatDeltaPct(0, 'en')).toBe('0%');
    expect(formatDeltaPct(null)).toBe('–');
  });

  it('scales a sparkline into its box and handles one point and none', () => {
    expect(sparklinePoints([])).toBe('');
    expect(sparklinePoints([5], 96, 28)).toBe('48,26');
    const [first, last] = sparklinePoints([0, 10], 96, 28).split(' ');

    // The lowest value sits at the bottom, the highest at the top.
    expect(first).toBe('0,26');
    expect(last).toBe('96,2');
  });

  it('measures the progress to a target between 0 and 100', () => {
    expect(targetProgress(50, 100)).toBe(50);
    expect(targetProgress(150, 100)).toBe(100);
    expect(targetProgress(-5, 100)).toBe(0);
    expect(targetProgress(10, null)).toBeNull();
    expect(targetProgress(null, 10)).toBeNull();
    expect(targetProgress(10, 0)).toBeNull();
  });

  it('classifies margins', () => {
    expect(marginTone(-1)).toBe('negative');
    expect(marginTone(5)).toBe('low');
    expect(marginTone(25)).toBe('healthy');
  });
});

describe('waterfall', () => {
  it('floats each delta between the running totals', () => {
    const bars = waterfallBars(bridgeFixture().ebitda_bridge);

    expect(bars[0]).toEqual({ base: 0, positive: 200, negative: 0, kind: 'total' });
    expect(bars[1]).toEqual({ base: 200, positive: 80, negative: 0, kind: 'increase' });
    expect(bars[3]).toEqual({ base: 340, positive: 60, negative: 0, kind: 'decrease' });
    expect(bars[6]).toEqual({ base: 0, positive: 320, negative: 0, kind: 'total' });
  });

  it('splits a bar that crosses zero and floats one that stays below zero', () => {
    const steps: VarianceBridgeStep[] = [
      { key: 'baseline', type: 'total', value: -50, cumulative: -50 },
      { key: 'volume', type: 'delta', value: 120, cumulative: 70 },
      { key: 'price', type: 'delta', value: -150, cumulative: -80 },
      { key: 'cogs', type: 'delta', value: -20, cumulative: -100 },
      { key: 'actual', type: 'total', value: -100, cumulative: -100 },
    ];
    const bars = waterfallBars(steps);

    expect(bars[0]).toEqual({ base: 0, positive: 0, negative: -50, kind: 'total' });
    // -50 -> +70 crosses zero: 70 above and 50 below.
    expect(bars[1]).toEqual({ base: 0, positive: 70, negative: -50, kind: 'increase' });
    // +70 -> -80 crosses zero too.
    expect(bars[2]).toEqual({ base: 0, positive: 70, negative: -80, kind: 'decrease' });
    // -80 -> -100 stays below: the invisible base is the upper end, the bar 20 further down.
    expect(bars[3]).toEqual({ base: -80, positive: 0, negative: -20, kind: 'decrease' });
  });

  it('builds a stacked bar option with an invisible base and one series per colour and sign', () => {
    const option = waterfallOption(bridgeFixture().ebitda_bridge, labels) as {
      xAxis: { data: string[] };
      series: { name: string; itemStyle: { color: string }; data: (number | null)[] }[];
    };

    expect(option.xAxis.data).toEqual([
      'baseline',
      'volume',
      'price',
      'cogs',
      'opex',
      'fx',
      'actual',
    ]);
    expect(option.series[0].itemStyle.color).toBe('transparent');
    expect(option.series).toHaveLength(7);
    const increase = option.series.find(
      (series) => series.name === 'up' && series.data.some((value) => value !== null),
    );

    expect(increase?.data).toEqual([null, 80, 120, null, null, null, null]);
  });

  it('shows the cumulative value in the tooltip of a delta', () => {
    const option = waterfallOption(bridgeFixture().ebitda_bridge, labels) as {
      tooltip: { formatter: (params: unknown) => string };
    };

    expect(option.tooltip.formatter([{ dataIndex: 1 }])).toBe('volume<br/>80 → 280');
    expect(option.tooltip.formatter([{ dataIndex: 0 }])).toBe('baseline<br/>200');
  });
});

describe('whale curve', () => {
  const wlabels = {
    profit: 'Profit',
    pareto: '80/20',
    total: '100%',
    format: (value: number) => String(value),
  };

  it('draws the cumulative profit with the 100% line and the Pareto cut-off, loss makers in red', () => {
    const matrix = matrixFixture();
    const option = whaleCurveOption(matrix.whale_curve, matrix.pareto_cutoff_rank, wlabels) as {
      xAxis: { data: number[] };
      series: {
        data: { value: number; itemStyle: { color: string } }[];
        markLine: { data: Record<string, unknown>[] };
      }[];
    };

    expect(option.xAxis.data).toEqual([1, 2]);
    expect(option.series[0].data.map((point) => point.value)).toEqual([112.5, 100]);
    expect(option.series[0].data.map((point) => point.itemStyle.color)).toEqual([
      '#1677ff',
      '#f5222d',
    ]);
    expect(option.series[0].markLine.data).toHaveLength(2);
    expect(option.series[0].markLine.data[0]).toMatchObject({ yAxis: 100 });
    expect(option.series[0].markLine.data[1]).toMatchObject({ xAxis: 0 });
  });

  it('draws no cut-off line when there is no profit to split', () => {
    const matrix = matrixFixture({ pareto_cutoff_rank: 0 });
    const option = whaleCurveOption(matrix.whale_curve, 0, wlabels) as {
      series: { markLine: { data: unknown[] } }[];
    };

    expect(option.series[0].markLine.data).toHaveLength(1);
  });

  it('lists the rows that erode the profit', () => {
    expect(erodingRows(matrixFixture().rows).map((row) => row.key)).toEqual(['cust-2']);
  });
});

describe('drill-down mapping', () => {
  it('knows the ledger metric behind an indicator', () => {
    expect(kpiDrillMetric('revenue')).toBe('revenue');
    expect(kpiDrillMetric('net_cash_flow')).toBe('cash');
    expect(kpiDrillMetric('average_dso')).toBe('receivable');
    expect(kpiDrillMetric('quote_win_rate')).toBeNull();
  });

  it('maps a bridge bar to revenue, cost of goods or opex', () => {
    expect(bridgeDrillMetric('cogs')).toBe('cogs');
    expect(bridgeDrillMetric('opex')).toBe('opex');
    expect(bridgeDrillMetric('price')).toBe('revenue');
    expect(bridgeDrillMetric('fx')).toBe('revenue');
  });

  it('allows the drill-down of the dimensions the ledger knows', () => {
    expect(dimensionEntityType('customer')).toBe('customer');
    expect(dimensionEntityType('cost_center')).toBe('cost_center');
    expect(dimensionEntityType('legal_entity')).toBe('legal_entity');
    expect(dimensionEntityType('product')).toBeNull();
    expect(dimensionEntityType('channel')).toBeNull();
  });

  it('opens the customer of a concentration alert and the metric of the other alerts', () => {
    expect(alertDrillTarget(alertFixture(), 'x')).toEqual({
      metric: 'revenue',
      entityType: 'customer',
      entityId: 'cust-1',
      label: 'x',
    });
    expect(alertDrillTarget(alertFixture({ context: {} }), 'x')).toMatchObject({
      metric: 'revenue',
      entityType: null,
    });
    expect(alertDrillTarget(alertFixture({ code: 'margin_erosion' }), 'x')?.metric).toBe('cogs');
    expect(alertDrillTarget(alertFixture({ code: 'dso_spike' }), 'x')?.metric).toBe('receivable');
    expect(
      alertDrillTarget(alertFixture({ code: 'budget_overrun', metric: 'cogs' }), 'x')?.metric,
    ).toBe('cogs');
    expect(
      alertDrillTarget(alertFixture({ code: 'budget_overrun', metric: 'opex' }), 'x')?.metric,
    ).toBe('opex');
    expect(
      alertDrillTarget(alertFixture({ code: 'statistical_outlier', metric: 'net_cash_flow' }), 'x')
        ?.metric,
    ).toBe('cash');
    expect(
      alertDrillTarget(alertFixture({ code: 'statistical_outlier', metric: 'revenue' }), 'x')
        ?.metric,
    ).toBe('revenue');
  });
});

describe('board pack and scenario', () => {
  it('picks the board pack language from the user language and the currency', () => {
    expect(boardPackLocale('de', 'EUR')).toBe('de-CH');
    expect(boardPackLocale('fr', 'CHF')).toBe('fr-CH');
    expect(boardPackLocale('it', 'CHF')).toBe('it-CH');
    expect(boardPackLocale('it', 'EUR')).toBe('it-IT');
    expect(boardPackLocale('en', 'CHF')).toBe('en');
  });

  it('tells a neutral scenario', () => {
    expect(
      isNeutralScenario({
        price_pct: 0,
        cogs_pct: 0,
        opex_pct: 0,
        dso_days_delta: 0,
        fx_shift_pct: 0,
        fte_delta: 0,
      }),
    ).toBe(true);
    expect(
      isNeutralScenario({
        price_pct: 1,
        cogs_pct: 0,
        opex_pct: 0,
        dso_days_delta: 0,
        fx_shift_pct: 0,
        fte_delta: 0,
      }),
    ).toBe(false);
  });
});
