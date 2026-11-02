import { HttpInterceptorFn } from '@angular/common/http';
import { isBackendApiRequest } from '../auth/csrf.utils';

/**
 * Global Credentials Interceptor for Laravel Sanctum SPA Cookie Session Authentication.
 *
 * Ensures all outgoing requests targeting the backend API domain explicitly transmit
 * browser session cookies (`req.clone({ withCredentials: true })`) to resolve and prevent
 * 401 Unauthenticated errors.
 * Third-party external requests remain untouched to avoid CORS wildcard credential conflicts.
 */
export const credentialsInterceptor: HttpInterceptorFn = (req, next) => {
  if (isBackendApiRequest(req.url)) {
    return next(req.clone({ withCredentials: true }));
  }
  return next(req);
};
