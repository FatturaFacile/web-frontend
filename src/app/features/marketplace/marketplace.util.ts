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

/** Colours of the status tags. */
export const INSTALLATION_STATUS_COLORS: Readonly<Record<string, string>> = {
  pending_configuration: 'orange',
  disabled: 'default',
  enabled: 'green',
};

export const HEALTH_COLORS: Readonly<Record<string, string>> = {
  unknown: 'default',
  healthy: 'green',
  degraded: 'orange',
  unhealthy: 'red',
};

export const RUN_STATUS_COLORS: Readonly<Record<string, string>> = {
  running: 'blue',
  succeeded: 'green',
  failed: 'red',
  rate_limited: 'orange',
};
