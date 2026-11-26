import { CurrencyRate, CurrencySyncStatus, FxRevaluationResult, FxRevaluationStatus } from '@core';

/** Module key of the access map (`MODULE_ACCESS`): the general ledger readers see, finance writes. */
export const CURRENCY_FX_MODULE = 'ledger';

/** Currencies offered when activating a currency; the tenant may already have others active (they are kept). */
export const KNOWN_CURRENCIES: readonly string[] = [
  'CHF',
  'EUR',
  'USD',
  'GBP',
  'JPY',
  'CNY',
  'CAD',
  'AUD',
  'SEK',
  'NOK',
  'DKK',
  'PLN',
  'CZK',
  'HUF',
  'TRY',
  'AED',
];

// --- Colours ---

const SYNC_COLORS: Record<CurrencySyncStatus, string> = {
  queued: 'default',
  running: 'processing',
  succeeded: 'success',
  failed: 'error',
};

export function syncStatusColor(status: CurrencySyncStatus): string {
  return SYNC_COLORS[status] ?? 'default';
}

/** A run that is still going: the list keeps refreshing until none is queued or running. */
export function isSyncActive(status: CurrencySyncStatus): boolean {
  return status === 'queued' || status === 'running';
}

const REVALUATION_COLORS: Record<FxRevaluationStatus, string> = {
  draft: 'default',
  posted: 'success',
  reversed: 'warning',
};

export function revaluationStatusColor(status: FxRevaluationStatus): string {
  return REVALUATION_COLORS[status] ?? 'default';
}

const RESULT_COLORS: Record<FxRevaluationResult, string> = {
  gain: 'success',
  loss: 'error',
  neutral: 'default',
};

export function revaluationResultColor(result: FxRevaluationResult): string {
  return RESULT_COLORS[result] ?? 'default';
}

/** CSS class of a signed decimal string: green for a gain, red for a loss. */
export function signClass(value: string | null | undefined): string {
  const text = (value ?? '').trim();
  if (text === '' || /^[-+]?0+(\.0+)?$/u.test(text)) {
    return '';
  }
  return text.startsWith('-') ? 'fx-loss' : 'fx-gain';
}

// --- Trend ---

export interface TrendPoint {
  date: string;
  rate: string;
}

/** The points of the rates of one pair, oldest first, without superseded rows and one point per day (the last rate wins). */
export function trendPoints(rates: readonly CurrencyRate[]): TrendPoint[] {
  const byDay = new Map<string, TrendPoint>();
  for (const rate of rates) {
    if (rate.superseded_by !== null) {
      continue;
    }
    byDay.set(rate.valid_on, { date: rate.valid_on, rate: rate.rate });
  }
  return Array.from(byDay.values()).sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * The `points` attribute of the polyline of a sparkline in a `width` x `height` box. The numbers only place the line:
 * the rates themselves are shown as the decimal strings the API sent.
 */
export function sparklinePath(
  points: readonly TrendPoint[],
  width: number,
  height: number,
): string {
  if (points.length === 0) {
    return '';
  }
  const values = points.map((point) => Number(point.rate));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;
  const pad = 4;
  const step = points.length > 1 ? (width - 2 * pad) / (points.length - 1) : 0;
  return values
    .map((value, index) => {
      const x = points.length > 1 ? pad + index * step : width / 2;
      const y =
        span === 0 ? height / 2 : height - pad - ((value - min) / span) * (height - 2 * pad);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

// --- Dates ---

/** First day of the month of `reference` as `YYYY-MM-DD`. */
export function monthStart(reference: Date = new Date()): string {
  const month = `${reference.getMonth() + 1}`.padStart(2, '0');
  return `${reference.getFullYear()}-${month}-01`;
}

/** Last day of the month before `reference` as `YYYY-MM-DD` (the usual period end of a revaluation). */
export function previousMonthEnd(reference: Date = new Date()): string {
  const date = new Date(reference.getFullYear(), reference.getMonth(), 0);
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** A fresh idempotency key for one run of the revaluation wizard (kept while the user retries the same posting). */
export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}
