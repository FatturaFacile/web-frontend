import { HttpParams } from '@angular/common/http';
import type { EChartsCoreOption } from 'echarts/core';
import {
  BalancedScorecardKpi,
  ComparisonBaseline,
  DrillEntityType,
  DrillMetric,
  DrillTarget,
  DssFilterState,
  ExecutiveAlert,
  PeriodPreset,
  ProfitabilityDimension,
  ProfitabilityMatrixRow,
  ReportingCurrency,
  VarianceBridgeStep,
  VarianceStepKey,
  WhaleCurvePoint,
  WhatIfScenario,
} from './dss.models';

export const PERIOD_PRESETS: readonly PeriodPreset[] = ['MTD', 'QTD', 'YTD', 'L12M', 'CUSTOM'];
export const COMPARISON_BASELINES: readonly ComparisonBaseline[] = [
  'PRIOR_PERIOD',
  'PRIOR_YEAR',
  'BUDGET',
];
export const REPORTING_CURRENCIES: readonly ReportingCurrency[] = ['CHF', 'EUR'];

export const DEFAULT_FILTER: DssFilterState = {
  legalEntityIds: [],
  reportingCurrency: 'CHF',
  periodPreset: 'YTD',
  customDateRange: null,
  comparisonBaseline: 'PRIOR_YEAR',
  costCenterIds: [],
};

export const DEFAULT_SCENARIO: WhatIfScenario = {
  price_pct: 0,
  cogs_pct: 0,
  opex_pct: 0,
  dso_days_delta: 0,
  fx_shift_pct: 0,
  fte_delta: 0,
};

/** Slider ranges of the simulator (within what the API accepts). */
export const SCENARIO_RANGES: Readonly<
  Record<keyof WhatIfScenario, { min: number; max: number; step: number }>
> = {
  price_pct: { min: -30, max: 30, step: 0.5 },
  cogs_pct: { min: -30, max: 30, step: 0.5 },
  opex_pct: { min: -30, max: 30, step: 0.5 },
  dso_days_delta: { min: -60, max: 60, step: 1 },
  fx_shift_pct: { min: -20, max: 20, step: 0.5 },
  fte_delta: { min: -20, max: 20, step: 1 },
};

export function isNeutralScenario(scenario: WhatIfScenario): boolean {
  return Object.values(scenario).every((value) => value === 0);
}

/** Filter parameters of a GET: arrays use the `name[]` form of Laravel. */
export function filterToParams(filter: DssFilterState): HttpParams {
  let params = new HttpParams()
    .set('currency', filter.reportingCurrency)
    .set('period_preset', filter.periodPreset)
    .set('comparison_baseline', filter.comparisonBaseline);

  if (filter.periodPreset === 'CUSTOM' && filter.customDateRange !== null) {
    params = params
      .set('date_from', filter.customDateRange[0])
      .set('date_to', filter.customDateRange[1]);
  }

  for (const id of filter.legalEntityIds) {
    params = params.append('legal_entity_ids[]', id);
  }

  for (const id of filter.costCenterIds) {
    params = params.append('cost_center_ids[]', id);
  }

  return params;
}

/** The same filter as a JSON body (POST endpoints). */
export function filterToBody(filter: DssFilterState): Record<string, unknown> {
  return {
    currency: filter.reportingCurrency,
    period_preset: filter.periodPreset,
    comparison_baseline: filter.comparisonBaseline,
    ...(filter.periodPreset === 'CUSTOM' && filter.customDateRange !== null
      ? { date_from: filter.customDateRange[0], date_to: filter.customDateRange[1] }
      : {}),
    ...(filter.legalEntityIds.length > 0 ? { legal_entity_ids: filter.legalEntityIds } : {}),
    ...(filter.costCenterIds.length > 0 ? { cost_center_ids: filter.costCenterIds } : {}),
  };
}

type QueryValue = string | readonly string[] | null | undefined;

