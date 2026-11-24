import { HttpErrorResponse, HttpInterceptorFn, HttpClient } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { getSanctumBaseUrl, getXsrfCookie } from '../auth/csrf.utils';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// Absolute requests refresh the token on their own origin; relative ones use the configured backend
// origin, which is empty (same-origin) when the API base URL is relative
function resolveBaseUrl(requestUrl: string): string {
  if (requestUrl.startsWith('http://') || requestUrl.startsWith('https://')) {
    try {
      return new URL(requestUrl).origin;
    } catch {
      // Fallback
    }
  }
  return getSanctumBaseUrl();
}

export const csrfRefreshInterceptor: HttpInterceptorFn = (req, next) => {
  const http = inject(HttpClient);
  const baseUrl = resolveBaseUrl(req.url);

  return next(req).pipe(
    catchError((error: unknown) => {
      // Intercept 419 CSRF Token Mismatch and avoid infinite loops on the csrf-cookie route itself
      if (
        error instanceof HttpErrorResponse &&
        error.status === 419 &&
        !req.url.includes('/sanctum/csrf-cookie')
      ) {
        return http.get(`${baseUrl}/sanctum/csrf-cookie`, { withCredentials: true }).pipe(
          switchMap(() => {
            // Re-execute original failed request with the refreshed token and withCredentials
            const freshXsrf = getXsrfCookie('XSRF-TOKEN');
            let updatedReq = req.clone({ withCredentials: true });
            if (freshXsrf && MUTATING_METHODS.has(req.method.toUpperCase())) {
              updatedReq = updatedReq.clone({
                setHeaders: { 'X-XSRF-TOKEN': freshXsrf },
              });
            }
            return next(updatedReq);
          }),
          catchError((refreshErr: unknown) => throwError(() => refreshErr)),
        );
      }

      return throwError(() => error);
    }),
  );
};
