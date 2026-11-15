import { HttpErrorResponse } from '@angular/common/http';
import { ContactResource, CrmApiService, LegalCase, PracticeClientRef, ProfessionalsApiService } from '@core';
import { catchError, map, Observable, of } from 'rxjs';

/** First validation message of a Laravel 422 (or its detail) so the user sees the real reason. */
export function apiErrorText(error: unknown): string | null {
  if (!(error instanceof HttpErrorResponse)) {
    return null;
  }

  const body = error.error as { detail?: unknown; message?: unknown; errors?: Record<string, unknown> } | null;
  const first = Object.values(body?.errors ?? {})[0];
  if (Array.isArray(first) && typeof first[0] === 'string') {
    return first[0];
  }
  if (typeof body?.detail === 'string' && body.detail !== '') {
    return body.detail;
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

/** Display name of a client as the practice endpoints embed it. */
export function clientName(client: PracticeClientRef | ContactResource | undefined): string {
  if (!client) {
    return '';
  }
  return client.company_name || [client.first_name, client.last_name].filter(Boolean).join(' ');
}

export function loadClients(crm: CrmApiService): Observable<ContactResource[]> {
  return crm.getContacts({ per_page: 100 }).pipe(
    map((response) => response.data),
    catchError(() => of([])),
  );
}

export function loadCases(professionals: ProfessionalsApiService): Observable<LegalCase[]> {
  return professionals.getCases({ per_page: 100 }).pipe(
    map((response) => response.data),
    catchError(() => of([])),
  );
}

export const CONFLICT_RESULT_COLORS: Readonly<Record<string, string>> = { clear: 'green', review: 'orange', conflict: 'red' };

export const PROPOSAL_STATUS_COLORS: Readonly<Record<string, string>> = { draft: 'default', sent: 'blue', accepted: 'green', declined: 'red' };
