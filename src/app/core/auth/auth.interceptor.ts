import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject, Injector } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { AuthStore } from './auth.store';
import { getXsrfCookie, isBackendApiRequest } from './csrf.utils';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Interceptor for Laravel Sanctum SPA Cookie-Based Authentication.
 *
 * Security Principles:
 * 1. Enforces `withCredentials: true` on all backend API requests so the browser automatically
 *    sends HTTP-only session cookies (`laravel_session`) and CSRF cookies (`XSRF-TOKEN`).
 * 2. Does NOT store or transmit tokens in `localStorage` or `Authorization: Bearer` headers,
 *    eliminating token theft vulnerabilities via XSS.
 * 3. Injects `X-Requested-With: XMLHttpRequest` and `Accept: application/json` so Laravel
 *    recognizes SPA requests and responds with JSON rather than web redirects.
 * 4. Extracts the browser-managed `XSRF-TOKEN` cookie and attaches it to the `X-XSRF-TOKEN`
 *    header on state-mutating requests (`POST`, `PUT`, `PATCH`, `DELETE`) for CSRF defense.
 * 5. Attaches `X-Tenant-Id` header when an active multi-tenant context is selected.
 * 6. Handles 401 Unauthorized: invalidates local auth state and redirects to `/login` with `returnUrl`.
 * 7. Handles 403 Forbidden and 429 Rate Limiting with appropriate user notifications.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!isBackendApiRequest(req.url)) {
    return next(req);
  }

  const injector = inject(Injector);

  const headersToSet: Record<string, string> = {
    'Accept': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  };

  // Attach CSRF token on mutating requests
  if (MUTATING_METHODS.has(req.method.toUpperCase()) && !req.headers.has('X-XSRF-TOKEN')) {
    const xsrfToken = getXsrfCookie('XSRF-TOKEN');
    if (xsrfToken) {
      headersToSet['X-XSRF-TOKEN'] = xsrfToken;
    }
  }

  // Attach multi-tenant header if active
  const tenantId =
    typeof window !== 'undefined' && window.localStorage
      ? window.localStorage.getItem('ff_active_tenant_id')
      : null;
  if (tenantId && !req.headers.has('X-Tenant-Id')) {
    headersToSet['X-Tenant-Id'] = tenantId;
  }

  const configuredReq = req.clone({
    withCredentials: true,
    setHeaders: headersToSet,
  });

  return next(configuredReq).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse) {
        const isAuthEndpoint =
          req.url.endsWith('/auth/login') ||
          req.url.endsWith('/auth/profile') ||
          req.url.endsWith('/sanctum/csrf-cookie');

        if (err.status === 401) {
          if (!isAuthEndpoint) {
            const router = injector.get(Router);
            const authStore = injector.get(AuthStore, null, { optional: true });
            const notification = injector.get(NzNotificationService);

            authStore?.logout?.();
            const currentUrl = router.url;
            if (!currentUrl.startsWith('/login')) {
              void router.navigate(['/login'], { queryParams: { returnUrl: currentUrl } });
              notification.warning(
                'Sessione Scaduta',
                'La sessione di autenticazione è scaduta. Effettua nuovamente il login.'
              );
            }
          }
        } else if (err.status === 403) {
          const notification = injector.get(NzNotificationService);
          const msg =
            (err.error && typeof err.error === 'object' && 'message' in err.error && err.error.message) ||
            'Non disponi delle autorizzazioni necessarie per questa operazione.';
          notification.error('Accesso Negato (403)', String(msg));
        } else if (err.status === 429) {
          const notification = injector.get(NzNotificationService);
          notification.warning(
            'Limite Richieste Superato (429)',
            'Troppe richieste inviate al server. Si prega di attendere qualche istante prima di riprovare.'
          );
        }
      }
      return throwError(() => err);
    })
  );
};
