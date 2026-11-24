import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { environment } from '@env';
import { catchError, throwError } from 'rxjs';
import { PortalSessionService } from '../../features/portal/area/portal-session.service';

const PUBLIC_PATHS = ['/portal/branding', '/portal/auth/request-link', '/portal/auth/verify'];

function portalPath(url: string): string | null {
  const base = `${environment.apiBaseUrl}/portal`;
  if (!url.startsWith(base)) {
    return null;
  }
  const path = url.slice(environment.apiBaseUrl.length).split('?')[0];
  return path;
}

/**
 * Attaches the customer's bearer session to the self-service portal API and sends the customer back to
 * `/portal/login` when the API refuses it (401). Every other request is left untouched; the legacy magic-link
 * endpoints (`/portal/access/{token}`, ...) carry their own token in the URL and get no bearer header.
 */
export const portalAuthInterceptor: HttpInterceptorFn = (req, next) => {
  const path = portalPath(req.url);
  const isSessionCall =
    path !== null &&
    !PUBLIC_PATHS.includes(path) &&
    !/^\/portal\/(access|attachments|service-reports|appointments)\//.test(path) &&
    !/^\/portal\/(quotes|invoices|tickets)\/[0-9a-f]{64}/.test(path);

  if (!isSessionCall) {
    return next(req);
  }

  const session = inject(PortalSessionService);
  const router = inject(Router);
  const token = session.token();
  const authorized = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(authorized).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === 401) {
        session.clear();
        void router.navigate(['/portal/login'], {
          queryParams: session.slug() ? { portal: session.slug() } : {},
        });
      }
      return throwError(() => error);
    }),
  );
};
