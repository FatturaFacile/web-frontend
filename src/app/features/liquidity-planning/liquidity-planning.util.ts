import { HttpErrorResponse } from '@angular/common/http';
import type { EChartsCoreOption } from 'echarts/core';
import {
  LpAlertSeverity,
  LpCapitalStatus,
  LpDscrStatus,
  LpEbaStatus,
  LpExportFormat,
  LpGranularity,
  LpHorizon,
  LpHorizonDays,
  LpLeverKey,
  LpLevers,
  LpManualItemPayload,
  LpOverview,
  LpPfnStatus,
  LpPoint,
  LpProjection,
  LpTier,
  LpTiers,
} from '@core';

/** Permission module of the screens (read: finance readers, write: finance). */
export const LP_MODULE = 'liquidity_planning';

export const LP_HORIZONS: readonly LpHorizonDays[] = [30, 60, 90, 180];
export const LP_TIERS: readonly LpTier[] = ['certain', 'probable', 'estimated'];

export type LpLeverUnit = 'days' | 'percent' | 'amount';

export interface LpLeverSpec {
  key: Exclude<LpLeverKey, 'additional_financing_date'>;
  unit: LpLeverUnit;
  min: number;
  max: number;
  step: number;
}

/** The what-if levers and their bounds, the same the API validates. */
export const LP_LEVER_SPECS: readonly LpLeverSpec[] = [
  { key: 'collection_delay_days', unit: 'days', min: 0, max: 180, step: 1 },
  { key: 'collection_delay_share_percent', unit: 'percent', min: 0, max: 100, step: 5 },
  { key: 'inflow_change_percent', unit: 'percent', min: -100, max: 100, step: 5 },
  { key: 'outflow_change_percent', unit: 'percent', min: -100, max: 300, step: 5 },
  { key: 'raw_material_increase_percent', unit: 'percent', min: 0, max: 300, step: 5 },
  { key: 'capex_acceleration_days', unit: 'days', min: 0, max: 365, step: 5 },
  { key: 'capex_change_percent', unit: 'percent', min: -100, max: 300, step: 5 },
  { key: 'additional_financing_amount', unit: 'amount', min: 0, max: 1_000_000_000, step: 1000 },
];

/** Lever the share slider defaults to when a delay is set without a share. */
export const LP_DEFAULT_SHARE_PERCENT = 100;

export const LP_ITEM_CATEGORIES = [
  'receivable',
  'payable',
  'sales_order',
  'purchase_order',
  'recurring_contract',
  'lease',
  'payroll',
  'tax',
  'capex',
  'debt_principal',
  'debt_interest',
  'other',
] as const;

export const LP_FREQUENCIES = ['once', 'weekly', 'monthly', 'quarterly', 'yearly'] as const;

export const LP_ALERT_STATUSES = ['open', 'acknowledged', 'resolved'] as const;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

/** Number of a decimal string (0 for a missing or malformed amount). */
export function num(value: string | number | null | undefined): number {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(value ?? '');

  return Number.isFinite(parsed) ? parsed : 0;
}

