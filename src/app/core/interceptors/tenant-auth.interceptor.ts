import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject, Injector } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { AuthStore } from '../auth/auth.store';
import { getXsrfCookie, isBackendApiRequest } from '../auth/csrf.utils';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Global Tenant & Auth Interceptor.
 *
 * Enforces:
 * 1. `Authorization: Bearer <token>` when user is authenticated.
 * 2. `X-Tenant-Id: <tenant-uuid>` retrieved dynamically from tenant state / storage.
 * 3. `X-Language-Code: <current-locale>` (e.g. it, en, de, fr).
 * 4. CSRF protection (`X-XSRF-TOKEN`) on state-mutating requests.
 * 5. Global handling of HTTP 401 Unauthorized (session expiry -> redirect to /login)
 *    and HTTP 422 Unprocessable Entity (surfacing server validation messages via NzNotificationService).
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

  // 1. Authorization: Bearer <token>
  // Avoid injecting TokenStorageService or AuthStore synchronously to prevent circular dependency (NG0200)
  // during app bootstrap when I18nService fires HTTP requests in its constructor.
  let token: string | null = null;
  if (typeof window !== 'undefined' && window.localStorage) {
    token =
      window.localStorage.getItem('ff_access_token') ||
      window.localStorage.getItem('token') ||
      window.localStorage.getItem('auth_token');
  }
  if (token && !req.headers.has('Authorization')) {
    headersToSet['Authorization'] = `Bearer ${token}`;
  }

  // 2. X-Tenant-Id: <tenant-uuid>
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

  // 3. X-Language-Code: <current-locale>
  let languageCode: string | null = null;
  if (typeof window !== 'undefined' && window.localStorage) {
    languageCode = window.localStorage.getItem('lang') || window.localStorage.getItem('ff_lang');
  }
  if (languageCode && !req.headers.has('X-Language-Code')) {
    headersToSet['X-Language-Code'] = languageCode;
  }

  // 4. Attach CSRF token on mutating requests
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
            if (typeof window !== 'undefined' && window.localStorage) {
              window.localStorage.removeItem('ff_access_token');
              window.localStorage.removeItem('token');
              window.localStorage.removeItem('auth_token');
            }

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
