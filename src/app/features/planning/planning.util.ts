import { HttpErrorResponse } from '@angular/common/http';
import { PlanningScenarioStatus } from '@core';

/** First validation message of a Laravel 422 (or its summary message) so the user sees the real reason. */
export function apiErrorText(error: unknown): string | null {
  if (!(error instanceof HttpErrorResponse)) {
    return null;
  }

  const body = error.error as { message?: unknown; errors?: Record<string, unknown> } | null;
  const first = Object.values(body?.errors ?? {})[0];
  if (Array.isArray(first) && typeof first[0] === 'string') {
    return first[0];
  }

  return typeof body?.message === 'string' && body.message !== '' ? body.message : null;
}

/** The first day of the current month as Y-m-d in the browser time zone. */
export function monthStartIso(offsetMonths = 0): string {
  const now = new Date();
  const date = new Date(now.getFullYear(), now.getMonth() + offsetMonths, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
}

/** An empty text input is sent to the API as null. */
export function blankToNull(value: string | null | undefined): string | null {
  const text = (value ?? '').trim();
  return text === '' ? null : text;
}

/** A decimal input is sent to the API as a string, an empty one as null. */
export function decimalOrNull(value: number | string | null | undefined): string | null {
  return value === null || value === undefined || value === '' ? null : String(value);
}

/** Month label of a Y-m-d period: Y-m. */
export function monthLabel(period: string): string {
  return period.slice(0, 7);
}

/** Colours of the scenario status tags. */
export const SCENARIO_STATUS_COLORS: Readonly<Record<PlanningScenarioStatus, string>> = {
  draft: 'default',
  review: 'orange',
  approved: 'green',
  locked: 'blue',
};

/** Colours of the gap status tags. */
export const BALANCE_STATUS_COLORS: Readonly<Record<string, string>> = {
  shortage: 'red',
  balanced: 'default',
  surplus: 'green',
};
