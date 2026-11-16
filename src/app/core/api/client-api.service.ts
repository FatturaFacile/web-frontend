import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { map, Observable } from 'rxjs';
import {
  ApiResponse,
  ContactFilterParams,
  ContactPayload,
  ContactResource,
  PaginatedResponse,
} from '../models';
import { toHttpParams } from '../http/laravel-http.utils';

/** The API wraps either a plain array or a Laravel paginator (`data.data` + page counters) in `data`. */
type ContactListBody = ApiResponse<ContactResource[] | LaravelPaginator<ContactResource>> &
  Partial<Pick<PaginatedResponse<ContactResource>, 'meta'>>;

interface LaravelPaginator<T> {
  data: T[];
  current_page: number;
  from: number | null;
  to: number | null;
  last_page: number;
  per_page: number;
  total: number;
}

function normalizeContactList(body: ContactListBody): ApiResponse<ContactResource[]> & Partial<Pick<PaginatedResponse<ContactResource>, 'meta'>> {
  if (Array.isArray(body.data)) {
    return body as ApiResponse<ContactResource[]> & Partial<Pick<PaginatedResponse<ContactResource>, 'meta'>>;
  }
  const { data, ...page } = body.data;
  return {
    ...body,
    data,
    meta: body.meta ?? {
      current_page: page.current_page,
      from: page.from,
      to: page.to,
      last_page: page.last_page,
      per_page: page.per_page,
      total: page.total,
    },
  };
}

@Service()
export class ClientApiService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiBaseUrl}/crm/contacts`;

  list(filters: ContactFilterParams): Observable<PaginatedResponse<ContactResource>> {
    return this.http
      .get<ContactListBody>(this.url, { params: toHttpParams(filters) })
      .pipe(
        map((body) => normalizeContactList(body)),
        map((res) => ({
          ...res,
          // Defensive: the spec only documents `data`; fall back if `meta` is absent.
          meta: res.meta ?? {
            current_page: filters.page ?? 1,
            from: null,
            to: null,
            last_page: 1,
            per_page: res.data.length,
            total: res.data.length,
          },
        })),
      );
  }

  get(id: string): Observable<ApiResponse<ContactResource>> {
    return this.http.get<ApiResponse<ContactResource>>(`${this.url}/${id}`);
  }

  create(payload: ContactPayload): Observable<ApiResponse<ContactResource>> {
    return this.http.post<ApiResponse<ContactResource>>(this.url, payload);
  }

  update(id: string, payload: Partial<ContactPayload>): Observable<ApiResponse<ContactResource>> {
    return this.http.put<ApiResponse<ContactResource>>(`${this.url}/${id}`, payload);
  }

  delete(id: string): Observable<ApiResponse<null>> {
    return this.http.delete<ApiResponse<null>>(`${this.url}/${id}`);
  }
}