/** Query parameters that describe the filter, so a view can be shared or bookmarked. Defaults are left out. */
export function filterToQueryParams(filter: DssFilterState): Record<string, string | null> {
  const custom = filter.periodPreset === 'CUSTOM' ? filter.customDateRange : null;

  return {
    entities: filter.legalEntityIds.length > 0 ? filter.legalEntityIds.join(',') : null,
    centers: filter.costCenterIds.length > 0 ? filter.costCenterIds.join(',') : null,
    cur:
      filter.reportingCurrency !== DEFAULT_FILTER.reportingCurrency
        ? filter.reportingCurrency
        : null,
    period: filter.periodPreset !== DEFAULT_FILTER.periodPreset ? filter.periodPreset : null,
    from: custom?.[0] ?? null,
    to: custom?.[1] ?? null,
    base:
      filter.comparisonBaseline !== DEFAULT_FILTER.comparisonBaseline
        ? filter.comparisonBaseline
        : null,
  };
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

function first(value: QueryValue): string | null {
  const text = Array.isArray(value) ? value[0] : value;

  return typeof text === 'string' && text !== '' ? text : null;
}

function list(value: QueryValue): string[] {
  const text = first(value);

  return text === null ? [] : text.split(',').filter((id) => id !== '');
}

/** The filter described by query parameters; anything invalid falls back to the default. */
export function filterFromQueryParams(params: Record<string, QueryValue>): DssFilterState {
  const currency = first(params['cur']);
  const preset = first(params['period']);
  const baseline = first(params['base']);
  const from = first(params['from']);
  const to = first(params['to']);
  const periodPreset =
    PERIOD_PRESETS.find((candidate) => candidate === preset) ?? DEFAULT_FILTER.periodPreset;
  const range =
    from !== null && to !== null && ISO_DAY.test(from) && ISO_DAY.test(to) && from <= to
      ? ([from, to] as [string, string])
      : null;

  return {
    legalEntityIds: list(params['entities']),
    costCenterIds: list(params['centers']),
    reportingCurrency:
      REPORTING_CURRENCIES.find((candidate) => candidate === currency) ??
      DEFAULT_FILTER.reportingCurrency,
    // A custom period without a valid range cannot be queried.
    periodPreset:
      periodPreset === 'CUSTOM' && range === null ? DEFAULT_FILTER.periodPreset : periodPreset,
    customDateRange: periodPreset === 'CUSTOM' ? range : null,
    comparisonBaseline:
      COMPARISON_BASELINES.find((candidate) => candidate === baseline) ??
      DEFAULT_FILTER.comparisonBaseline,
  };
}

export function sameFilter(a: DssFilterState, b: DssFilterState): boolean {
  return JSON.stringify(filterToQueryParams(a)) === JSON.stringify(filterToQueryParams(b));
}

export function formatAmount(value: number, currency: ReportingCurrency, locale?: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

/** The value of an indicator in its unit; a dash while the indicator has no data. */
export function formatKpiValue(
  kpi: Pick<BalancedScorecardKpi, 'unit' | 'value'>,
  currency: ReportingCurrency,
  locale?: string,
): string {
  if (kpi.value === null) {
    return '–';
  }

  switch (kpi.unit) {
    case 'currency':
      return formatAmount(kpi.value, currency, locale);
    case 'percent':
      return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(kpi.value)}%`;
    case 'days':
      return new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(kpi.value);
    default:
      return new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(kpi.value);
  }
}

export function formatDeltaPct(deltaPct: number | null, locale?: string): string {
  if (deltaPct === null) {
    return '–';
  }

  const text = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 1,
    signDisplay: 'exceptZero',
  }).format(deltaPct);

  return `${text}%`;
}

/** Points of an inline sparkline (an SVG `polyline`) for a series, scaled into `width` x `height`. */
export function sparklinePoints(values: readonly number[], width = 96, height = 28): string {
  if (values.length === 0) {
    return '';
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const step = values.length > 1 ? width / (values.length - 1) : 0;

  return values
    .map((value, index) => {
      const x = values.length > 1 ? index * step : width / 2;
      const y = height - 2 - ((value - min) / span) * (height - 4);

      return `${round(x)},${round(y)}`;
    })
    .join(' ');
}

/** Share of a target reached, clamped to 0..100, for the target gauge; null without a target. */
export function targetProgress(value: number | null, target: number | null): number | null {
  if (value === null || target === null || target === 0) {
    return null;
  }

  return Math.min(Math.max(Math.round((value / target) * 100), 0), 100);
}

/** Colour class of a margin: red below zero, amber under 10%, green otherwise. */
export function marginTone(pct: number): 'negative' | 'low' | 'healthy' {
  if (pct < 0) {
    return 'negative';
  }

  return pct < 10 ? 'low' : 'healthy';
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

export interface WaterfallLabels {
  /** Name of each step key, in the language of the user. */
  step: (key: string) => string;
  format: (value: number) => string;
  increase: string;
  decrease: string;
  total: string;
}

interface WaterfallBar {
  base: number;
  positive: number;
  negative: number;
  kind: 'total' | 'increase' | 'decrease';
}

/**
 * Stacked-bar parts of a bridge. A delta floats between the running totals before and after it; a bar that crosses the zero
 * line is split into its positive and negative part, as ECharts stacks the two signs apart.
 */
export function waterfallBars(steps: readonly VarianceBridgeStep[]): WaterfallBar[] {
  let previous = 0;

  return steps.map((step) => {
    if (step.type === 'total') {
      previous = step.cumulative;

      return {
        base: 0,
        positive: Math.max(step.value, 0),
        negative: Math.min(step.value, 0),
        kind: 'total',
      };
    }

    const low = Math.min(previous, step.cumulative);
    const high = Math.max(previous, step.cumulative);
    previous = step.cumulative;
    const kind = step.value >= 0 ? 'increase' : 'decrease';

    if (low >= 0) {
      return { base: low, positive: high - low, negative: 0, kind };
    }

    if (high <= 0) {
      return { base: high, positive: 0, negative: low - high, kind };
    }

    return { base: 0, positive: high, negative: low, kind };
  });
}

export const WATERFALL_COLORS = {
  total: '#1677ff',
  increase: '#52c41a',
  decrease: '#f5222d',
} as const;

/** Waterfall (bridge) chart of a variance decomposition. */
export function waterfallOption(
  steps: readonly VarianceBridgeStep[],
  labels: WaterfallLabels,
): EChartsCoreOption {
  const bars = waterfallBars(steps);
  const categories = steps.map((step) => labels.step(step.key));
  const part = (kind: WaterfallBar['kind'], sign: 'positive' | 'negative'): (number | null)[] =>
    bars.map((bar) => (bar.kind === kind && bar[sign] !== 0 ? bar[sign] : null));
  const series = (['total', 'increase', 'decrease'] as const).flatMap((kind) =>
    (['positive', 'negative'] as const).map((sign) => ({
      name:
        kind === 'total' ? labels.total : kind === 'increase' ? labels.increase : labels.decrease,
      type: 'bar',
      stack: 'bridge',
      itemStyle: { color: WATERFALL_COLORS[kind] },
      data: part(kind, sign),
    })),
  );

  return {
    animation: false,
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: unknown): string => {
        const first = Array.isArray(params) ? (params[0] as { dataIndex?: number }) : undefined;
        const index = first?.dataIndex ?? 0;
        const step = steps[index];

        return `${categories[index]}<br/>${labels.format(step.value)}${step.type === 'delta' ? ` → ${labels.format(step.cumulative)}` : ''}`;
      },
    },
    grid: { left: 24, right: 24, top: 24, bottom: 32, containLabel: true },
    xAxis: { type: 'category', data: categories, axisLabel: { interval: 0, hideOverlap: true } },
    yAxis: {
      type: 'value',
      axisLabel: { formatter: (value: number): string => labels.format(value) },
    },
    series: [
      {
        name: 'base',
        type: 'bar',
        stack: 'bridge',
        silent: true,
        itemStyle: { color: 'transparent' },
        data: bars.map((bar) => bar.base),
      },
      ...series,
    ],
  };
}

export interface WhaleCurveLabels {
  profit: string;
  pareto: string;
  total: string;
  format: (value: number) => string;
}

/**
 * Whale Curve: cumulative net profit (as a percentage of the total) by profitability rank. The curve peaks above 100% and
 * falls back as the value destroying tail is added; the Pareto cut-off is a vertical line and the loss makers are red.
 */
export function whaleCurveOption(
  points: readonly WhaleCurvePoint[],
  paretoCutoffRank: number,
  labels: WhaleCurveLabels,
): EChartsCoreOption {
  const cutoffIndex = paretoCutoffRank > 0 ? paretoCutoffRank - 1 : -1;

  return {
    animation: false,
    tooltip: {
      trigger: 'axis',
      formatter: (params: unknown): string => {
        const first = Array.isArray(params) ? (params[0] as { dataIndex?: number }) : undefined;
        const point = points[first?.dataIndex ?? 0];

        return point
          ? `${point.label}<br/>${labels.profit}: ${labels.format(point.net_operating_profit)}<br/>${point.cumulative_profit_pct.toFixed(1)}%`
          : '';
      },
    },
    grid: { left: 24, right: 24, top: 24, bottom: 32, containLabel: true },
    xAxis: { type: 'category', data: points.map((point) => point.rank), boundaryGap: false },
    yAxis: { type: 'value', axisLabel: { formatter: '{value}%' } },
    series: [
      {
        name: labels.profit,
        type: 'line',
        symbolSize: 6,
        areaStyle: { opacity: 0.08 },
        data: points.map((point) => ({
          value: point.cumulative_profit_pct,
          itemStyle: { color: point.net_operating_profit < 0 ? '#f5222d' : '#1677ff' },
        })),
        markLine: {
          silent: true,
          symbol: 'none',
          data: [
            { yAxis: 100, name: labels.total, lineStyle: { type: 'dashed', color: '#8c8c8c' } },
            ...(cutoffIndex >= 0
              ? [
                  {
                    xAxis: cutoffIndex,
                    name: labels.pareto,
                    lineStyle: { type: 'solid', color: '#fa8c16' },
                  },
                ]
              : []),
          ],
        },
      },
    ],
  };
}

/** Rows of the matrix whose profit erodes the total: the value destroying tail. */
export function erodingRows(rows: readonly ProfitabilityMatrixRow[]): ProfitabilityMatrixRow[] {
  return rows.filter((row) => row.is_value_destroying);
}

/** The ledger metric behind each indicator, for the drill-down; indicators without ledger records have none. */
const KPI_DRILL: Readonly<Record<string, DrillMetric>> = {
  revenue: 'revenue',
  gross_margin_pct: 'cogs',
  ebitda: 'opex',
  net_cash_flow: 'cash',
  cash_conversion_cycle: 'receivable',
  average_dso: 'receivable',
  operating_expense_ratio: 'opex',
  inventory_turnover: 'inventory',
};

export function kpiDrillMetric(key: string): DrillMetric | null {
  return KPI_DRILL[key] ?? null;
}

/** The ledger metric of a bridge bar: price, volume and FX move revenue, the cost steps their own account category. */
export function bridgeDrillMetric(key: VarianceStepKey): DrillMetric {
  return key === 'cogs' ? 'cogs' : key === 'opex' ? 'opex' : 'revenue';
}

/** The entity type of a profitability dimension in the drill-down, where the ledger knows it. */
export function dimensionEntityType(dimension: ProfitabilityDimension): DrillEntityType | null {
  switch (dimension) {
    case 'customer':
    case 'cost_center':
    case 'legal_entity':
      return dimension;
    default:
      return null;
  }
}

/** What the "inspect" action of an alert opens, from the metric and context the API gives. */
export function alertDrillTarget(alert: ExecutiveAlert, label: string): DrillTarget | null {
  const counterparty = alert.context['counterparty_id'];

  switch (alert.code) {
    case 'margin_erosion':
      return { metric: 'cogs', entityType: null, entityId: null, label };
    case 'dso_spike':
      return { metric: 'receivable', entityType: null, entityId: null, label };
    case 'customer_concentration':
      return typeof counterparty === 'string' && counterparty !== ''
        ? { metric: 'revenue', entityType: 'customer', entityId: counterparty, label }
        : { metric: 'revenue', entityType: null, entityId: null, label };
    case 'budget_overrun':
      return {
        metric: alert.metric === 'cogs' ? 'cogs' : 'opex',
        entityType: null,
        entityId: null,
        label,
      };
    default:
      return {
        metric: alert.metric === 'net_cash_flow' ? 'cash' : 'revenue',
        entityType: null,
        entityId: null,
        label,
      };
  }
}

/** Language of the board pack for the language of the user and the reporting currency (CHF reports use the Swiss variants). */
export function boardPackLocale(language: string, currency: ReportingCurrency): string {
  switch (language) {
    case 'de':
      return 'de-CH';
    case 'fr':
      return 'fr-CH';
    case 'it':
      return currency === 'CHF' ? 'it-CH' : 'it-IT';
    default:
      return 'en';
  }
}

/** `YYYY-MM-DD` of a date in the local time zone (the date pickers work in local time). */
export function toIsoDay(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${date.getFullYear()}-${month}-${day}`;
}

export function fromIsoDay(day: string): Date {
  const [year, month, date] = day.split('-').map(Number);

  return new Date(year, month - 1, date);
}

/** Saves a file received from the API under `filename` through a temporary object URL. */
export function downloadFile(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
