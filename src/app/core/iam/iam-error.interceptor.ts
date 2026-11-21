import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject, Injector } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import type { ForbiddenCode } from './iam.models';
import { PermissionStore } from './permission.store';

/** The stable `code` member of a 403 problem, when the body has one. */
export function forbiddenCodeOf(error: HttpErrorResponse): ForbiddenCode | null {
  const code = (error.error as { code?: unknown } | null)?.code;
  return code === 'permission_denied' ||
    code === 'mfa_required' ||
    code === 'company_access_revoked' ||
    code === 'mfa_cannot_be_disabled'
    ? code
    : null;
}

/**
 * Side effects of the structured 403 codes (the error is always passed on, the global error interceptor still reports it):
 * - `permission_denied`: the permissions changed on the server, so the snapshot is dropped and reloaded;
 * - `company_access_revoked`: the snapshot is reloaded and the user returns to the dashboard;
 * - `mfa_required`: the user is sent to the security page to set up a second factor.
 */
export const iamErrorInterceptor: HttpInterceptorFn = (req, next) => {
  // Resolved lazily: PermissionStore uses HttpClient, so injecting it here would close a DI cycle through the interceptor chain.
  const injector = inject(Injector);

  return next(req).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === 403 && !req.url.endsWith('/profile/permissions')) {
        const store = injector.get(PermissionStore);
        const router = injector.get(Router);

        switch (forbiddenCodeOf(error)) {
          case 'permission_denied':
            void store.reload();
            break;
          case 'company_access_revoked':
            void store.reload().then(() => router.navigateByUrl('/'));
            break;
          case 'mfa_required':
            void router.navigateByUrl('/settings/security');
            break;
          default:
            break;
        }
      }
      return throwError(() => error);
    }),
  );
};
