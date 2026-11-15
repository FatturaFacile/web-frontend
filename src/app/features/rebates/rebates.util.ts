import { HttpErrorResponse } from '@angular/common/http';
import { ContactResource, CrmApiService, RebateDirection } from '@core';
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

/** Display name of a contact (customer or supplier). */
export function contactLabel(contact: Pick<ContactResource, 'company_name' | 'first_name' | 'last_name'>): string {
  const company = (contact.company_name ?? '').trim();
  return company !== '' ? company : `${contact.first_name ?? ''} ${contact.last_name ?? ''}`.trim();
}

/** Customers of the company for a sales agreement, suppliers for a purchase one. */
export function loadContacts(crm: CrmApiService, direction: RebateDirection): Observable<ContactResource[]> {
  const request = direction === 'sales' ? crm.getClients({ per_page: 100 }) : crm.getSuppliers({ per_page: 100 });
  return request.pipe(
    map((response) => response.data),
    catchError(() => of([])),
  );
}

export const AGREEMENT_STATUS_COLORS: Readonly<Record<string, string>> = {
  draft: 'default',
  active: 'green',
  closed: 'blue',
  cancelled: 'red',
};

export const PROMOTION_STATE_COLORS: Readonly<Record<string, string>> = {
  active: 'green',
  scheduled: 'blue',
  expired: 'default',
  inactive: 'orange',
};
