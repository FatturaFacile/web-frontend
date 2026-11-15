import { HttpErrorResponse } from '@angular/common/http';
import { EmployeeResource, HrApiService } from '@core';
import { catchError, map, Observable, of } from 'rxjs';

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

/** An empty text input is sent to the API as null. */
export function blankToNull(value: string | null | undefined): string | null {
  const text = (value ?? '').trim();
  return text === '' ? null : text;
}

/** A decimal input is sent to the API as a string, an empty one as null. */
export function decimalOrNull(value: number | string | null | undefined): string | null {
  return value === null || value === undefined || value === '' ? null : String(value);
}

/**
 * Employees to attribute a vehicle to. Members without access to the HR module get an empty list: the screens then fall
 * back to the free-text driver name or leave the driver to the automatic attribution of the API.
 */
export function loadEmployees(hr: HrApiService): Observable<EmployeeResource[]> {
  return hr.getEmployees({ per_page: 100 }).pipe(
    map((response) => response.data),
    catchError(() => of([])),
  );
}

/** Colours of the status tags. */
export const VEHICLE_STATUS_COLORS: Readonly<Record<string, string>> = {
  active: 'green',
  maintenance: 'orange',
  sold: 'default',
  disposed: 'default',
};

export const PAYMENT_STATUS_COLORS: Readonly<Record<string, string>> = {
  unpaid: 'red',
  paid: 'green',
  contested: 'orange',
  cancelled: 'default',
};
