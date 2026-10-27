import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { NzMessageService } from 'ng-zorro-antd/message';
import { catchError, throwError } from 'rxjs';
import { AuthStore } from '../auth/auth.store';
import { I18nService } from '../i18n';

/**
 * Surfaces system errors as toasts. HTTP 422 (Laravel validation) is passed
 * downstream untouched so forms can bind field errors. A 401 on any protected
 * API request ends the session and navigates to login.
 * Auth verification endpoints (/auth/login, /auth/me, /sanctum/...) manage their own errors.
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const message = inject(NzMessageService);
  const i18n = inject(I18nService);
  const authStore = inject(AuthStore);
  const router = inject(Router);

  return next(req).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse && err.status !== 422) {
        const isAuthCheck =
          req.url.endsWith('/auth/login') ||
          req.url.endsWith('/auth/me') ||
          req.url.includes('/sanctum/');

        const body: unknown = err.error;
        const apiMessage =
          typeof body === 'object' && body !== null && 'message' in body
            ? String((body as { message: unknown }).message)
            : null;

        if (isAuthCheck) {
          // The login form and auth guard handle 401 without emitting a session toast.
        } else if (err.status === 401) {
          const returnUrl = router.url;
          authStore.logout();
          if (!router.url.startsWith('/login')) {
            void router.navigate(['/login'], { queryParams: { returnUrl } });
          }
          message.warning(i18n.translate('ERRORS.SESSION_EXPIRED'));
        } else if (err.status === 0) {
          message.error(i18n.translate('ERRORS.NETWORK'));
        } else {
          message.error(apiMessage ?? i18n.translate('ERRORS.GENERIC', { status: err.status }));
        }
      }
      return throwError(() => err);
    }),
  );
};
