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

/** Colours of the traffic light tags of the variance. */
export const TRAFFIC_LIGHT_COLORS: Readonly<Record<'green' | 'amber' | 'red', string>> = {
  green: 'green',
  amber: 'orange',
  red: 'red',
};

/** Colours of the outcome of a spend control. */
export const SPEND_OUTCOME_COLORS: Readonly<Record<string, string>> = {
  ok: 'green',
  warning: 'orange',
  overridden: 'blue',
  blocked: 'red',
};

/** Colours of the status of an override request. */
export const OVERRIDE_STATUS_COLORS: Readonly<Record<string, string>> = {
  pending: 'orange',
  approved: 'green',
  rejected: 'red',
  cancelled: 'default',
  consumed: 'blue',
};

/** A UUID typed in a project field: empty is allowed. */
export const OPTIONAL_UUID_PATTERN = /^$|^[0-9a-fA-F-]{36}$/;

/** The key of the translation of an enum value, e.g. `BUDGETING_CONTROL.MODE_HARD_BLOCK`. */
export function enumKey(prefix: string, value: string): string {
  return `${prefix}_${value.toUpperCase()}`;
}

/** Whether a version in this state can be rejected: a formal budget (original or revised) is never reopened once approved. */
export function canRejectVersion(status: string, formal: boolean): boolean {
  return status === 'submitted' || (status === 'approved' && !formal);
}

/** Width in percent of a bar for an amount against the largest amount of the chart (never below 1% for a non-zero amount). */
export function barWidth(amount: string | number, max: number): number {
  const value = Math.abs(Number(amount));
  if (!Number.isFinite(value) || max <= 0 || value === 0) {
    return 0;
  }
  return Math.max(1, Math.min(100, Math.round((value / max) * 100)));
}

/** The first day of the month typed as `YYYY-MM` from a date. */
export function monthOf(date: string | null | undefined): string | null {
  return date && /^\d{4}-\d{2}/.test(date) ? date.slice(0, 7) : null;
}
