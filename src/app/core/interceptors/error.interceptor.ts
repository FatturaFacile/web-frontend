import { HttpContextToken, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject, Injector } from '@angular/core';
import { Router } from '@angular/router';
import { NzMessageService } from 'ng-zorro-antd/message';
import { catchError, throwError } from 'rxjs';
import { TWO_FACTOR_SETUP_PATH } from '../auth/auth.guard';
import { AuthStore } from '../auth/auth.store';
import { I18nService } from '../i18n';
import { isLocallyHandled } from '../http/error-handling.context';

interface ProblemDetails {
  type?: string;
  title?: string;
  detail?: string;
  status?: number;
  message?: string;
  errors?: Record<string, string[]>;
}

/**
 * HTTP statuses the caller renders itself (e.g. 404/409 with a translated `code`):
 * no global toast is shown for them. 401 and network errors keep the global handling.
 */
export const HANDLED_ERROR_STATUSES = new HttpContextToken<readonly number[]>(() => []);

/**
 * Global RFC 7807 Problem Details and system error interceptor.
 * HTTP 422 (validation errors) passes downstream untouched so reactive forms can bind field errors with nzErrorTip.
 * HTTP 401: ends the session and returns to login (except unauthenticated check endpoints).
 * HTTP 403 (two-factor-setup-required): triggers the mandatory 2FA setup wizard in AuthStore.
 * HTTP 409 (conflict): surfaces conflict details via nz-message.
 * HTTP 412 (precondition failed, ETag / If-Match): surfaces the edit conflict so the user reloads the record.
 * HTTP 429 (rate limiting): surfaces too-many-requests warning with retry advice.
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const injector = inject(Injector);
  const message = inject(NzMessageService);
  const router = inject(Router);

  return next(req).pipe(
    catchError((err: unknown) => {
      if (
        err instanceof HttpErrorResponse &&
        err.status !== 422 &&
        !isLocallyHandled(req.context, err.status)
      ) {
        const i18n = injector.get(I18nService);
        const authStore = injector.get(AuthStore);
        const isAuthCheck =
          req.url.endsWith('/auth/login') ||
          req.url.endsWith('/auth/two-factor-challenge') ||
          req.url.endsWith('/auth/2fa/challenge') ||
          req.url.includes('/auth/two-factor/challenge/') ||
          req.url.includes('/auth/password-policy/') ||
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
          req.url.includes('/childcare-family/') ||
          // The reception kiosk authenticates with its own key and secret: a refused kiosk must not end the staff session.
          req.url.includes('/visitor-kiosk/') ||
          // The supplier self-service & public RFQ portal endpoints use token auth: a 401 must not end the staff session.
          req.url.includes('/supplier-self-service/') ||
          req.url.includes('/public/rfq-portal/') ||
          req.url.includes('/procurement/purchase-requisitions/one-click-action');

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
        } else if (req.context.get(HANDLED_ERROR_STATUSES).includes(err.status)) {
          // The caller maps this status to its own (translated) message.
        } else if (err.status === 401) {
          const returnUrl = router.url;
          authStore.logout();
          if (!router.url.startsWith('/login')) {
            void router.navigate(['/login'], { queryParams: { returnUrl } });
          }
          message.warning(i18n.translate('ERRORS.SESSION_EXPIRED'));
        } else if (err.status === 403) {
          if (body?.type === 'urn:fatturafacile:problem:two-factor-setup-required') {
            // The auth guard sends every navigation to the enrolment page while the flag is set; leave the current
            // (blocked) page for it right away.
            authStore.setTwoFactorSetupRequired(true);
            message.warning(detailOrMessage || i18n.translate('ERRORS.TWO_FACTOR_SETUP_REQUIRED'));
            if (!router.url.startsWith(TWO_FACTOR_SETUP_PATH)) {
              router
                .navigate([TWO_FACTOR_SETUP_PATH], { queryParams: { returnUrl: router.url } })
                .catch(() => false);
            }
          } else {
            message.error(
              detailOrMessage || i18n.translate('ERRORS.FORBIDDEN_MODULE')
            );
          }
        } else if (err.status === 409) {
          message.warning(
            detailOrMessage || i18n.translate('ERRORS.CONFLICT')
          );
        } else if (err.status === 412) {
          // Optimistic locking: the record changed since the user read it.
          message.warning(detailOrMessage || i18n.translate('ERRORS.EDIT_CONFLICT'));
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
