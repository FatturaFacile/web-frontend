import { HttpEvent, HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { map } from 'rxjs';
import { isBackendApiRequest } from '../auth/csrf.utils';

interface LaravelPaginator {
  current_page: number;
  data: unknown[];
  from: number | null;
  last_page: number;
  per_page: number;
  to: number | null;
  total: number;
}

function isLaravelPaginator(value: unknown): value is LaravelPaginator {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    Array.isArray(candidate['data']) &&
    typeof candidate['current_page'] === 'number' &&
    typeof candidate['last_page'] === 'number'
  );
}

/**
 * Many endpoints return the Laravel paginator as it is inside `data` (`{ data: { current_page, data: [...], ... } }`),
 * while the frontend contract (`PaginatedResponse`) is `{ data: [...], meta: { current_page, last_page, ... } }`.
 * This interceptor converts the first shape into the second, so that every list reads the items as an array.
 */
export const paginatedResponseInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.method !== 'GET' || !isBackendApiRequest(req.url)) {
    return next(req);
  }

  return next(req).pipe(
    map((event: HttpEvent<unknown>) => {
      if (!(event instanceof HttpResponse)) {
        return event;
      }
      const body = event.body as { data?: unknown; meta?: unknown } | null;
      if (!body || !isLaravelPaginator(body.data)) {
        return event;
      }
      const { data: items, current_page, from, last_page, per_page, to, total } = body.data;
      return event.clone({
        body: { ...body, data: items, meta: body.meta ?? { current_page, from, last_page, per_page, to, total } },
      });
    }),
  );
};
