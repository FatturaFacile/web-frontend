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

/** Value of a datetime-local input (`Y-m-dTH:i`) as the `Y-m-d H:i:s` the API expects. */
export function toApiDateTime(value: string): string {
  const text = value.replace('T', ' ');
  return text.length === 16 ? `${text}:00` : text;
}

/** A `Y-m-d H:i:s` API timestamp as the value of a datetime-local input. */
export function toInputDateTime(value: string | null | undefined): string {
  return (value ?? '').replace(' ', 'T').slice(0, 16);
}

/** Now as a datetime-local input value in the browser time zone, rounded to the hour. */
export function nowInput(): string {
  const now = new Date();
  const pad = (number: number): string => String(number).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:00`;
}

export const EVENT_STATUS_COLORS: Readonly<Record<string, string>> = {
  draft: 'default',
  published: 'green',
  closed: 'blue',
  cancelled: 'red',
};

export const REGISTRATION_STATUS_COLORS: Readonly<Record<string, string>> = {
  confirmed: 'green',
  waitlisted: 'orange',
  cancelled: 'default',
};
