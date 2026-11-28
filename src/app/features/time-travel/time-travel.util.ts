import { HttpErrorResponse } from '@angular/common/http';

export type TimeTravelPreset = 'END_OF_LAST_QUARTER' | 'FISCAL_YEAR_CLOSE' | 'AUDIT_VS_TODAY';
export const TIME_TRAVEL_PRESETS: readonly TimeTravelPreset[] = [
  'END_OF_LAST_QUARTER',
  'FISCAL_YEAR_CLOSE',
  'AUDIT_VS_TODAY',
];

export interface PresetCoordinates {
  validAt: Date;
  knownAt: Date;
  /** Set when the preset opens the cut-off diff straight away. */
  comparisonKnownAt: Date | null;
}

/** Days between the end of a fiscal year and the date the first close of the books was known to the company. */
const CLOSE_KNOWN_AFTER_DAYS = 15;

function endOfDay(year: number, monthIndex: number, day: number): Date {
  return new Date(year, monthIndex, day, 23, 59, 59, 0);
}

/** Last instant of the calendar quarter that precedes the one `today` falls in. */
export function endOfLastQuarter(today: Date): Date {
  const currentQuarterStartMonth = Math.floor(today.getMonth() / 3) * 3;
  // Day 0 of the first month of the current quarter is the last day of the previous quarter.
  const lastDay = new Date(today.getFullYear(), currentQuarterStartMonth, 0);
  return endOfDay(lastDay.getFullYear(), lastDay.getMonth(), lastDay.getDate());
}

/** Last instant of the previous calendar fiscal year. */
export function endOfLastFiscalYear(today: Date): Date {
  return endOfDay(today.getFullYear() - 1, 11, 31);
}

export function presetCoordinates(preset: TimeTravelPreset, today: Date = new Date()): PresetCoordinates {
  switch (preset) {
    case 'END_OF_LAST_QUARTER':
      return { validAt: endOfLastQuarter(today), knownAt: today, comparisonKnownAt: null };
    case 'FISCAL_YEAR_CLOSE':
      return { validAt: endOfLastFiscalYear(today), knownAt: today, comparisonKnownAt: null };
    case 'AUDIT_VS_TODAY': {
      const validAt = endOfLastFiscalYear(today);
      const knownAt = new Date(validAt.getTime());
      knownAt.setDate(knownAt.getDate() + CLOSE_KNOWN_AFTER_DAYS);
      return { validAt, knownAt, comparisonKnownAt: today };
    }
  }
}

/** Date part (YYYY-MM-DD) in local time, as the audit-integrity endpoint expects it. */
export function toDateOnly(value: Date): string {
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${value.getFullYear()}-${month}-${day}`;
}

export function parseIso(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Sign class of a decimal string: drives the colour of the delta columns. */
export function deltaSign(value: string | number | null | undefined): 'positive' | 'negative' | 'zero' {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric) || numeric === 0) {
    return 'zero';
  }
  return numeric > 0 ? 'positive' : 'negative';
}

/** Translation key of the message that tells the user why a time-travel call failed. */
export function failureKey(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 401 || error.status === 403) {
      return 'TIME_TRAVEL.ERROR.FORBIDDEN';
    }
    if (error.status === 422) {
      return 'TIME_TRAVEL.ERROR.INVALID';
    }
  }
  return 'TIME_TRAVEL.ERROR.GENERIC';
}

/** Short form of a SHA-256 digest for tables; the full value stays available in a tooltip / the drawer. */
export function shortHash(hash: string | null | undefined): string {
  if (!hash) {
    return '—';
  }
  return hash.length > 16 ? `${hash.slice(0, 8)}…${hash.slice(-8)}` : hash;
}

/** Date and time in the language of the user; an unknown locale falls back to the browser default. */
export function formatDateTime(value: Date | string | null | undefined, locale: string): string {
  const date = value instanceof Date ? value : parseIso(value ?? null);
  if (!date) {
    return '—';
  }
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
  } catch {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
  }
}
