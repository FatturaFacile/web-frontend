import { HttpErrorResponse } from '@angular/common/http';

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

/** An empty text input is sent to the API as null. */
export function blankToNull(value: string | null | undefined): string | null {
  const text = (value ?? '').trim();
  return text === '' ? null : text;
}

export const CHANGE_STATUS_COLORS: Readonly<Record<string, string>> = {
  draft: 'default',
  in_review: 'orange',
  approved: 'green',
  rejected: 'red',
  implemented: 'blue',
  cancelled: 'default',
};

export const PRIORITY_COLORS: Readonly<Record<string, string>> = {
  low: 'default',
  normal: 'blue',
  high: 'orange',
  critical: 'red',
};

export const REVISION_STATUS_COLORS: Readonly<Record<string, string>> = {
  draft: 'default',
  released: 'green',
  obsolete: 'default',
};

export const APPROVAL_STATUS_COLORS: Readonly<Record<string, string>> = {
  pending: 'orange',
  approved: 'green',
  rejected: 'red',
};
