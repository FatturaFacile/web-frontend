import { HttpErrorResponse } from '@angular/common/http';
import {
  CsBand,
  CsChurnRisk,
  CsDispatchStatus,
  CsKpis,
  CsProblem,
  CsRecoveryPriority,
  CsRecoveryStatus,
  CsSentimentLabel,
  CsSurveyType,
  CsTrendRow,
} from '@core';

/** Module key of the access map (`MODULE_ACCESS`): finance, sales, service and quality roles. */
export const CUSTOMER_SATISFACTION_MODULE = 'customer_satisfaction';

// --- Outcomes and errors ---

/** What a store write answers: the screens show the translated error and the field errors of a 422. */
export interface CsOutcome {
  ok: boolean;
  /** Translation key of the refusal (`customerSatisfaction.error.<code>`), null on success. */
  errorKey: string | null;
  code: string | null;
  /** The text the API sent (validation message or problem detail), for the cases the key does not cover. */
  detail: string | null;
  params: Record<string, string | number>;
  errors: Record<string, string[]>;
}

export const CS_OK: CsOutcome = {
  ok: true,
  errorKey: null,
  code: null,
  detail: null,
  params: {},
  errors: {},
};

export function errorKey(code: string | null | undefined): string {
  return `customerSatisfaction.error.${code ? code : 'generic'}`;
}

export function problemOf(error: unknown): CsProblem | null {
  if (!(error instanceof HttpErrorResponse)) {
    return null;
  }
  const body: unknown = error.error;
  return body !== null && typeof body === 'object' ? (body as CsProblem) : null;
}

function scalarParams(
  params: Record<string, unknown> | undefined,
): Record<string, string | number> {
  const result: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(params ?? {})) {
    if (typeof value === 'string' || typeof value === 'number') {
      result[key] = value;
    }
  }
  return result;
}

/** The outcome of a failed call: the `code` of the problem picks the key, a 422 brings the field errors. */
export function failureOf(error: unknown): CsOutcome {
  const problem = problemOf(error);
  const errors = problem?.errors ?? {};
  const first = Object.values(errors).flat()[0];
  return {
    ok: false,
    errorKey: errorKey(problem?.code),
    code: problem?.code ?? null,
    detail: first ?? problem?.detail ?? null,
    params: scalarParams(problem?.params),
    errors,
  };
}

// --- Scores, bands and colours ---

const BAND_COLORS: Record<CsBand, string> = {
  promoter: 'green',
  passive: 'gold',
  detractor: 'red',
  satisfied: 'green',
  neutral: 'gold',
  dissatisfied: 'red',
};

export function bandColor(band: CsBand): string {
  return BAND_COLORS[band] ?? 'default';
}

/** The smallest and largest score of an instrument: NPS 0-10, CSAT 1-5, CES 1-7. */
export function scaleOf(type: CsSurveyType): { min: number; max: number } {
  switch (type) {
    case 'nps':
      return { min: 0, max: 10 };
    case 'csat':
      return { min: 1, max: 5 };
    default:
      return { min: 1, max: 7 };
  }
}

/** The scores of a scale in order, one button each on the landing page. */
export function scoreRange(type: CsSurveyType): number[] {
  const { min, max } = scaleOf(type);
  return Array.from({ length: max - min + 1 }, (_, index) => min + index);
}

/** The band of a score, with the same rules as the API (promoters 9-10, passives 7-8, detractors 0-6; CSAT 4-5 / 3 / 1-2; CES 1-3 / 4 / 5-7). */
export function bandOf(type: CsSurveyType, score: number): CsBand {
  if (type === 'nps') {
    return score >= 9 ? 'promoter' : score >= 7 ? 'passive' : 'detractor';
  }
  if (type === 'csat') {
    return score >= 4 ? 'satisfied' : score === 3 ? 'neutral' : 'dissatisfied';
  }
  return score <= 3 ? 'satisfied' : score === 4 ? 'neutral' : 'dissatisfied';
}

/** Which of the three follow-up questions a band gets: the good, the middle or the bad answer. */
export function promptKeyOf(band: CsBand): 'low' | 'mid' | 'high' {
  if (band === 'promoter' || band === 'satisfied') {
    return 'high';
  }
  return band === 'passive' || band === 'neutral' ? 'mid' : 'low';
}

/** Colour of a score button on the landing page, so the scale reads from bad to good (CES is reversed: a low score is the good one). */
export function scoreColor(type: CsSurveyType, score: number): string {
  return bandColor(bandOf(type, score));
}

