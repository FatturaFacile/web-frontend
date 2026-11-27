import { HttpErrorResponse } from '@angular/common/http';
import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import {
  CategoryPurpose,
  ChargeBearer,
  IsoUploadResult,
  LineCategory,
  ReconciliationExceptionCode,
} from '@core/models/iso20022.model';
import { isValidIban, normalizeIban } from '@shared/utils/iban-validator';
import { validationTipKey } from '@shared/utils/validation-tip';

export const EXCEPTION_CODES: readonly ReconciliationExceptionCode[] = [
  'Unmatched',
  'AmountMismatch',
  'DuplicatePayment',
  'AlreadyPaid',
  'InvalidReference',
];

export const CATEGORY_PURPOSES: readonly CategoryPurpose[] = ['SALA', 'SUPP', 'TAXS', 'PENS', 'BONU', 'TRAD'];

export const CHARGE_BEARERS: readonly ChargeBearer[] = ['SLEV', 'SHAR', 'DEBT', 'CRED'];

export const LINE_CATEGORIES: readonly LineCategory[] = [
  'tax_payment',
  'payroll',
  'bank_expense',
  'internal_transfer',
  'generic_expense',
];

/** ISO 20022 external status codes of a pain.002 transaction. */
export const PAIN002_STATUSES: readonly string[] = ['ACCP', 'ACSP', 'ACSC', 'ACWC', 'ACTC', 'PDNG', 'PART', 'RJCT'];

/** Rejection reason codes with their own translation; every other code falls back to the generic one. */
export const REJECTION_REASONS: readonly string[] = [
  'AC01',
  'AC04',
  'AC06',
  'AG01',
  'AM01',
  'AM02',
  'AM04',
  'AM05',
  'BE01',
  'DT01',
  'FF01',
  'MD01',
  'MS02',
  'MS03',
  'NARR',
  'RC01',
  'RR01',
  'RR04',
  'TM01',
];

export const ISO_XML_MAX_BYTES = 10 * 1024 * 1024;

export const QR_IID_MIN = 30000;
export const QR_IID_MAX = 31999;

export function reasonKey(code: string | null | undefined): string {
  const normalized = (code ?? '').trim().toUpperCase();

  return REJECTION_REASONS.includes(normalized)
    ? `treasuryIso.reason.${normalized}`
    : 'treasuryIso.reason.UNKNOWN';
}

/** Key of a pain.002 status, or null when the code is not a standard one (the raw code is then shown). */
export function statusKey(code: string | null | undefined): string | null {
  const normalized = (code ?? '').trim().toUpperCase();

  return PAIN002_STATUSES.includes(normalized) ? `treasuryIso.status.${normalized}` : null;
}

export function isIsoXmlFile(file: { name: string; size: number }): boolean {
  return /\.xml$/i.test(file.name) && file.size > 0 && file.size <= ISO_XML_MAX_BYTES;
}

export interface IsoUploadTotals {
  files: number;
  failed: number;
  reconciled: number;
  unmatched: number;
  duplicates: number;
}

export function uploadTotals(results: readonly { result: IsoUploadResult | null }[]): IsoUploadTotals {
  const totals: IsoUploadTotals = { files: results.length, failed: 0, reconciled: 0, unmatched: 0, duplicates: 0 };

  for (const { result } of results) {
    if (result === null) {
      totals.failed += 1;
      continue;
    }

    totals.reconciled += result.reconciliation?.reconciled ?? 0;
    totals.unmatched += result.reconciliation?.unmatched ?? 0;
    totals.duplicates += result.duplicates ?? 0;
  }

  return totals;
}

export interface SplitApiErrors {
  general: string[];
  /** Messages of `lines.N.field` keys, by zero based line index. */
  lines: Record<number, string[]>;
}

/** Separates the 422 messages of one payment line (`lines.N.invoice_id`, `lines.N.end_to_end_id`) from the others. */
export function splitApiErrors(error: unknown): SplitApiErrors {
  const split: SplitApiErrors = { general: [], lines: {} };

  if (!(error instanceof HttpErrorResponse)) {
    return split;
  }

  const errors = error.error?.errors as Record<string, string[]> | undefined;

  if (!errors) {
    const detail = error.error?.detail ?? error.error?.title ?? error.error?.message;

    if (typeof detail === 'string' && detail !== '') {
      split.general.push(detail);
    }

    return split;
  }

  for (const [key, messages] of Object.entries(errors)) {
    const match = /^lines\.(\d+)\./.exec(key);

    if (match) {
      const index = Number(match[1]);
      split.lines[index] = [...(split.lines[index] ?? []), ...messages];
    } else {
      split.general.push(...messages);
    }
  }

  return split;
}

/** The message of a failed upload: Problem Details detail, validation errors or the plain message. */
export function uploadErrorMessage(error: unknown): string {
  if (!(error instanceof HttpErrorResponse)) {
    return '';
  }

  const errors = error.error?.errors as Record<string, string[]> | undefined;
  const first = errors ? Object.values(errors).flat()[0] : undefined;
  const detail = error.error?.detail ?? error.error?.title ?? error.error?.message;

  return first ?? (typeof detail === 'string' ? detail : '');
}

const empty = (value: unknown): boolean => value === null || value === undefined || value === '';

/** A 5 digit institution identifier (QR-IID) within 30000-31999. Error: `{ qrIid: true }`. */
export const qrIidValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  if (empty(control.value)) {
    return null;
  }

  const text = String(control.value);

  return /^\d{5}$/.test(text) && Number(text) >= QR_IID_MIN && Number(text) <= QR_IID_MAX
    ? null
    : { qrIid: true };
};

/** A BESR/ESR participant identification of 6 to 9 digits. Error: `{ besrId: true }`. */
export const besrIdValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null =>
  empty(control.value) || /^\d{6,9}$/.test(String(control.value)) ? null : { besrId: true };

/** A Swiss or Liechtenstein IBAN whose institution identifier is a QR-IID. Error: `{ qrIban: true }`. */
export const qrIbanValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  if (empty(control.value)) {
    return null;
  }

  const iban = normalizeIban(String(control.value));
  const iid = Number(iban.slice(4, 9));

  return /^(CH|LI)/.test(iban) && isValidIban(iban) && iid >= QR_IID_MIN && iid <= QR_IID_MAX
    ? null
    : { qrIban: true };
};

/** A non negative amount with at most two decimals. Error: `{ amount: true }`. */
export const moneyAmountValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  if (empty(control.value)) {
    return null;
  }

  const value = Number(control.value);

  return Number.isFinite(value) && value >= 0 && Math.abs(value * 100 - Math.round(value * 100)) < 1e-6
    ? null
    : { amount: true };
};

const VALIDATION_KEYS: readonly [string, string][] = [
  ['qrIban', 'treasuryIso.validation.qrIban'],
  ['qrIid', 'treasuryIso.validation.qrIid'],
  ['besrId', 'treasuryIso.validation.besrId'],
  ['amount', 'treasuryIso.validation.amount'],
];

/** Translation key of the first error of a bank configuration control; the shared rules keep their own message. */
export function isoValidationKey(control: AbstractControl | null): string {
  const found = VALIDATION_KEYS.find(([error]) => control?.hasError(error));

  return found ? found[1] : validationTipKey(control);
}
