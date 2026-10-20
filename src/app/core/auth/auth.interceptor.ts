import { HttpInterceptorFn } from '@angular/common/http';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authToken = 'mock-bearer-token';
  const authReq = req.clone({
    setHeaders: {
      Authorization: `Bearer ${authToken}`,
    },
  });
  return next(authReq);
};
