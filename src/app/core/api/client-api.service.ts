import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { map, Observable } from 'rxjs';
import {
  ApiResponse,
  ContactFilterParams,
  ContactPayload,
  ContactResource,
  LaravelPaginationMeta,
  PaginatedResponse,
} from '../models';
import { toHttpParams } from '../http/laravel-http.utils';

type PaginatorBody = LaravelPaginationMeta & { data: ContactResource[] };

@Service()
export class ClientApiService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiBaseUrl}/crm/contacts`;

  /** The API wraps the Laravel paginator in `data`; a plain array with optional `meta` is accepted too. */
  list(filters: ContactFilterParams): Observable<PaginatedResponse<ContactResource>> {
    return this.http
      .get<ApiResponse<ContactResource[] | PaginatorBody> & Partial<Pick<PaginatedResponse<ContactResource>, 'meta'>>>(
        this.url,
        { params: toHttpParams(filters) },
      )
      .pipe(
        map((res) => {
          const body = res.data;
          const items = Array.isArray(body) ? body : body.data;
          const meta: LaravelPaginationMeta =
            res.meta ??
            (Array.isArray(body)
              ? {
                  current_page: filters.page ?? 1,
                  from: null,
                  to: null,
                  last_page: 1,
                  per_page: items.length,
                  total: items.length,
                }
              : {
                  current_page: body.current_page,
                  from: body.from,
                  to: body.to,
                  last_page: body.last_page,
                  per_page: body.per_page,
                  total: body.total,
                });
          return { ...res, data: items, meta };
        }),
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

  lookupFiscal(payload: {
    country: string;
    vat_number?: string;
    uid_number?: string;
  }): Observable<
    ApiResponse<{
      valid_format: boolean;
      registry_verified: boolean;
      source: string;
      data: {
        country?: string;
        vat_number?: string;
        uid_number?: string;
        company_name?: string;
        address?: {
          street?: string;
          postal_code?: string;
          city?: string;
          state_canton?: string;
          country?: string;
        };
      };
      warnings: string[];
    }>
  > {
    return this.http.post<
      ApiResponse<{
        valid_format: boolean;
        registry_verified: boolean;
        source: string;
        data: {
          country?: string;
          vat_number?: string;
          uid_number?: string;
          company_name?: string;
          address?: {
            street?: string;
            postal_code?: string;
            city?: string;
            state_canton?: string;
            country?: string;
          };
        };
        warnings: string[];
      }>
    >(`${environment.apiBaseUrl}/crm/fiscal/lookup`, payload);
  }
}
