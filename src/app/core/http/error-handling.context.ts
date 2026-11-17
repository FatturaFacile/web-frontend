import { HttpContext, HttpContextToken } from '@angular/common/http';

/**
 * HTTP status codes the caller handles itself (inline field errors, translated
 * business-rule messages, custom not-found states). The global error
 * interceptors skip their toast / redirect handling for these statuses.
 */
export const LOCALLY_HANDLED_ERROR_STATUSES = new HttpContextToken<readonly number[]>(() => []);

/** Builds an `HttpContext` that marks the given statuses as handled by the caller. */
export function handleErrorsLocally(...statuses: number[]): HttpContext {
  return new HttpContext().set(LOCALLY_HANDLED_ERROR_STATUSES, statuses);
}

/** True when the request declared that it handles `status` itself. */
export function isLocallyHandled(context: HttpContext, status: number): boolean {
  return context.get(LOCALLY_HANDLED_ERROR_STATUSES).includes(status);
}
