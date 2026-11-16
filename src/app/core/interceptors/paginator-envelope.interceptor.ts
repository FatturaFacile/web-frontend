import { HttpEvent, HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { map } from 'rxjs';

interface LaravelPaginator {
  data: unknown[];
  current_page: number;
  from?: number | null;
  to?: number | null;
  last_page?: number;
  per_page?: number;
  total: number;
}

function isPaginator(value: unknown): value is LaravelPaginator {
  const v = value as Partial<LaravelPaginator> | null;
  return (
    !!v &&
    typeof v === 'object' &&
    Array.isArray(v.data) &&
    typeof v.current_page === 'number' &&
    typeof v.total === 'number'
  );
}

/**
 * Normalises Laravel's `{ success, data: { current_page, data: [...], total, ... } }` (a paginator serialised
 * inside the envelope) to the `{ success, data: [...], meta: {...} }` shape the list screens expect.
 * Bodies that are already flat arrays, or that carry their own `meta`, are left untouched.
 */
export const paginatorEnvelopeInterceptor: HttpInterceptorFn = (req, next) =>
  next(req).pipe(
    map((event: HttpEvent<unknown>) => {
      if (!(event instanceof HttpResponse)) {
        return event;
      }

      const body = event.body as { data?: unknown; meta?: unknown } | null;
      if (!body || typeof body !== 'object' || body.meta !== undefined || !isPaginator(body.data)) {
        return event;
      }

      const { data, current_page, from, to, last_page, per_page, total } = body.data;

      return event.clone({
        body: {
          ...body,
          data,
          meta: {
            current_page,
            from: from ?? null,
            to: to ?? null,
            last_page: last_page ?? 1,
            per_page: per_page ?? data.length,
            total,
          },
        },
      });
    }),
  );
