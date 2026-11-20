import type { EChartsCoreOption } from 'echarts/core';
import {
  ConfidenceBands,
  DailyProjection,
  PaymentRiskTier,
  SkuForecast,
  StatutoryEvent,
  WhatIfParameters,
} from './ai-forecasting.models';

export const DEFAULT_WHAT_IF: WhatIfParameters = {
  global_customer_delay_shift_days: 0,
  revenue_growth_percentage: 0,
  supplier_payment_extension_days: 0,
  interest_rate_delta: 0,
};

/** Slider ranges of the what-if panel. */
export const WHAT_IF_RANGES = {
  delay: { min: -15, max: 30 },
  sales: { min: -30, max: 50 },
  suppliers: { min: 0, max: 30 },
} as const;

const TIER_COLORS: Record<PaymentRiskTier, string> = {
  low: 'green',
  moderate: 'gold',
  high: 'orange',
  critical: 'red',
};

/** NG-ZORRO tag colour of a risk tier. */
export function riskTierColor(tier: PaymentRiskTier): string {
  return TIER_COLORS[tier];
}

export function isNeutralWhatIf(whatIf: WhatIfParameters): boolean {
  return (
    whatIf.global_customer_delay_shift_days === 0 &&
    whatIf.revenue_growth_percentage === 0 &&
    whatIf.supplier_payment_extension_days === 0 &&
    whatIf.interest_rate_delta === 0
  );
}

/** Days from the first projected day until the expected (p50) balance first goes below zero, or `null` when it never does. */
export function runwayDays(projections: Pick<DailyProjection, 'balance'>[]): number | null {
  const index = projections.findIndex((day) => day.balance.p50 < 0);

  return index === -1 ? null : index + 1;
}

/** Same as {@link runwayDays}, from the chart series of the confidence bands. */
export function runwayFromBands(bands: Pick<ConfidenceBands, 'p50'>): number | null {
  const index = bands.p50.findIndex((value) => value < 0);

  return index === -1 ? null : index + 1;
}

export interface FanChartLabels {
  p10: string;
  p50: string;
  p90: string;
  /** Translated name of a statutory event code (F24, MWST_Q1, ...). */
  event: (code: string) => string;
  /** Currency formatting of an amount, for the axis and the tooltip. */
  format: (value: number) => string;
}

/** Statutory events of the same day, one marker label each. */
export function eventLabelsByDate(
  events: StatutoryEvent[],
  label: (code: string) => string,
): Map<string, string> {
  const byDate = new Map<string, string[]>();

  for (const event of events) {
    byDate.set(event.date, [...(byDate.get(event.date) ?? []), label(event.code)]);
  }

  return new Map([...byDate].map(([date, names]) => [date, names.join(' + ')]));
}

/**
 * The fan chart of a liquidity run: the expected balance (p50) as a solid line, the area between the pessimistic (p10) and
 * optimistic (p90) balance shaded, and a marker on the expected line for every statutory outflow.
 *
 * ECharts stacks areas from zero and mixes positive and negative stacks, so the band is drawn on balances shifted by
 * `offset` (the lowest p10, when it is negative) and the axis and tooltip show the real values again.
 */
