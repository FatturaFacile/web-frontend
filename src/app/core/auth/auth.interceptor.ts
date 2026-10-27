import { HttpInterceptorFn } from '@angular/common/http';
import { getXsrfCookie, isBackendApiRequest } from './csrf.utils';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Interceptor for Laravel Sanctum SPA cookie-based authentication.
 *
 * Responsibilities:
 * 1. Automatically enforces `withCredentials: true` on all outgoing backend API requests
 *    so browser session cookies (`laravel_session`) and CSRF cookies (`XSRF-TOKEN`) are transmitted.
 * 2. Adds `X-Requested-With: XMLHttpRequest` and `Accept: application/json` headers
 *    so Laravel Sanctum recognizes SPA requests and yields JSON responses rather than web redirects.
 * 3. Extracts the browser-managed `XSRF-TOKEN` cookie and attaches it to the `X-XSRF-TOKEN`
 *    header on mutating HTTP requests (`POST`, `PUT`, `PATCH`, `DELETE`).
 * 4. Completely avoids Bearer token injection from `localStorage`/`sessionStorage`.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!isBackendApiRequest(req.url)) {
    return next(req);
  }

  const headersToSet: Record<string, string> = {};

  if (!req.headers.has('X-Requested-With')) {
    headersToSet['X-Requested-With'] = 'XMLHttpRequest';
  }

  if (!req.headers.has('Accept')) {
    headersToSet['Accept'] = 'application/json';
  }

  if (MUTATING_METHODS.has(req.method.toUpperCase()) && !req.headers.has('X-XSRF-TOKEN')) {
    const xsrfToken = getXsrfCookie('XSRF-TOKEN');
    if (xsrfToken) {
      headersToSet['X-XSRF-TOKEN'] = xsrfToken;
    }
  }

  const configuredReq = req.clone({
    withCredentials: true,
    setHeaders: headersToSet,
  });

  return next(configuredReq);
};
