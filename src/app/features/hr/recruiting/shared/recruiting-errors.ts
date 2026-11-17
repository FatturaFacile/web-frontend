import { HttpErrorResponse } from '@angular/common/http';
import { RECRUITING_ERROR_CODES, RecruitingErrorCode } from '@core';

/** Extracts the 409 `error_code` from a recruiting API error, if any. */
export function recruitingErrorCode(err: unknown): RecruitingErrorCode | null {
  if (!(err instanceof HttpErrorResponse) || err.status !== 409) {
    return null;
  }
  const body: unknown = err.error;
  if (typeof body === 'object' && body !== null && 'error_code' in body) {
    const code = String((body as { error_code: unknown }).error_code);
    return (RECRUITING_ERROR_CODES as readonly string[]).includes(code)
      ? (code as RecruitingErrorCode)
      : null;
  }
  return null;
}

/** Server-provided `message` of an error response, if any. */
export function serverMessage(err: unknown): string | null {
  if (!(err instanceof HttpErrorResponse)) {
    return null;
  }
  const body: unknown = err.error;
  if (typeof body === 'object' && body !== null && 'message' in body) {
    const message = (body as { message: unknown }).message;
    return typeof message === 'string' && message ? message : null;
  }
  return null;
}

/** Laravel 422 field errors (`{ field: string[] }`), or `{}`. */
export function fieldErrors(err: unknown): Record<string, string> {
  if (!(err instanceof HttpErrorResponse) || err.status !== 422) {
    return {};
  }
  const body: unknown = err.error;
  if (typeof body !== 'object' || body === null || !('errors' in body)) {
    return {};
  }
  const errors = (body as { errors: unknown }).errors;
  if (typeof errors !== 'object' || errors === null) {
    return {};
  }
  const result: Record<string, string> = {};
  for (const [field, messages] of Object.entries(errors as Record<string, unknown>)) {
    const first = Array.isArray(messages) ? messages[0] : messages;
    if (typeof first === 'string') {
      result[field] = first;
    }
  }
  return result;
}

/**
 * Translation key describing a recruiting API failure:
 * 409 codes map to `hr.recruiting.errors.codes.<code>`, everything else to a generic key.
 */
export function recruitingErrorKey(
  err: unknown,
  fallbackKey = 'hr.recruiting.errors.generic',
): string {
  const code = recruitingErrorCode(err);
  if (code) {
    return `hr.recruiting.errors.codes.${code}`;
  }
  if (err instanceof HttpErrorResponse && err.status === 422) {
    return 'hr.recruiting.errors.validation';
  }
  return fallbackKey;
}
