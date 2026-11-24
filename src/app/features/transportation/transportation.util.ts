import { HttpErrorResponse } from '@angular/common/http';
import { TmsOrderStatus, TmsTripStatus } from '@core';

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

export const ORDER_STATUS_COLORS: Readonly<Record<TmsOrderStatus, string>> = {
  draft: 'default',
  planned: 'blue',
  in_transit: 'processing',
  delivered: 'success',
  cancelled: 'default',
  exception: 'error',
};

export const TRIP_STATUS_COLORS: Readonly<Record<TmsTripStatus, string>> = {
  planned: 'blue',
  dispatched: 'cyan',
  in_progress: 'processing',
  completed: 'success',
  cancelled: 'default',
};

/** The trimmed value, or null when it is empty: the nullable payload value of an optional field. */
export function nullable(value: string | null | undefined): string | null {
  const trimmed = (value ?? '').trim();
  return trimmed === '' ? null : trimmed;
}

/** Whether `to` is empty (open ended) or strictly greater than `from`, the range rule of the tariff bands. */
export function isRangeValid(from: string | null | undefined, to: string | null | undefined): boolean {
  const upper = nullable(to);
  if (upper === null) {
    return true;
  }
  return Number(upper) > Number(nullable(from) ?? '0');
}

/** The ids with the item at `index` moved by `offset` positions; the same order when the move leaves the list. */
export function moveId(ids: readonly string[], index: number, offset: number): string[] {
  const target = index + offset;
  const copy = [...ids];
  if (index < 0 || index >= copy.length || target < 0 || target >= copy.length) {
    return copy;
  }
  [copy[index], copy[target]] = [copy[target], copy[index]];
  return copy;
}
