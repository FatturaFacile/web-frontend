import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { delay, of } from 'rxjs';
import { environment } from '@env';

const MOCK_ROUTES: Record<string, string> = {
  '/api/auth/profile': '/assets/mock-data/auth-user.json',
  '/api/auth/login': '/assets/mock-data/auth-user.json',
  '/api/crm/clients': '/assets/mock-data/crm-clients.json',
  '/api/sales/qr-bills': '/assets/mock-data/sales-qr-bills.json',
  '/api/sales/sdi-invoices': '/assets/mock-data/sales-sdi-invoices.json',
  '/api/automotive/tire-hotel': '/assets/mock-data/automotive-tire-hotel.json',
  '/api/time-attendance': '/assets/mock-data/time-attendance.json',
};

export const mockDataInterceptor: HttpInterceptorFn = (req, next) => {
  if (!environment.demoMode) {
    return next(req);
  }

  const cleanUrl = req.url.split('?')[0];

  // Intercept Laravel Sanctum CSRF cookie initialization in demo mode
  if (cleanUrl.includes('/sanctum/csrf-cookie')) {
    return of(new HttpResponse({ status: 204, statusText: 'No Content' })).pipe(delay(100));
  }

  // Intercept logout in demo mode
  if (cleanUrl.endsWith('/auth/logout')) {
    return of(
      new HttpResponse({
        status: 200,
        statusText: 'OK',
        body: { data: { message: 'Logged out successfully' } },
      })
    ).pipe(delay(150));
  }

  // Normalize API base URLs to match mock route keys
  let routeKey = cleanUrl;
  if (environment.apiBaseUrl && cleanUrl.startsWith(environment.apiBaseUrl)) {
    routeKey = cleanUrl.replace(environment.apiBaseUrl, '/api');
  }

  const targetMock = MOCK_ROUTES[routeKey] ?? MOCK_ROUTES[cleanUrl];

  if (targetMock) {
    const mockReq = req.clone({
      url: targetMock,
      method: 'GET',
    });
    return next(mockReq).pipe(delay(200));
  }

  return next(req);
};
