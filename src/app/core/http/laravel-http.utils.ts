import { HttpParams } from '@angular/common/http';
import { FormGroup } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ApiValidationErrorResponse } from '../models/api.models';

/** Builds HttpParams, dropping undefined / null / empty-string values. */
export function toHttpParams(source: object): HttpParams {
  let params = new HttpParams();
  for (const [key, value] of Object.entries(source)) {
    if (value !== undefined && value !== null && value !== '') {
      params = params.set(key, String(value));
    }
  }
  return params;
}

export function isValidationError(err: unknown): err is HttpErrorResponse & {
  error: ApiValidationErrorResponse;
} {
  return err instanceof HttpErrorResponse && err.status === 422 && !!err.error?.errors;
}

/**
 * Binds a Laravel 422 response to the matching form controls via
 * `setErrors({ serverError: message })`. Dotted keys (`address.city`,
 * `items.0.quantity`) resolve through `FormGroup.get`.
 * Returns the messages of fields that could not be mapped to a control.
 */
export function applyServerErrors(form: FormGroup, err: unknown): string[] {
  if (!isValidationError(err)) {
    return [];
  }
  const unmapped: string[] = [];
  for (const [field, messages] of Object.entries(err.error.errors)) {
    const control = form.get(field);
    const message = (messages as string[])[0] ?? err.error.message;
    if (control) {
      control.setErrors({ serverError: message });
      control.markAsDirty();
    } else {
      unmapped.push(message);
    }
  }
  return unmapped;
}

/** Message to display in `nzErrorTip` for a control (server error first). */
export function serverErrorMessage(form: FormGroup, path: string): string | null {
  const error = form.get(path)?.errors?.['serverError'];
  return typeof error === 'string' ? error : null;
}

