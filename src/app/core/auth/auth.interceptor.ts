import { HttpInterceptorFn } from '@angular/common/http';
import { environment } from '@env';
import { readAuthToken } from './token-storage';

/** Attaches the Bearer token (`ff_token`) of the current session to API requests. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const targetsApi = req.url.startsWith(environment.apiBaseUrl) || req.url.startsWith('/api');
  const token = readAuthToken() ?? (environment.demoMode ? 'mock-bearer-token' : null);
  if (!targetsApi || !token) {
    return next(req);
  }
  return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
};
