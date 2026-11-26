import { HttpErrorResponse } from '@angular/common/http';
import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { CurrencyProblem } from '@core/models/currency-fx.model';

/** Digits with an optional fractional part of at most six decimals: the precision of a stored exchange rate. */
const RATE_PATTERN = /^\d+(\.\d{1,6})?$/u;

/** Trims the input and accepts a decimal comma. The value stays a string: a rate is never converted to a float. */
export function normalizeRate(input: string | null | undefined): string {
  return (input ?? '').trim().replace(',', '.');
}

/** A positive decimal string with at most six decimals ("0.941200", "1", "12.5"). */
export function isValidRate(input: string | null | undefined): boolean {
  const value = normalizeRate(input);
  return RATE_PATTERN.test(value) && /[1-9]/u.test(value);
}

/**
 * Validator of a rate field: `rateFormat` for anything that is not a decimal of at most six places and `ratePositive` for
 * zero. An empty value is left to `Validators.required`.
 */
export const rateValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const value = normalizeRate(control.value as string | null);
  if (value === '') {
    return null;
  }
  if (!RATE_PATTERN.test(value)) {
    return { rateFormat: true };
  }
  return /[1-9]/u.test(value) ? null : { ratePositive: true };
};

/** The JSON problem of a failed call, when the body is one. */
export function currencyProblemOf(error: unknown): CurrencyProblem | null {
  if (!(error instanceof HttpErrorResponse)) {
    return null;
  }
  const body: unknown = error.error;
  return body !== null && typeof body === 'object' ? (body as CurrencyProblem) : null;
}

/** First readable text of a problem: the first field error, then the detail, then the message. */
export function currencyProblemText(error: unknown): string | null {
  const problem = currencyProblemOf(error);
  if (problem === null) {
    return null;
  }
  const first = Object.values(problem.errors ?? {}).flat()[0];
  return first ?? problem.detail ?? problem.message ?? null;
}

/** Whether a call failed with `status` (and, when given, with that `code` in the problem body). */
export function isCurrencyFailure(error: unknown, status: number, code?: string): boolean {
  if (!(error instanceof HttpErrorResponse) || error.status !== status) {
    return false;
  }
  return code === undefined || currencyProblemOf(error)?.code === code;
}
