import { HttpErrorResponse } from '@angular/common/http';
import type { EChartsCoreOption } from 'echarts/core';
import {
  CrisisApproach,
  CrisisDscr,
  CrisisHorizon,
  CrisisLoanPayload,
  CrisisProfile,
  CrisisProfileMoneyKey,
  CrisisStatus,
  CrisisStressInput,
  CrisisTimelineRow,
} from '@core';

/** Permission module of the screens (read: finance readers, write: finance). */
export const CRISIS_MODULE = 'crisis_monitoring';

export const CRISIS_STATUSES: readonly CrisisStatus[] = ['green', 'yellow', 'red'];
export const CRISIS_LOCALES = ['it', 'en', 'de', 'fr'] as const;
export const CRISIS_HORIZONS: readonly CrisisHorizon[] = ['m6', 'm12'];
export const CRISIS_APPROACHES: readonly CrisisApproach[] = ['treasury', 'operating'];
export const CRISIS_LEGAL_FORMS = ['corporation', 'partnership', 'sole_proprietorship'] as const;
export const CRISIS_JURISDICTIONS = ['IT', 'CH'] as const;
export const CRISIS_CREDITOR_TYPES = ['shareholder', 'third_party'] as const;
export const CRISIS_INTEREST_TREATMENTS = ['deferred', 'paid_current'] as const;
export const CRISIS_LOAN_SCOPES = ['principal', 'principal_and_interest'] as const;
export const CRISIS_LOAN_STATUSES = ['draft', 'active', 'released'] as const;
export const CRISIS_BASES = ['going_concern', 'liquidation'] as const;

/** Default DSCR bands (the API returns the ones in force in the metadata). */
export const DEFAULT_DSCR_BANDS = { red_below: '1.00', yellow_below: '1.20' } as const;

/** Debounce of the stress test simulator, in milliseconds. */
export const STRESS_DEBOUNCE_MS = 400;

export interface StressSpec {
  key: keyof CrisisStressInput;
  min: number;
  max: number;
  step: number;
  unit: 'percent' | 'days' | 'bps' | 'amount';
}

/** The stress levers and their bounds, the same the API validates. */
export const STRESS_SPECS: readonly StressSpec[] = [
  { key: 'revenue_drop_percent', min: 0, max: 100, step: 1, unit: 'percent' },
  { key: 'dso_delay_days', min: 0, max: 180, step: 1, unit: 'days' },
  { key: 'interest_rate_bps', min: 0, max: 2000, step: 25, unit: 'bps' },
  { key: 'one_off_outflow_amount', min: 0, max: 1_000_000_000, step: 1000, unit: 'amount' },
];

export const EMPTY_STRESS: CrisisStressInput = {
  revenue_drop_percent: 0,
  dso_delay_days: 0,
  interest_rate_bps: 0,
  one_off_outflow_amount: 0,
};

/** Money fields of the profile, in the order of the form. */
export const PROFILE_MONEY_FIELDS: readonly CrisisProfileMoneyKey[] = [
  'share_capital',
  'statutory_reserves',
  'legal_minimum_capital',
  'prior_year_revenue',
  'prior_year_inps_contributions',
  'available_credit_lines',
  'variable_debt_amount',
  'assets_going_concern',
  'assets_liquidation',
  'total_liabilities_override',
];

export const PROFILE_OVERRIDE_FIELDS: readonly CrisisProfileMoneyKey[] = [
  'total_assets_override',
  'current_assets_override',
  'current_liabilities_override',
  'total_debt_override',
  'net_equity_override',
  'revenue_override',
  'financial_expenses_override',
  'cash_flow_override',
  'tax_social_debt_override',
];

export const PROFILE_ARREARS_FIELDS: readonly CrisisProfileMoneyKey[] = [
  'payroll_overdue_30d_amount',
  'supplier_overdue_90d_amount',
  'inps_overdue_90d_amount',
  'inail_overdue_90d_amount',
  'vat_lipe_unpaid_amount',
  'ader_entrusted_amount',
];

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

/** `YYYY-MM` of a month start, for the axes. */
export function monthLabel(month: string): string {
  return month.slice(0, 7);
}

