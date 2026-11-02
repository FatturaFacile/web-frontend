import { HttpErrorResponse, HttpInterceptorFn, HttpClient } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { environment } from '@env';

function resolveBaseUrl(requestUrl?: string): string {
  if (requestUrl?.startsWith('http://') || requestUrl?.startsWith('https://')) {
    try {
      return new URL(requestUrl).origin;
    } catch {
      // Fallback
    }
  }
  const env = environment as Record<string, unknown>;
  const custom =
    (env['baseUrl'] as string | undefined) ?? (env['backendUrl'] as string | undefined);
  // An empty baseUrl means same-origin (dev proxy): keep the csrf-cookie URL relative
  if (custom !== undefined) {
    return custom.replace(/\/$/, '');
  }
  const apiBase =
    (env['apiBaseUrl'] as string | undefined) ?? (env['apiUrl'] as string | undefined);
  if (apiBase?.startsWith('http://') || apiBase?.startsWith('https://')) {
    try {
      return new URL(apiBase).origin;
    } catch {
      // Fallback
    }
  }
  return 'https://dev-api.fatturafacile.eu';
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
            // Re-execute original failed request with the refreshed token
            return next(req.clone({ withCredentials: true }));
          }),
          catchError((refreshErr: unknown) => throwError(() => refreshErr)),
        );
      }

      return throwError(() => error);
    }),
  );
};
