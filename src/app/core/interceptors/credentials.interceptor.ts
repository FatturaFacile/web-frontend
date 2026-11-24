import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { throwError } from 'rxjs';
import { isBackendApiRequest, isInsecureBackendRequest } from '../auth/csrf.utils';

/**
 * Global Credentials Interceptor for Laravel Sanctum SPA Cookie Session Authentication.
 *
 * Cookie-only: every request to the backend API transmits the HttpOnly session cookie
 * (`req.clone({ withCredentials: true })`); no bearer token is ever added.
 * HTTPS only: a backend request that would go over plain HTTP (outside loopback development) is refused.
 * Third-party external requests remain untouched to avoid CORS wildcard credential conflicts.
 */
export const credentialsInterceptor: HttpInterceptorFn = (req, next) => {
  if (!isBackendApiRequest(req.url)) {
    return next(req);
  }

  if (isInsecureBackendRequest(req.url)) {
    return throwError(
      () =>
        new HttpErrorResponse({
          url: req.url,
          status: 0,
          statusText: 'HTTPS required',
          error: 'https-required',
        }),
    );
  }

  return next(req.clone({ withCredentials: true }));
};
