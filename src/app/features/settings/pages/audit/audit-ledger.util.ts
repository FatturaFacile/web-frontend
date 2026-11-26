import { HttpErrorResponse } from '@angular/common/http';
import { AUDIT_ERASED_LABEL, AuditChanges, AuditIntegrityStatus } from '@core';

/** Why a request to the ledger failed, so a screen shows the right translated message and never invents data. */
export type AuditFailure = 'forbidden' | 'invalid' | 'generic';

export function failureOf(error: unknown): AuditFailure {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 403) {
      return 'forbidden';
    }
    if (error.status === 422) {
      return 'invalid';
    }
  }
  return 'generic';
}

/** Translation key of the error state (`nz-result status="error"`). */
export function failureTitleKey(failure: AuditFailure): string {
  return failure === 'forbidden' ? 'settings.audit.error.forbidden' : 'settings.audit.error.title';
}

/** Key of the label of an action; an action the dictionary does not know falls back to `audit.actions.unknown`. */
export function actionKey(action: string, known: (key: string) => boolean): string {
  const key = `audit.actions.${action}`;
  return known(key) ? key : 'audit.actions.unknown';
}

/** The actor to show: the API sends a pseudonymised subject whose name was erased as a fixed label. */
export function isErasedActor(label: string | null | undefined): boolean {
  return label === AUDIT_ERASED_LABEL;
}

/** One cell of the old/new diff, as text. Objects are shown as JSON, never as `[object Object]`. */
export function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '—';
  }
  if (typeof value === 'string') {
    return value === '' ? '""' : value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return JSON.stringify(value);
}

export interface DiffRow {
  field: string;
  old: string;
  new: string;
}

/** The changed fields of an entry in a stable (alphabetical) order. */
export function diffRows(changes: AuditChanges | null | undefined): DiffRow[] {
  return Object.entries(changes ?? {})
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([field, change]) => ({
      field,
      old: formatValue(change.old),
      new: formatValue(change.new),
    }));
}

/** Colour of the integrity badge. */
export function integrityColor(status: AuditIntegrityStatus): string {
  switch (status) {
    case 'valid':
      return 'success';
    case 'running':
      return 'processing';
    case 'never_verified':
      return 'default';
    default:
      return 'error';
  }
}

export function categoryColor(category: string): string {
  switch (category) {
    case 'security':
      return 'red';
    case 'access':
      return 'orange';
    case 'business':
      return 'blue';
    case 'platform':
      return 'purple';
    default:
      return 'default';
  }
}

/** Limit of a window the API accepts (366 days); the screens refuse a longer one before calling it. */
export const AUDIT_MAX_WINDOW_DAYS = 366;

export function windowIsTooLong(from: Date | null, to: Date | null): boolean {
  if (!from || !to) {
    return false;
  }
  const days = Math.floor((to.getTime() - from.getTime()) / 86_400_000);
  return days > AUDIT_MAX_WINDOW_DAYS;
}

/** `yyyy-MM-dd` of a local date, the format the API validates. */
export function isoDay(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}