/** Formats a percentage or an average; `—` when there is nothing to show yet. */
export function formatKpi(value: number | null | undefined, digits = 1): string {
  return value === null || value === undefined ? '—' : value.toFixed(digits);
}

/** NPS colour: above 50 excellent, above 0 good, below 0 in need of recovery. */
export function npsColor(score: number | null): string {
  if (score === null) {
    return 'default';
  }
  return score >= 50 ? 'green' : score >= 0 ? 'gold' : 'red';
}

const STATUS_COLORS: Record<CsDispatchStatus, string> = {
  scheduled: 'blue',
  sent: 'cyan',
  delivered: 'geekblue',
  responded: 'green',
  throttled: 'orange',
  suppressed: 'default',
  failed: 'red',
  expired: 'default',
};

export function dispatchStatusColor(status: CsDispatchStatus): string {
  return STATUS_COLORS[status] ?? 'default';
}

const RECOVERY_COLORS: Record<CsRecoveryStatus, string> = {
  open: 'red',
  in_progress: 'blue',
  pending_customer: 'gold',
  resolved: 'green',
  closed: 'default',
};

export function recoveryStatusColor(status: CsRecoveryStatus): string {
  return RECOVERY_COLORS[status] ?? 'default';
}

export function priorityColor(priority: CsRecoveryPriority): string {
  return priority === 'urgent' ? 'red' : 'orange';
}

const CHURN_COLORS: Record<CsChurnRisk, string> = {
  low: 'green',
  medium: 'gold',
  high: 'orange',
  critical: 'red',
};

export function churnColor(risk: CsChurnRisk | null): string {
  return risk === null ? 'default' : (CHURN_COLORS[risk] ?? 'default');
}

const SENTIMENT_COLORS: Record<CsSentimentLabel, string> = {
  positive: 'green',
  neutral: 'default',
  negative: 'red',
};

export function sentimentColor(label: CsSentimentLabel | null): string {
  return label === null ? 'default' : (SENTIMENT_COLORS[label] ?? 'default');
}

// --- SLA countdown ---

export interface SlaCountdown {
  /** `ok` more than a quarter of the SLA left, `warning` the last stretch, `breached` past the deadline. */
  level: 'ok' | 'warning' | 'breached';
  /** Whole hours left (or late, as a positive number). */
  hours: number;
  minutes: number;
}

/** Time left to the SLA deadline of a case, relative to `now`; a solved case has no countdown. */
export function slaCountdown(
  slaDueAt: string,
  now: Date,
  status: CsRecoveryStatus,
  firstContactedAt: string | null = null,
  slaHours = 24,
): SlaCountdown | null {
  if (status === 'resolved' || status === 'closed' || firstContactedAt !== null) {
    return null;
  }
  const remaining = new Date(slaDueAt).getTime() - now.getTime();
  const abs = Math.abs(remaining);
  const hours = Math.floor(abs / 3_600_000);
  const minutes = Math.floor((abs % 3_600_000) / 60_000);
  if (remaining < 0) {
    return { level: 'breached', hours, minutes };
  }
  return { level: remaining <= (slaHours * 3_600_000) / 4 ? 'warning' : 'ok', hours, minutes };
}

// --- Trend chart ---

export interface TrendPoint {
  label: string;
  value: number;
  x: number;
  y: number;
}

/** The line of a KPI over time as SVG coordinates in a `width` x `height` box; rows without a value are skipped. */
export function trendPoints(
  rows: CsTrendRow[],
  pick: (kpis: CsKpis) => number | null,
  min: number,
  max: number,
  width = 600,
  height = 160,
): TrendPoint[] {
  const valued = rows
    .map((row) => ({ label: row.bucket, value: pick(row) }))
    .filter((row): row is { label: string; value: number } => row.value !== null);
  const span = max - min || 1;
  return valued.map((row, index) => ({
    label: row.label,
    value: row.value,
    x: valued.length === 1 ? width / 2 : (index / (valued.length - 1)) * width,
    y: height - ((Math.min(max, Math.max(min, row.value)) - min) / span) * height,
  }));
}

/** `x,y x,y` list of an SVG polyline. */
export function polyline(points: TrendPoint[]): string {
  return points.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ');
}

// --- Files ---

/** Saves a downloaded report through a temporary link. */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function reportFilename(title: string, format: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${slug || 'iso-9001-report'}.${format}`;
}
