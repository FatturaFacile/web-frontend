import { HttpErrorResponse } from '@angular/common/http';
import { ReturnsClaimStatus, ReturnsSupplierReturnStatus, ReturnsWarranty, RmaStatus } from '@core';

/** The name fields of a contact (customer or supplier). */
export interface ContactNameFields {
  company_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
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

/** Today as Y-m-d in the browser time zone, the default of the date inputs. */
export function todayIso(): string {
  return toIso(new Date());
}

/** Y-m-d of a date in the browser time zone. */
export function toIso(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** The same day one year later, the default end of a warranty. */
export function oneYearAfter(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  return toIso(new Date(year + 1, month - 1, day));
}

/** Name of a customer or supplier contact for a select. */
export function contactName(contact: ContactNameFields): string {
  const company = contact.company_name?.trim();
  if (company) {
    return company;
  }

  return [contact.first_name, contact.last_name].filter((part) => !!part).join(' ');
}

export const RMA_STATUS_COLORS: Readonly<Record<RmaStatus, string>> = {
  requested: 'gold',
  approved: 'blue',
  received: 'cyan',
  inspected: 'purple',
  resolved: 'green',
  rejected: 'red',
  closed: 'default',
};

export const CLAIM_STATUS_COLORS: Readonly<Record<ReturnsClaimStatus, string>> = {
  open: 'gold',
  accepted: 'blue',
  rejected: 'red',
  resolved: 'green',
};

export const SUPPLIER_RETURN_STATUS_COLORS: Readonly<Record<ReturnsSupplierReturnStatus, string>> = {
  draft: 'default',
  shipped: 'blue',
  credited: 'green',
  closed: 'default',
  cancelled: 'red',
};

/** Colour of the validity of a warranty: green while it covers, orange when it ends within 30 days, red otherwise. */
export function warrantyColor(warranty: ReturnsWarranty): string {
  if (!warranty.validity.valid) {
    return 'red';
  }

  return warranty.validity.days_left <= 30 ? 'orange' : 'green';
}
