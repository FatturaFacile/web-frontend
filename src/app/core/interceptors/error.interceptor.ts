import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject, Injector } from '@angular/core';
import { Router } from '@angular/router';
import { NzMessageService } from 'ng-zorro-antd/message';
import { catchError, throwError } from 'rxjs';
import { AuthStore } from '../auth/auth.store';
import { I18nService } from '../i18n';

interface ProblemDetails {
  type?: string;
  title?: string;
  detail?: string;
  status?: number;
  message?: string;
  errors?: Record<string, string[]>;
}

/**
 * Global RFC 7807 Problem Details and system error interceptor.
 * HTTP 422 (validation errors) passes downstream untouched so reactive forms can bind field errors with nzErrorTip.
 * HTTP 401: ends the session and returns to login (except unauthenticated check endpoints).
 * HTTP 403 (two-factor-setup-required): triggers the mandatory 2FA setup wizard in AuthStore.
 * HTTP 409 (conflict): surfaces conflict details via nz-message.
 * HTTP 429 (rate limiting): surfaces too-many-requests warning with retry advice.
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const injector = inject(Injector);
  const message = inject(NzMessageService);
  const router = inject(Router);

  return next(req).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse && err.status !== 422) {
        const i18n = injector.get(I18nService);
        const authStore = injector.get(AuthStore);
        const isAuthCheck =
          req.url.endsWith('/auth/login') ||
          req.url.endsWith('/auth/two-factor-challenge') ||
          req.url.endsWith('/auth/profile') ||
          req.url.endsWith('/auth/register') ||
          req.url.endsWith('/auth/verify-email') ||
          req.url.endsWith('/auth/resend-verification-email') ||
          req.url.endsWith('/auth/forgot-password') ||
          req.url.endsWith('/auth/resend-reset-password-email') ||
          req.url.endsWith('/auth/validate-reset-token') ||
          req.url.endsWith('/auth/reset-password') ||
          req.url.includes('/sanctum/') ||
          // Member area and public enrolment have their own token: a 401 there must not end the staff session.
          req.url.includes('/association-area/') ||
          req.url.includes('/association-public/') ||
          // The family portal is token based: a refused token must not end the session of the staff user.
          req.url.includes('/childcare-family/');

        const body: ProblemDetails | null =
          typeof err.error === 'object' && err.error !== null
            ? (err.error as ProblemDetails)
            : null;

        const detailOrMessage =
          body?.detail ||
          body?.title ||
          body?.message ||
          null;

        if (isAuthCheck && (err.status === 401 || err.status === 403)) {
          // Authentication/verification endpoints manage their own inline form feedback.
        } else if (err.status === 401) {
          const returnUrl = router.url;
          authStore.logout();
          if (!router.url.startsWith('/login')) {
            void router.navigate(['/login'], { queryParams: { returnUrl } });
          }
          message.warning(i18n.translate('ERRORS.SESSION_EXPIRED'));
        } else if (err.status === 403) {
          if (body?.type === 'urn:fatturafacile:problem:two-factor-setup-required') {
            authStore.setTwoFactorSetupRequired(true);
            message.warning(detailOrMessage || i18n.translate('ERRORS.TWO_FACTOR_SETUP_REQUIRED'));
          } else {
            message.error(
              detailOrMessage ||
                'Operazione non consentita: autorizzazioni insufficienti per il modulo.'
            );
          }
        } else if (err.status === 409) {
          message.warning(
            detailOrMessage || 'Conflitto di stato con il record attuale.'
          );
        } else if (err.status === 429) {
          message.warning(detailOrMessage || i18n.translate('ERRORS.TOO_MANY_REQUESTS_DESC'));
        } else if (err.status === 0) {
          message.error(i18n.translate('ERRORS.NETWORK'));
        } else {
          message.error(
            detailOrMessage || i18n.translate('ERRORS.GENERIC', { status: err.status })
          );
        }
      }
      return throwError(() => err);
    }),
  );
};
