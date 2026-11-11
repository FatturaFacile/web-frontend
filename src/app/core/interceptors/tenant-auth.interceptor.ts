import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject, Injector } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { AuthStore, USER_ID_STORAGE_KEY } from '../auth/auth.store';
import { getXsrfCookie, isBackendApiRequest } from '../auth/csrf.utils';
import { purgeLegacyTokenKeys } from '../auth/token-storage.service';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Global Tenant & Auth Interceptor for Laravel Sanctum SPA Session Authentication.
 *
 * Enforces Cookie-First SPA Security:
 * 1. Strictly relies on HttpOnly session cookies (`faturafaciledev-session`) with `withCredentials: true`.
 *    Bearer tokens (`Authorization: Bearer <token>`) are deliberately omitted and never sent to prevent
 *    token storage vulnerabilities (XSS exfiltration) and avoid 401 errors from invalid personal access tokens.
 * 2. Transmits the CSRF token (`X-XSRF-TOKEN`) read from the decoded `XSRF-TOKEN` cookie on mutating requests.
 * 3. Transmits `X-Tenant-Id: <tenant-uuid>` dynamically from tenant state / storage.
 * 4. Transmits `X-Language-Code: <current-locale>` (e.g. it, en, de, fr).
 * 5. Sends standard SPA headers: `Accept: application/json` and `X-Requested-With: XMLHttpRequest`.
 * 6. Global error handling:
 *    - 401 Unauthorized: triggers session termination, purges legacy keys, and redirects to `/login`.
 *    - 422 Unprocessable Entity: surfaces server validation messages via NzNotificationService.
 *    - 403 Forbidden: notifies unauthorized operation.
 *    - 429 Too Many Requests: warns of rate limiting.
 */
export const tenantAuthInterceptor: HttpInterceptorFn = (req, next) => {
  if (!isBackendApiRequest(req.url)) {
    return next(req);
  }

  const injector = inject(Injector);

  const headersToSet: Record<string, string> = {
    'Accept': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  };

  // 1. Dynamic X-Tenant-Id
  let tenantId: string | null = null;
  if (typeof window !== 'undefined' && window.localStorage) {
    tenantId =
      window.localStorage.getItem('ff_active_tenant_id') ||
      window.localStorage.getItem('tenant_id') ||
      window.localStorage.getItem('ff_tenant_id');
  }
  if (tenantId && !req.headers.has('X-Tenant-Id')) {
    headersToSet['X-Tenant-Id'] = tenantId;
  }

  // 2. Dynamic X-Language-Code (+ Accept-Language, as the API accepts either)
  let languageCode: string | null = null;
  if (typeof window !== 'undefined' && window.localStorage) {
    languageCode = window.localStorage.getItem('lang') || window.localStorage.getItem('ff_lang');
  }
  if (languageCode && !req.headers.has('X-Language-Code')) {
    headersToSet['X-Language-Code'] = languageCode;
  }
  if (languageCode && !req.headers.has('Accept-Language')) {
    headersToSet['Accept-Language'] = languageCode;
  }

  // 2b. Dynamic X-User-Id: required together with X-Tenant-Id when the API enforces the request context.
  const userId =
    typeof window !== 'undefined' && window.localStorage
      ? window.localStorage.getItem(USER_ID_STORAGE_KEY)
      : null;
  if (userId && !req.headers.has('X-User-Id')) {
    headersToSet['X-User-Id'] = userId;
  }

  // 3. Attach CSRF token on mutating requests (POST, PUT, PATCH, DELETE)
  if (MUTATING_METHODS.has(req.method.toUpperCase()) && !req.headers.has('X-XSRF-TOKEN')) {
    const xsrfToken = getXsrfCookie('XSRF-TOKEN');
    if (xsrfToken) {
      headersToSet['X-XSRF-TOKEN'] = xsrfToken;
    }
  }

  // Note: withCredentials: true ensures browser session cookies (faturafaciledev-session) are sent.
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
          req.url.includes('/sanctum/csrf-cookie');

        if (err.status === 401) {
          if (!isAuthEndpoint) {
            const router = injector.get(Router);
            const authStore = injector.get(AuthStore, null, { optional: true });
            const notification = injector.get(NzNotificationService);

            authStore?.logout?.();
            purgeLegacyTokenKeys();

            const currentUrl = router.url;
            if (!currentUrl.startsWith('/login')) {
              void router.navigate(['/login'], { queryParams: { returnUrl: currentUrl } });
              notification.warning(
                'Sessione Scaduta',
                'La sessione di autenticazione è scaduta. Effettua nuovamente il login.'
              );
            }
          }
        } else if (err.status === 422) {
          const notification = injector.get(NzNotificationService, null, { optional: true });
          const errorBody = err.error as { message?: string; errors?: Record<string, string[]> } | null;
          let description = errorBody?.message || 'I dati inviati non sono validi.';

          if (errorBody?.errors && typeof errorBody.errors === 'object') {
            const fieldErrors = Object.entries(errorBody.errors)
              .map(([field, msgs]) => `${field}: ${Array.isArray(msgs) ? msgs.join(', ') : msgs}`)
              .join('; ');
            if (fieldErrors) {
              description = fieldErrors;
            }
          }

          notification?.error('Errore di Validazione (422)', description);
        } else if (err.status === 403) {
          const notification = injector.get(NzNotificationService, null, { optional: true });
          const msg =
            (err.error && typeof err.error === 'object' && 'message' in err.error && err.error.message) ||
            'Non disponi delle autorizzazioni necessarie per questa operazione.';
          notification?.error('Accesso Negato (403)', String(msg));
        } else if (err.status === 429) {
          const notification = injector.get(NzNotificationService, null, { optional: true });
          notification?.warning(
            'Limite Richieste Superato (429)',
            'Troppe richieste inviate al server. Si prega di attendere qualche istante prima di riprovare.'
          );
        }
      }
      return throwError(() => err);
    })
  );
};

export const authInterceptor: HttpInterceptorFn = tenantAuthInterceptor;
