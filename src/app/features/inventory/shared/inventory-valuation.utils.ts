import { HttpErrorResponse } from '@angular/common/http';
import { FormGroup } from '@angular/forms';
import {
  applyServerErrors,
  isValidationError,
  DownloadedFile,
  LandedCostAllocationKey,
  LandedCostStatus,
  LandedCostType,
  ValuationMethod,
  ValuationMethodSource,
} from '@core';

/** Up to 2 decimals, strictly positive amounts are checked separately. */
export const AMOUNT_PATTERN = /^\d{1,12}(\.\d{1,2})?$/;
/** Up to 4 decimals (unit costs, weights, volumes). */
export const DECIMAL4_PATTERN = /^\d{1,10}(\.\d{1,4})?$/;

export const VALUATION_METHOD_LABELS: Record<ValuationMethod, string> = {
  fifo: 'INVENTORY.VALUATION.METHOD_FIFO',
  weighted_average: 'INVENTORY.VALUATION.METHOD_WEIGHTED_AVERAGE',
  standard_cost: 'INVENTORY.VALUATION.METHOD_STANDARD_COST',
};

export const VALUATION_SOURCE_LABELS: Record<ValuationMethodSource, { key: string; color: string }> = {
  item: { key: 'INVENTORY.VALUATION.SOURCE_ITEM', color: 'blue' },
  category: { key: 'INVENTORY.VALUATION.SOURCE_CATEGORY', color: 'default' },
  default: { key: 'INVENTORY.VALUATION.SOURCE_DEFAULT', color: 'default' },
};

export const LANDED_COST_STATUS_LABELS: Record<LandedCostStatus, { key: string; color: string }> = {
  draft: { key: 'INVENTORY.LANDED_COSTS.STATUS_DRAFT', color: 'default' },
  applied: { key: 'INVENTORY.LANDED_COSTS.STATUS_APPLIED', color: 'success' },
  reversed: { key: 'INVENTORY.LANDED_COSTS.STATUS_REVERSED', color: 'warning' },
};

export const LANDED_COST_TYPE_LABELS: Record<LandedCostType, string> = {
  freight: 'INVENTORY.LANDED_COSTS.TYPE_FREIGHT',
  customs_duty: 'INVENTORY.LANDED_COSTS.TYPE_CUSTOMS_DUTY',
  insurance: 'INVENTORY.LANDED_COSTS.TYPE_INSURANCE',
  brokerage: 'INVENTORY.LANDED_COSTS.TYPE_BROKERAGE',
  other: 'INVENTORY.LANDED_COSTS.TYPE_OTHER',
};

export const ALLOCATION_KEY_LABELS: Record<LandedCostAllocationKey, string> = {
  value: 'INVENTORY.LANDED_COSTS.KEY_VALUE',
  weight: 'INVENTORY.LANDED_COSTS.KEY_WEIGHT',
  volume: 'INVENTORY.LANDED_COSTS.KEY_VOLUME',
  quantity: 'INVENTORY.LANDED_COSTS.KEY_QUANTITY',
};

/** Translation key describing an HTTP failure (never crashes on unknown errors). */
export function inventoryErrorKey(err: unknown): string {
  const status = err instanceof HttpErrorResponse ? err.status : -1;
  switch (status) {
    case 401:
      return 'ERRORS.SESSION_EXPIRED';
    case 403:
      return 'INVENTORY.ERRORS.FORBIDDEN';
    case 404:
      return 'INVENTORY.ERRORS.NOT_FOUND';
    case 409:
      return 'INVENTORY.ERRORS.CONFLICT';
    case 422:
      return 'INVENTORY.ERRORS.VALIDATION';
    default:
      return 'INVENTORY.ERRORS.GENERIC';
  }
}

export function httpStatus(err: unknown): number | null {
  return err instanceof HttpErrorResponse ? err.status : null;
}

/** Laravel `message` of an error body, when it is JSON. */
export function serverMessage(err: unknown): string | null {
  if (!(err instanceof HttpErrorResponse)) {
    return null;
  }
  const body: unknown = err.error;
  if (body !== null && typeof body === 'object' && 'message' in body) {
    const msg = (body as { message: unknown }).message;
    return typeof msg === 'string' && msg.trim() ? msg : null;
  }
  return null;
}

/** Flattened Laravel 422 messages (`errors.*[]`), falling back to `message`. */
export function validationMessages(err: unknown): string[] {
  if (!(err instanceof HttpErrorResponse)) {
    return [];
  }
  const body: unknown = err.error;
  if (body !== null && typeof body === 'object' && 'errors' in body) {
    const errors = (body as { errors: unknown }).errors;
    if (errors !== null && typeof errors === 'object') {
      const list = Object.values(errors as Record<string, unknown>).flatMap((v) =>
        Array.isArray(v) ? v.map(String) : [String(v)],
      );
      if (list.length) {
        return list;
      }
    }
  }
  const msg = serverMessage(err);
  return msg ? [msg] : [];
}

/** True when a decimal string represents zero (`"0"`, `"0.00"`, `"-0.0000"`). No float maths. */
export function isZeroAmount(value: string | number | null | undefined): boolean {
  if (value === null || value === undefined || value === '') {
    return true;
  }
  return /^[-+]?0*(\.0*)?$/.test(String(value).trim());
}

/** True when a decimal string is a strictly positive amount. No float maths. */
export function isPositiveAmount(value: string | null | undefined): boolean {
  const v = (value ?? '').trim();
  return AMOUNT_PATTERN.test(v) && !isZeroAmount(v);
}

/** Local calendar date as `YYYY-MM-DD` (no timezone shift). */
export function toIsoDate(date: Date | null | undefined): string | undefined {
  if (!date || isNaN(date.getTime())) {
    return undefined;
  }
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${mm}-${dd}`;
}

/** Triggers a browser download of a fetched file. */
export function saveDownloadedFile(file: DownloadedFile): void {
  const url = URL.createObjectURL(file.blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = file.filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * Binds a 422 to the form (see `applyServerErrors`) and returns the messages
 * to show above it: unmapped field errors, or the bare `message` of a 422
 * without `errors` (e.g. a closed period).
 */
export function bindServerErrors(form: FormGroup, err: unknown): string[] {
  const unmapped = applyServerErrors(form, err);
  if (unmapped.length || isValidationError(err)) {
    return unmapped;
  }
  return httpStatus(err) === 422 ? validationMessages(err) : [];
}
