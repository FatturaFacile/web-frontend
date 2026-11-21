import type { EChartsCoreOption } from 'echarts/core';
import { CockpitWidget } from './kpi-dashboards.models';
import { BUCKET_KEYS, bucketKey, unitOf } from './kpi-dashboards.utils';

export interface ChartContext {
  /** Translates a key of the dictionary. */
  t: (key: string) => string;
  /** Formats an amount or a ratio of this widget as the card does. */
  format: (value: number | null) => string;
  dark: boolean;
}

interface SeriesPoint {
  period: string;
  [key: string]: unknown;
}

/** Preference order of the numeric field that carries the value of a trend series. */
const SERIES_VALUE_KEYS = ['actual', 'value', 'margin_percent', 'rate', 'hours', 'net_burn'];

const PALETTE = {
  primary: '#1677ff',
  secondary: '#13a8a8',
  negative: '#cf1322',
  positive: '#389e0d',
  muted: '#8c8c8c',
};

function textColor(context: ChartContext): string {
  return context.dark ? '#d9d9d9' : '#434343';
}

/**
 * The ECharts option of a widget, or null for the widgets that are not drawn as a chart (metric card, Top-N table). Pure: the
 * same widget and context always give the same option, so the mapping from data to chart is covered by plain unit tests.
 */
export function chartOption(
  widget: CockpitWidget,
  context: ChartContext,
): EChartsCoreOption | null {
  switch (widget.widget_type) {
    case 'area_trend':
      return areaOption(widget, context);
    case 'waterfall_chart':
      return waterfallOption(widget, context);
    case 'funnel':
      return funnelOption(widget, context);
    case 'heatmap':
      return heatmapOption(widget, context);
    case 'gauge':
      return gaugeOption(widget, context);
    default:
      return null;
  }
}

function seriesOf(widget: CockpitWidget): SeriesPoint[] {
  const series = widget.data['series'];

  return Array.isArray(series) ? (series as SeriesPoint[]) : [];
}

function valueKeyOf(points: SeriesPoint[]): string {
  const first = points[0];

  return SERIES_VALUE_KEYS.find((key) => first !== undefined && key in first) ?? 'value';
}

function baseGrid(): EChartsCoreOption {
  return { grid: { left: 48, right: 16, top: 24, bottom: 28 }, animation: true };
}

function areaOption(widget: CockpitWidget, context: ChartContext): EChartsCoreOption {
  const points = seriesOf(widget);
  const key = valueKeyOf(points);
  const hasBudget = points.some((point) => typeof point['budget'] === 'number');
  const series: Record<string, unknown>[] = [
    {
      name: context.t('KPI_DASHBOARDS.SERIES_ACTUAL'),
      type: 'line',
      smooth: true,
      areaStyle: { opacity: 0.2 },
      color: PALETTE.primary,
      data: points.map((point) => point[key] ?? null),
    },
  ];

  if (hasBudget) {
    series.push({
      name: context.t('KPI_DASHBOARDS.SERIES_BUDGET'),
      type: 'line',
      lineStyle: { type: 'dashed' },
      color: PALETTE.muted,
      data: points.map((point) => point['budget'] ?? null),
    });
  }

  return {
    ...baseGrid(),
    textStyle: { color: textColor(context) },
    tooltip: {
      trigger: 'axis',
      valueFormatter: (value: unknown) => context.format(typeof value === 'number' ? value : null),
    },
    legend: hasBudget ? { bottom: 0, textStyle: { color: textColor(context) } } : undefined,
    xAxis: { type: 'category', data: points.map((point) => point.period), boundaryGap: false },
    yAxis: { type: 'value' },
    series,
  };
}

interface WaterfallStep {
  step: string;
  amount: number;
  is_total?: boolean;
}

/** A waterfall is a stacked bar whose first series is an invisible base: totals start at zero, steps float on the running sum. */
export function waterfallSteps(
  widget: CockpitWidget,
): { name: string; base: number; up: number; down: number; total: number }[] {
  const raw = widget.data['waterfall'];
  const steps = Array.isArray(raw) ? (raw as WaterfallStep[]) : [];
  let running = 0;

  return steps.map((step) => {
    if (step.is_total === true) {
      running = step.amount;

      return { name: step.step, base: 0, up: 0, down: 0, total: step.amount };
    }

    const start = running;
    running += step.amount;

    return {
      name: step.step,
      base: Math.min(start, running),
      up: step.amount >= 0 ? step.amount : 0,
      down: step.amount < 0 ? -step.amount : 0,
      total: 0,
    };
  });
}