export function fanChartOption(bands: ConfidenceBands, labels: FanChartLabels): EChartsCoreOption {
  const offset = Math.min(0, ...bands.p10);
  const shifted = (values: number[]): number[] => values.map((value) => value - offset);
  const markers = [...eventLabelsByDate(bands.statutoryEvents, labels.event)]
    .map(([date, name]) => ({ date, name, index: bands.dates.indexOf(date) }))
    .filter((marker) => marker.index >= 0);

  return {
    animation: false,
    tooltip: {
      trigger: 'axis',
      formatter: (params: unknown): string => {
        const first = Array.isArray(params) ? (params[0] as { dataIndex?: number }) : undefined;
        const index = first?.dataIndex ?? 0;

        return [
          bands.dates[index],
          `${labels.p90}: ${labels.format(bands.p90[index])}`,
          `${labels.p50}: ${labels.format(bands.p50[index])}`,
          `${labels.p10}: ${labels.format(bands.p10[index])}`,
        ].join('<br/>');
      },
    },
    legend: { bottom: 0, data: [labels.p10, labels.p50, labels.p90] },
    grid: { left: 24, right: 24, top: 32, bottom: 48, containLabel: true },
    xAxis: {
      type: 'category',
      data: bands.dates,
      boundaryGap: false,
      axisLabel: { hideOverlap: true },
    },
    yAxis: {
      type: 'value',
      axisLabel: { formatter: (value: number): string => labels.format(value + offset) },
    },
    series: [
      {
        name: labels.p10,
        type: 'line',
        stack: 'band',
        symbol: 'none',
        lineStyle: { type: 'dashed', width: 1 },
        areaStyle: { opacity: 0 },
        data: shifted(bands.p10),
      },
      {
        name: labels.p90,
        type: 'line',
        stack: 'band',
        symbol: 'none',
        lineStyle: { type: 'dashed', width: 1 },
        areaStyle: { opacity: 0.18 },
        // The band stacks on the p10 line, so its height is the distance between p90 and p10.
        data: bands.p90.map((value, index) => value - bands.p10[index]),
      },
      {
        name: labels.p50,
        type: 'line',
        symbol: 'none',
        lineStyle: { width: 2.5 },
        data: shifted(bands.p50),
        markPoint: {
          symbol: 'pin',
          symbolSize: 42,
          label: { show: true, formatter: '{b}', fontSize: 9 },
          data: markers.map((marker) => ({
            name: marker.name,
            coord: [marker.index, bands.p50[marker.index] - offset],
          })),
        },
        markLine: {
          symbol: 'none',
          silent: true,
          lineStyle: { color: '#cf1322', type: 'dotted' },
          label: { show: false },
          data: [{ yAxis: -offset }],
        },
      },
    ],
  };
}

export interface DemandChartLabels {
  actual: string;
  forecast: string;
  lower: string;
  upper: string;
}

/** Bars of the last months of sales next to the forecast of the period, with its confidence bounds as markers. */
export function demandChartOption(row: SkuForecast, labels: DemandChartLabels): EChartsCoreOption {
  const months = [...row.history.map((entry) => entry.month), row.period_start.slice(0, 7)];
  const blanks = row.history.map(() => null);

  return {
    animation: false,
    tooltip: { trigger: 'axis' },
    legend: { bottom: 0 },
    grid: { left: 24, right: 24, top: 24, bottom: 48, containLabel: true },
    xAxis: { type: 'category', data: months },
    yAxis: { type: 'value', min: 0 },
    series: [
      {
        name: labels.actual,
        type: 'bar',
        data: [...row.history.map((entry) => entry.quantity), null],
      },
      {
        name: labels.forecast,
        type: 'bar',
        itemStyle: { opacity: 0.65 },
        data: [...blanks, row.predicted_demand_qty],
      },
      {
        name: labels.lower,
        type: 'line',
        symbol: 'triangle',
        symbolSize: 10,
        lineStyle: { width: 0 },
        data: [...blanks, row.confidence_lower_bound],
      },
      {
        name: labels.upper,
        type: 'line',
        symbol: 'diamond',
        symbolSize: 10,
        lineStyle: { width: 0 },
        data: [...blanks, row.confidence_upper_bound],
      },
    ],
  };
}

/** Sum of the quantity of a history, for the KPI cards. */
export function totalSales(row: Pick<SkuForecast, 'history'>): number {
  return row.history.reduce((sum, entry) => sum + entry.quantity, 0);
}

/** Whether the recommendation differs from what the warehouse has now (the apply button is worth pressing). */
export function needsApply(row: SkuForecast): boolean {
  return (
    row.applied_to_wms_at === null &&
    (row.current_reorder_point === null ||
      Math.abs(row.current_reorder_point - row.recommended_reorder_point) >= 0.5 ||
      row.current_safety_stock === null ||
      Math.abs(row.current_safety_stock - row.recommended_safety_stock) >= 0.5)
  );
}