/** `YYYY-MM-DD` of a date in the local time zone (never shifted through UTC). */
export function toIsoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${date.getFullYear()}-${month}-${day}`;
}

export function todayIso(): string {
  return toIsoDate(new Date());
}

/** The day `days` after an ISO date (calendar arithmetic at noon, safe across time zones). */
export function addDaysIso(iso: string, days: number): string {
  const date = new Date(`${iso}T12:00:00`);
  date.setDate(date.getDate() + days);

  return toIsoDate(date);
}

/**
 * Keeps the levers the API accepts: numbers clamped to their bounds, zero levers dropped, the financing only when it has an
 * amount and a date.
 */
export function sanitizeLevers(levers: LpLevers): LpLevers {
  const clean: LpLevers = {};

  for (const spec of LP_LEVER_SPECS) {
    if (spec.key === 'additional_financing_amount') {
      continue;
    }
    const raw = levers[spec.key];
    const value = typeof raw === 'number' || typeof raw === 'string' ? Number(raw) : Number.NaN;

    if (Number.isFinite(value) && value !== 0) {
      clean[spec.key] = clamp(value, spec.min, spec.max);
    }
  }

  const amount = Number(levers.additional_financing_amount ?? 0);

  if (Number.isFinite(amount) && amount > 0 && levers.additional_financing_date) {
    clean.additional_financing_amount = amount;
    clean.additional_financing_date = levers.additional_financing_date;
  }

  if (
    clean.collection_delay_days !== undefined &&
    clean.collection_delay_share_percent === undefined
  ) {
    clean.collection_delay_share_percent = LP_DEFAULT_SHARE_PERCENT;
  }

  return clean;
}

/** Whether any lever moves the projection (a lone share percent changes nothing). */
export function hasLevers(levers: LpLevers | null | undefined): boolean {
  if (!levers) {
    return false;
  }
  return Object.keys(sanitizeLevers(levers)).some(
    (key) => key !== 'collection_delay_share_percent',
  );
}

/** Points of a projection that fall inside the horizon starting at `asOf`. */
export function sliceSeries(
  points: readonly LpPoint[],
  asOf: string,
  horizon: LpHorizonDays,
): LpPoint[] {
  const until = addDaysIso(asOf, horizon);

  return points.filter((point) => point.date <= until);
}

export function seriesOf(projection: LpProjection | null, granularity: LpGranularity): LpPoint[] {
  if (projection === null) {
    return [];
  }

  return granularity === 'daily' ? projection.daily : projection.weekly;
}

export function horizonOf(overview: LpOverview | null, days: LpHorizonDays): LpHorizon | null {
  return overview?.horizons.find((horizon) => horizon.days === days) ?? null;
}

/** Net flow (inflows minus outflows) of a tier. */
export function tierNet(tiers: LpTiers, tier: LpTier): number {
  return num(tiers[tier].inflows) - num(tiers[tier].outflows);
}

export interface LpChartLabels {
  baseline: string;
  scenario: string;
  minimum: string;
  tiers: Record<LpTier, string>;
}

export interface LpChartInput {
  baseline: LpProjection;
  scenario: LpProjection | null;
  asOf: string;
  horizon: LpHorizonDays;
  granularity: LpGranularity;
  showTiers: boolean;
  minimumBalance: number;
  labels: LpChartLabels;
  currency: string;
}

const TIER_COLORS: Record<LpTier, string> = {
  certain: '#1677ff',
  probable: '#13a8a8',
  estimated: '#faad14',
};

/** ECharts option of the cash curve: baseline, optional scenario overlay and the net flow stacked by reliability tier. */
export function buildCashOption(input: LpChartInput): EChartsCoreOption {
  const base = sliceSeries(seriesOf(input.baseline, input.granularity), input.asOf, input.horizon);
  const scenario = sliceSeries(
    seriesOf(input.scenario, input.granularity),
    input.asOf,
    input.horizon,
  );
  const categories = base.map((point) => point.date);
  const money = (value: number): string =>
    new Intl.NumberFormat(undefined, { style: 'currency', currency: input.currency }).format(value);
  const series: Record<string, unknown>[] = [
    {
      name: input.labels.baseline,
      type: 'line',
      showSymbol: false,
      smooth: false,
      step: input.granularity === 'daily' ? 'end' : false,
      data: base.map((point) => num(point.closing)),
      lineStyle: { width: 2 },
      itemStyle: { color: '#1f3a93' },
      markLine: {
        symbol: 'none',
        silent: true,
        lineStyle: { type: 'dashed', color: '#cf1322' },
        label: { formatter: input.labels.minimum },
        data: [{ yAxis: input.minimumBalance }],
      },
    },
  ];

  if (input.scenario !== null) {
    series.push({
      name: input.labels.scenario,
      type: 'line',
      showSymbol: false,
      step: input.granularity === 'daily' ? 'end' : false,
      data: scenario.map((point) => num(point.closing)),
      lineStyle: { width: 2, type: 'dashed' },
      itemStyle: { color: '#d4380d' },
    });
  }

  if (input.showTiers) {
    for (const tier of LP_TIERS) {
      series.push({
        name: input.labels.tiers[tier],
        type: 'bar',
        stack: 'net',
        yAxisIndex: 1,
        data: base.map((point) => tierNet(point.tiers, tier)),
        itemStyle: { color: TIER_COLORS[tier], opacity: 0.55 },
      });
    }
  }

  return {
    animation: false,
    grid: { left: 70, right: input.showTiers ? 70 : 24, top: 40, bottom: 56 },
    tooltip: {
      trigger: 'axis',
      valueFormatter: (value: unknown) => money(Number(value)),
    },
    legend: { top: 0 },
    dataZoom: [{ type: 'inside' }],
    xAxis: { type: 'category', data: categories, boundaryGap: input.showTiers },
    yAxis: input.showTiers
      ? [
          { type: 'value', scale: true },
          { type: 'value', splitLine: { show: false } },
        ]
      : [{ type: 'value', scale: true }],
    series,
  };
}

// --- Presentation helpers ---

export type LpTone = 'success' | 'warning' | 'error' | 'default';

export function dscrTone(status: LpDscrStatus): LpTone {
  return status === 'healthy'
    ? 'success'
    : status === 'warning'
      ? 'warning'
      : status === 'critical'
        ? 'error'
        : 'default';
}

export function capitalTone(status: LpCapitalStatus): LpTone {
  return status === 'ok' ? 'success' : status === 'watch' ? 'warning' : 'error';
}

export function pfnTone(status: LpPfnStatus): LpTone {
  return status === 'ok'
    ? 'success'
    : status === 'watch'
      ? 'warning'
      : status === 'breach'
        ? 'error'
        : 'default';
}

export function severityTone(severity: LpAlertSeverity): LpTone {
  return severity === 'critical' ? 'error' : severity === 'warning' ? 'warning' : 'default';
}

export function ebaTone(status: LpEbaStatus): LpTone {
  return status === 'ok' ? 'success' : status === 'watch' ? 'warning' : 'error';
}

/** `nz-tag` colour of a tone. */
export function tagColor(tone: LpTone): string {
  return tone === 'default' ? 'default' : tone;
}

/** Whether a balance is under the minimum liquidity threshold. */
export function isBelow(balance: string, minimum: string): boolean {
  return num(balance) < num(minimum);
}

export function exportFileName(format: LpExportFormat, asOf: string): string {
  return `liquidity-plan-${asOf}.${format}`;
}

export function emptyManualItem(today: string, currency: string): LpManualItemPayload {
  return {
    label: '',
    tier: 'estimated',
    category: 'other',
    direction: 'outflow',
    amount: '',
    currency,
    first_date: today,
    frequency: 'once',
    end_date: null,
    is_active: true,
    notes: null,
  };
}

/** Message of a failed request: the first validation error, or the API message (a translatable key or text). */
export function apiErrorMessage(error: unknown): string | null {
  if (!(error instanceof HttpErrorResponse)) {
    return null;
  }
  const body = error.error as {
    message?: string;
    detail?: string;
    errors?: Record<string, string[]>;
  } | null;
  const first = body?.errors ? Object.values(body.errors).flat()[0] : undefined;

  return first ?? body?.detail ?? body?.message ?? null;
}
