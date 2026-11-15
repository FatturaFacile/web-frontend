import { HttpErrorResponse } from '@angular/common/http';
import { AccountingApiService, BudgetVersionStatus, GeneralLedgerApiService } from '@core';
import { catchError, map, Observable, of } from 'rxjs';

/** A ledger dimension (account or cost centre) offered in a select. */
export interface DimensionOption {
  id: string;
  label: string;
}

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

/** The twelve seasonal weights typed as a list separated by commas, spaces or semicolons; null when the text is empty. */
export function parseWeights(text: string | null | undefined): number[] | null {
  const parts = (text ?? '')
    .split(/[\s,;]+/)
    .map((part) => part.trim())
    .filter((part) => part !== '');

  return parts.length === 0 ? null : parts.map((part) => Number(part));
}

/** Whether the typed list holds exactly twelve non-negative numbers (or nothing at all). */
export function validWeights(text: string | null | undefined): boolean {
  const weights = parseWeights(text);
  return weights === null || (weights.length === 12 && weights.every((weight) => Number.isFinite(weight) && weight >= 0) && weights.some((weight) => weight > 0));
}

/** Accounts of the chart of accounts. Members without access to the ledger get an empty list. */
export function loadAccounts(accounting: AccountingApiService): Observable<DimensionOption[]> {
  return accounting.getAccounts().pipe(
    map((response) => response.data.map((account) => ({ id: account.id, label: `${account.account_code} ${account.name}` }))),
    catchError(() => of([])),
  );
}

/** Cost centres of the ledger. Members without access to the ledger get an empty list. */
export function loadCostCenters(ledger: GeneralLedgerApiService): Observable<DimensionOption[]> {
  return ledger.getCostCenters().pipe(
    map((response) => response.data.map((center) => ({ id: center.id, label: `${center.code} ${center.name}` }))),
    catchError(() => of([])),
  );
}

/** Colours of the version status tags. */
export const VERSION_STATUS_COLORS: Readonly<Record<BudgetVersionStatus, string>> = {
  draft: 'default',
  submitted: 'orange',
  approved: 'green',
  locked: 'blue',
};
