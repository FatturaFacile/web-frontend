import { HttpErrorResponse } from '@angular/common/http';

export function httpStatus(err: unknown): number | null {
  return err instanceof HttpErrorResponse ? err.status : null;
}

export function apiErrorMessage(err: unknown): string | null {
  if (err instanceof HttpErrorResponse) {
    const body: unknown = err.error;
    if (typeof body === 'object' && body !== null && 'message' in body) {
      const msg = (body as { message: unknown }).message;
      return typeof msg === 'string' && msg ? msg : null;
    }
  }
  return null;
}
