import { HttpInterceptorFn } from '@angular/common/http';
import { isBackendApiRequest } from '../auth/csrf.utils';

export const IDEMPOTENCY_HEADER = 'Idempotency-Key';

/**
 * Adds an `Idempotency-Key` header (a fresh UUID) to every POST to the backend API that does not carry one already, so
 * the API replays the stored response when the same request is delivered twice (double click, network retry through
 * the service worker). A caller that retries on purpose sets its own header to keep the key across attempts.
 */
export const idempotencyInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.method !== 'POST' || !isBackendApiRequest(req.url) || req.headers.has(IDEMPOTENCY_HEADER)) {
    return next(req);
  }

  return next(req.clone({ setHeaders: { [IDEMPOTENCY_HEADER]: crypto.randomUUID() } }));
};