/** Keeps the levers inside the bounds the API validates; malformed input falls back to zero. */
export function sanitizeStress(input: Partial<CrisisStressInput>): CrisisStressInput {
  const clean: CrisisStressInput = { ...EMPTY_STRESS };

  for (const spec of STRESS_SPECS) {
    const raw = Number(input[spec.key] ?? 0);
    const value = Number.isFinite(raw) ? clamp(raw, spec.min, spec.max) : 0;

    clean[spec.key] =
      spec.unit === 'days' || spec.unit === 'bps' ? Math.round(value) : roundMoney(value);
  }

  return clean;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Whether any lever moves the stressed run away from the baseline. */
export function isStressed(input: CrisisStressInput): boolean {
  return STRESS_SPECS.some((spec) => input[spec.key] !== 0);
}

/** Classifies a DSCR value against the bands (red below the first, yellow below the second). */
export function dscrStatus(
  value: string | number | null | undefined,
  bands: { red_below: string; yellow_below: string } = DEFAULT_DSCR_BANDS,
): CrisisStatus {
  if (value === null || value === undefined || value === '') {
    return 'green';
  }
  const amount = num(value);

  return amount < num(bands.red_below)
    ? 'red'
    : amount < num(bands.yellow_below)
      ? 'yellow'
      : 'green';
}

/** The DSCR block of an approach and horizon. */
export function pickDscr(
  dscr: Record<CrisisApproach, Record<CrisisHorizon, CrisisDscr>> | undefined,
  approach: CrisisApproach,
  horizon: CrisisHorizon,
): CrisisDscr | null {
  return dscr?.[approach]?.[horizon] ?? null;
}

/** The worst of several statuses (red > yellow > green). */
export function worstStatus(statuses: readonly CrisisStatus[]): CrisisStatus {
  return statuses.includes('red') ? 'red' : statuses.includes('yellow') ? 'yellow' : 'green';
}

// --- Presentation helpers ---

export type CrisisTone = 'success' | 'warning' | 'error';

export function statusTone(status: CrisisStatus): CrisisTone {
  return status === 'green' ? 'success' : status === 'yellow' ? 'warning' : 'error';
}

/** Hex colour of a status, used by the charts and the gauge. */
export const STATUS_COLORS: Record<CrisisStatus, string> = {
  green: '#389e0d',
  yellow: '#d48806',
  red: '#cf1322',
};

/** NG-ZORRO progress status of a creditor-monitor status. */
export function progressStatus(status: CrisisStatus): 'success' | 'normal' | 'exception' {
  return status === 'green' ? 'success' : status === 'yellow' ? 'normal' : 'exception';
}

/** Formats a ratio with two decimals ("n/a" is rendered by the template when null). */
export function formatRatio(value: string | null | undefined): string {
  return value === null || value === undefined || value === '' ? '' : num(value).toFixed(2);
}

/** Signed variance as a plain string (the sign is kept so the template shows direction). */
export function formatSigned(value: string | null | undefined): string {
  if (value === null || value === undefined || value === '') {
    return '';
  }
  const amount = num(value);

  return `${amount > 0 ? '+' : ''}${amount.toFixed(2)}`;
}

/** Whether an indicator value is shown as a percentage. */
export function indicatorSuffix(unit: 'amount' | 'ratio' | 'percent'): string {
  return unit === 'percent' ? '%' : '';
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

export function dossierFileName(asOf: string, locale: string): string {
  return `crisis-board-dossier-${asOf}-${locale}.pdf`;
}

export function agreementFileName(creditor: string, locale: string): string {
  const slug = creditor
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return `rangruecktritt-${slug === '' ? 'agreement' : slug}-${locale}.pdf`;
}

export function emptyLoan(today: string): CrisisLoanPayload {
  return {
    creditor_name: '',
    creditor_type: 'shareholder',
    principal: '',
    interest_rate: '0.00',
    interest_treatment: 'deferred',
    agreement_date: today,
    effective_from: today,
    deferral_end_date: null,
    scope: 'principal_and_interest',
    status: 'draft',
    notes: null,
  };
}

/** Whether a loan form can be submitted (creditor, positive principal and a rate between 0 and 100). */
export function isLoanValid(loan: CrisisLoanPayload): boolean {
  const rate = num(loan.interest_rate);

  return (
    loan.creditor_name.trim() !== '' &&
    num(loan.principal) > 0 &&
    rate >= 0 &&
    rate <= 100 &&
    loan.agreement_date !== '' &&
    loan.effective_from !== ''
  );
}

/** Profile of the PUT body: only changed keys, empty money inputs sent as null. */
export function profileDiff(original: CrisisProfile, draft: CrisisProfile): Partial<CrisisProfile> {
  const diff: Record<string, unknown> = {};

  for (const key of Object.keys(draft) as (keyof CrisisProfile)[]) {
    if (key === 'ateco_section') {
      continue;
    }
    const value = draft[key];
    const normalised = typeof value === 'string' && value.trim() === '' ? null : value;

    if (normalised !== original[key]) {
      diff[key] = normalised;
    }
  }

  return diff as Partial<CrisisProfile>;
}

// --- Charts ---

export interface CrisisChartLabels {
  inflows: string;
  outflows: string;
  debtService: string;
  cumulativeCash: string;
  dscr: string;
}

export interface CrisisTimelineInput {
  rows: readonly CrisisTimelineRow[];
  approach: CrisisApproach;
  currency: string;
  labels: CrisisChartLabels;
}

/** ECharts option of the 12-month rolling cash flow: inflows, outflows, debt service, cumulative cash and the DSCR line. */
export function buildTimelineOption(input: CrisisTimelineInput): EChartsCoreOption {
  const categories = input.rows.map((row) => monthLabel(row.month));
  const money = (value: unknown): string =>
    new Intl.NumberFormat(undefined, { style: 'currency', currency: input.currency }).format(
      Number(value),
    );
  const dscrOf = (row: CrisisTimelineRow): number | null => {
    const value = input.approach === 'treasury' ? row.dscr_treasury : row.dscr_operating;

    return value === null ? null : num(value);
  };

  return {
    animation: false,
    grid: { left: 70, right: 56, top: 44, bottom: 40 },
    tooltip: { trigger: 'axis' },
    legend: { top: 0 },
    xAxis: { type: 'category', data: categories },
    yAxis: [
      { type: 'value', scale: true, axisLabel: { formatter: (v: number) => money(v) } },
      { type: 'value', splitLine: { show: false }, min: 0 },
    ],
    series: [
      {
        name: input.labels.inflows,
        type: 'bar',
        data: input.rows.map((row) => num(row.operating_inflows)),
        itemStyle: { color: '#52c41a', opacity: 0.8 },
        tooltip: { valueFormatter: money },
      },
      {
        name: input.labels.outflows,
        type: 'bar',
        data: input.rows.map((row) => num(row.operating_outflows)),
        itemStyle: { color: '#fa8c16', opacity: 0.8 },
        tooltip: { valueFormatter: money },
      },
      {
        name: input.labels.debtService,
        type: 'bar',
        data: input.rows.map((row) => num(row.debt_service)),
        itemStyle: { color: '#722ed1', opacity: 0.8 },
        tooltip: { valueFormatter: money },
      },
      {
        name: input.labels.cumulativeCash,
        type: 'line',
        showSymbol: false,
        data: input.rows.map((row) => num(row.cumulative_cash_with_credit)),
        lineStyle: { width: 2 },
        itemStyle: { color: '#1f3a93' },
        tooltip: { valueFormatter: money },
      },
      {
        name: input.labels.dscr,
        type: 'line',
        yAxisIndex: 1,
        connectNulls: false,
        data: input.rows.map(dscrOf),
        lineStyle: { width: 2, type: 'dashed' },
        itemStyle: { color: '#cf1322' },
        tooltip: { valueFormatter: (value: unknown) => Number(value).toFixed(2) },
      },
    ],
  };
}

/** ECharts gauge of the DSCR: red below the first band, yellow below the second, green above. */
export function buildGaugeOption(
  dscr: CrisisDscr | null,
  bands: { red_below: string; yellow_below: string },
  notApplicable: string,
): EChartsCoreOption {
  const max = 2.5;
  const red = clamp(num(bands.red_below) / max, 0, 1);
  const yellow = clamp(num(bands.yellow_below) / max, red, 1);
  const value = dscr?.applicable && dscr.value !== null ? clamp(num(dscr.value), 0, max) : 0;

  return {
    animation: false,
    series: [
      {
        type: 'gauge',
        min: 0,
        max,
        splitNumber: 5,
        radius: '95%',
        axisLine: {
          lineStyle: {
            width: 18,
            color: [
              [red, STATUS_COLORS.red],
              [yellow, STATUS_COLORS.yellow],
              [1, STATUS_COLORS.green],
            ],
          },
        },
        pointer: { show: dscr?.applicable === true && dscr.value !== null },
        axisLabel: { distance: 22, formatter: (v: number) => v.toFixed(1) },
        detail: {
          valueAnimation: false,
          fontSize: 26,
          offsetCenter: [0, '70%'],
          formatter: () =>
            dscr?.applicable && dscr.value !== null ? num(dscr.value).toFixed(2) : notApplicable,
        },
        data: [{ value }],
      },
    ],
  };
}
