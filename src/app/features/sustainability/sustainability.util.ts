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

/** Today as Y-m-d in the browser time zone, the default of the date inputs. */
export function todayIso(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

/** Converts a decimal string of kilograms to tonnes for display only (the API keeps the exact figures). */
export function kgToTonnes(kg: string | null | undefined): number {
  return (Number(kg ?? 0) || 0) / 1000;
}
