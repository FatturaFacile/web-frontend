import { HttpInterceptorFn } from '@angular/common/http';
import { delay } from 'rxjs';
import { environment } from '@env';

const MOCK_ROUTES: Record<string, string> = {
  '/api/auth/me': '/assets/mock-data/auth-user.json',
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
  const targetMock = MOCK_ROUTES[cleanUrl];

  if (targetMock) {
    const mockReq = req.clone({
      url: targetMock,
      method: 'GET',
    });
    return next(mockReq).pipe(delay(200));
  }

  return next(req);
};
