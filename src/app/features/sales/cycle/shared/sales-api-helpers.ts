import { HttpErrorResponse } from '@angular/common/http';
import { CoreOrder } from '@core';

/**
 * The credit hold that can be released for an order: `credit_hold_id` when the API sends it, else the active entry of
 * `holds`; null when the order exposes none (the release then goes through the credit page).
 */
export function creditHoldIdOf(order: Pick<CoreOrder, 'credit_hold_id' | 'holds'>): string | null {
  return order.credit_hold_id ?? order.holds?.find((hold) => hold.status === 'active')?.id ?? null;
}

/** Best human readable text of an API error (RFC 7807 detail, `message` or the first 422 field error). */
export function apiErrorText(err: unknown): string {
  if (!(err instanceof HttpErrorResponse)) {
    return '';
  }
  const body = err.error as {
    detail?: string;
    message?: string;
    errors?: Record<string, string[]>;
  } | null;
  const firstField = body?.errors ? Object.values(body.errors)[0]?.[0] : undefined;
  return firstField ?? body?.detail ?? body?.message ?? '';
}

/** 403 means the role may not run the action (credit limit, hold release, approval ...). */
export function isForbidden(err: unknown): boolean {
  return err instanceof HttpErrorResponse && err.status === 403;
}

/** Roles that may set credit limits and release credit holds (the API answers 403 to anyone else). */
export const CREDIT_MANAGER_ROLES: readonly string[] = ['owner', 'admin', 'accountant', 'sales_manager'];

/** Roles that may maintain promotions and discount policies. */
export const SALES_MANAGER_ROLES: readonly string[] = ['owner', 'admin', 'sales_manager'];

export function hasAnyRole(activeRoles: readonly string[], allowed: readonly string[]): boolean {
  return activeRoles.some((role) => allowed.includes(role.trim().toLowerCase()));
}