function waterfallOption(widget: CockpitWidget, context: ChartContext): EChartsCoreOption {
  const steps = waterfallSteps(widget);
  const stack = (
    name: string,
    color: string,
    field: 'up' | 'down' | 'total',
  ): Record<string, unknown> => ({
    name,
    type: 'bar',
    stack: 'waterfall',
    color,
    data: steps.map((step) => step[field]),
  });

  return {
    ...baseGrid(),
    textStyle: { color: textColor(context) },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    xAxis: {
      type: 'category',
      data: steps.map((step) => context.t(`KPI_DASHBOARDS.STEP_${step.name.toUpperCase()}`)),
    },
    yAxis: { type: 'value' },
    series: [
      {
        name: 'base',
        type: 'bar',
        stack: 'waterfall',
        itemStyle: { color: 'transparent' },
        tooltip: { show: false },
        data: steps.map((step) => step.base),
      },
      stack(context.t('KPI_DASHBOARDS.SERIES_INCREASE'), PALETTE.positive, 'up'),
      stack(context.t('KPI_DASHBOARDS.SERIES_DECREASE'), PALETTE.negative, 'down'),
      stack(context.t('KPI_DASHBOARDS.SERIES_TOTAL'), PALETTE.primary, 'total'),
    ],
  };
}

interface Stage {
  stage: string;
  weighted: number;
  amount: number;
  stage_id: string | null;
}

function funnelOption(widget: CockpitWidget, context: ChartContext): EChartsCoreOption {
  const raw = widget.data['stages'];
  const stages = Array.isArray(raw) ? (raw as Stage[]) : [];

  return {
    textStyle: { color: textColor(context) },
    tooltip: {
      trigger: 'item',
      valueFormatter: (value: unknown) => context.format(typeof value === 'number' ? value : null),
    },
    series: [
      {
        type: 'funnel',
        sort: 'none',
        left: '8%',
        width: '84%',
        label: { color: textColor(context) },
        data: stages.map((stage) => ({ name: stage.stage, value: stage.weighted })),
      },
    ],
  };
}

/** Receivables on row 0, payables on row 1, one column per aging bucket. */
export function heatmapCells(widget: CockpitWidget): [number, number, number][] {
  const sides = ['receivables', 'payables'] as const;
  const cells: [number, number, number][] = [];

  sides.forEach((side, row) => {
    const values = widget.data[side] as Record<string, number> | undefined;

    BUCKET_KEYS.forEach((bucket, column) => {
      cells.push([column, row, values?.[bucket] ?? 0]);
    });
  });

  return cells;
}

function heatmapOption(widget: CockpitWidget, context: ChartContext): EChartsCoreOption {
  const cells = heatmapCells(widget);
  const max = Math.max(1, ...cells.map((cell) => cell[2]));

  return {
    textStyle: { color: textColor(context) },
    tooltip: {
      position: 'top',
      formatter: (params: { value: [number, number, number] }) => context.format(params.value[2]),
    },
    grid: { left: 90, right: 16, top: 8, bottom: 48 },
    xAxis: {
      type: 'category',
      data: BUCKET_KEYS.map((bucket) => context.t(bucketKey(bucket))),
      splitArea: { show: true },
    },
    yAxis: {
      type: 'category',
      data: [
        context.t('KPI_DASHBOARDS.SIDE_RECEIVABLES'),
        context.t('KPI_DASHBOARDS.SIDE_PAYABLES'),
      ],
      splitArea: { show: true },
    },
    visualMap: {
      min: 0,
      max,
      calculable: false,
      orient: 'horizontal',
      left: 'center',
      bottom: 0,
      inRange: { color: ['#e6f4ff', '#1677ff'] },
      textStyle: { color: textColor(context) },
    },
    series: [
      {
        type: 'heatmap',
        data: cells,
        label: {
          show: true,
          formatter: (params: { value: [number, number, number] }) =>
            context.format(params.value[2]),
        },
      },
    ],
  };
}

/** A gauge spans 0 to twice its target (or 120 % of the value without a target) so the needle has room on both sides. */
export function gaugeMax(value: number | null, target: number | null, unit: string): number {
  if (unit === 'percent') {
    return 100;
  }

  const reference = Math.max(target ?? 0, value ?? 0, 1);

  return Math.ceil(target !== null ? target * 2 : reference * 1.2);
}

function gaugeOption(widget: CockpitWidget, context: ChartContext): EChartsCoreOption {
  const target = typeof widget.data['target'] === 'number' ? widget.data['target'] : null;
  const unit = unitOf(widget);
  const max = gaugeMax(widget.value, target, unit);

  return {
    series: [
      {
        type: 'gauge',
        min: 0,
        max,
        radius: '95%',
        progress: { show: true, width: 12 },
        axisLine: { lineStyle: { width: 12, color: [[1, PALETTE.primary]] } },
        axisLabel: { color: textColor(context), distance: 18 },
        detail: {
          valueAnimation: true,
          formatter: () => context.format(widget.value),
          color: textColor(context),
          fontSize: 18,
          offsetCenter: [0, '65%'],
        },
        data: [{ value: widget.value ?? 0 }],
      },
    ],
  };
}
