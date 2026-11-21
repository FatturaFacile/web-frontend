import { describe, expect, it } from 'vitest';
import { chartOption, ChartContext } from './kpi-chart-options';
import { gaugeMax, heatmapCells, waterfallSteps } from './kpi-chart-options';
import { filterParams } from './kpi-dashboards-api.service';
import {
  DEFAULT_FILTERS,
  draftOf,
  formatValue,
  isImprovement,
  moveItem,
  nextWidth,
  packLayout,
  segmentFor,
  segmentForRow,
  trendOf,
} from './kpi-dashboards.utils';
import { widgetFixture } from './kpi-dashboards.testing';

const context: ChartContext = { t: (key) => key, format: (value) => String(value), dark: false };

describe('layout helpers', () => {
  it('packs widgets left to right and wraps at 12 columns', () => {
    const packed = packLayout([
      { kpi_code: 'a', widget_type: 'metric_card', w: 4, h: 3 },
      { kpi_code: 'b', widget_type: 'metric_card', w: 6, h: 2 },
      { kpi_code: 'c', widget_type: 'metric_card', w: 6, h: 4 },
      { kpi_code: 'd', widget_type: 'gauge', w: 12, h: 3 },
    ]);

    expect(packed.map((w) => [w.kpi_code, w.x, w.y, w.w])).toEqual([
      ['a', 0, 0, 4],
      ['b', 4, 0, 6],
      ['c', 0, 3, 6],
      ['d', 0, 7, 12],
    ]);
  });

  it('cycles the width 4 → 6 → 12 → 4', () => {
    expect([4, 6, 12].map(nextWidth)).toEqual([6, 12, 4]);
  });

  it('moves an item as a drag and drop does and ignores out of range moves', () => {
    expect(moveItem(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a']);
    expect(moveItem(['a', 'b'], 5, 0)).toEqual(['a', 'b']);
  });

  it('turns the widgets of a cockpit into an ordered draft', () => {
    const draft = draftOf([
      widgetFixture({ kpi_code: 'b', position: { x: 4, y: 0, w: 4, h: 3 } }),
      widgetFixture({ kpi_code: 'c', position: { x: 0, y: 3, w: 12, h: 3 } }),
      widgetFixture({ kpi_code: 'a', position: { x: 0, y: 0, w: 4, h: 3 } }),
    ]);

    expect(draft.map((w) => w.kpi_code)).toEqual(['a', 'b', 'c']);
  });
});

describe('filters', () => {
  it('sends the global filters as the query of the cockpit', () => {
    expect(
      filterParams({
        ...DEFAULT_FILTERS,
        preset: 'custom',
        from: '2026-01-01',
        to: '2026-03-31',
        currency: 'EUR',
        consolidated: true,
        companyIds: ['c1'],
      }),
    ).toMatchObject({
      preset: 'custom',
      from: '2026-01-01',
      to: '2026-03-31',
      currency: 'EUR',
      include_intercompany_eliminations: 1,
      company_ids: ['c1'],
      cost_center_ids: null,
    });
  });

  it('drops the custom dates for a preset period', () => {
    expect(
      filterParams({ ...DEFAULT_FILTERS, from: '2026-01-01', to: '2026-02-01' }),
    ).toMatchObject({ from: null, to: null });
  });
});

describe('formatting', () => {
  it('formats money, percent and an uncomputable value', () => {
    expect(formatValue(1250, 'currency', 'CHF', 'de-CH')).toContain('1');
    expect(formatValue(1250, 'currency', 'CHF', 'de-CH')).toContain('CHF');
    expect(formatValue(12.5, 'percent', 'CHF', 'en-US')).toBe('12.5 %');
    expect(formatValue(null, 'days', 'CHF', 'en-US')).toBe('–');
  });

  it('reads the trend and whether a change is an improvement for the KPI', () => {
    expect([trendOf(5), trendOf(-1), trendOf(0), trendOf(null)]).toEqual([
      'up',
      'down',
      'flat',
      'none',
    ]);
    expect(isImprovement('dso', -3)).toBe(true);
    expect(isImprovement('ebitda', -3)).toBe(false);
    expect(isImprovement('ebitda', 0)).toBeNull();
  });
});

describe('drill-down segments', () => {
  it('maps a month bar, an aging cell, a funnel stage and a table row to their segment', () => {
    expect(segmentFor(widgetFixture({ widget_type: 'area_trend' }), { name: '2026-02' })).toEqual({
      period: '2026-02',
    });
    expect(segmentFor(widgetFixture({ widget_type: 'area_trend' }), { name: 'abc' })).toEqual({});
    expect(segmentFor(widgetFixture({ widget_type: 'heatmap' }), { value: [1, 1, 500] })).toEqual({
      bucket: '1_30',
      side: 'payable',
    });
    expect(segmentFor(widgetFixture({ widget_type: 'heatmap' }), { value: [4, 0, 9] })).toEqual({
      bucket: 'over_90',
      side: 'receivable',
    });
    expect(
      segmentFor(
        widgetFixture({
          widget_type: 'funnel',
          data: { stages: [{ stage_id: 's1' }, { stage_id: 's2' }] },
        }),
        { dataIndex: 1 },
      ),
    ).toEqual({ stage_id: 's2' });
    expect(segmentForRow(widgetFixture({ data: { dimension: 'customer' } }), 'c1')).toEqual({
      contact_id: 'c1',
    });
    expect(segmentForRow(widgetFixture({ data: { dimension: 'product' } }), 'p1')).toEqual({
      product_id: 'p1',
    });
  });
});

describe('chart options', () => {
  it('builds the invisible base of a waterfall so steps float on the running sum', () => {
    expect(waterfallSteps(widgetFixture())).toEqual([
      { name: 'revenue', base: 0, up: 100000, down: 0, total: 0 },
      { name: 'cogs', base: 60000, up: 0, down: 40000, total: 0 },
      { name: 'opex', base: 40000, up: 0, down: 20000, total: 0 },
      { name: 'ebitda', base: 0, up: 0, down: 0, total: 40000 },
    ]);
  });

  it('puts receivables on the first row and payables on the second of the aging heatmap', () => {
    const cells = heatmapCells(
      widgetFixture({
        widget_type: 'heatmap',
        data: {
          receivables: { current: 5, '1_30': 20, '31_60': 0, '61_90': 10, over_90: 4 },
          payables: { current: 12 },
        },
      }),
    );

    expect(cells).toHaveLength(10);
    expect(cells[1]).toEqual([1, 0, 20]);
    expect(cells[5]).toEqual([0, 1, 12]);
  });

  it('draws every widget type except the card and the table', () => {
    const base = widgetFixture();

    expect(chartOption({ ...base, widget_type: 'waterfall_chart' }, context)).not.toBeNull();
    expect(chartOption({ ...base, widget_type: 'metric_card' }, context)).toBeNull();
    expect(chartOption({ ...base, widget_type: 'top_n_table' }, context)).toBeNull();

    const area = chartOption(
      {
        ...base,
        widget_type: 'area_trend',
        data: { series: [{ period: '2026-01', actual: 5, budget: 4 }] },
      },
      context,
    ) as { series: unknown[] };
    expect(area.series).toHaveLength(2);

    const funnel = chartOption(
      {
        ...base,
        widget_type: 'funnel',
        data: { stages: [{ stage: 'Qualified', weighted: 2500 }] },
      },
      context,
    ) as { series: { data: unknown[] }[] };
    expect(funnel.series[0]?.data).toEqual([{ name: 'Qualified', value: 2500 }]);

    expect(
      chartOption(
        { ...base, widget_type: 'gauge', value: 30, data: { unit: 'days', target: 45 } },
        context,
      ),
    ).not.toBeNull();
    expect(chartOption({ ...base, widget_type: 'heatmap', data: {} }, context)).not.toBeNull();
  });

  it('spans a gauge to twice its target, or to 100 for a percentage', () => {
    expect(gaugeMax(30, 45, 'days')).toBe(90);
    expect(gaugeMax(80, null, 'days')).toBe(96);
    expect(gaugeMax(60, 95, 'percent')).toBe(100);
  });
});
