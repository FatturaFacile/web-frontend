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

@Service()
export class ClientApiService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiBaseUrl}/crm/contacts`;

  list(filters: ContactFilterParams): Observable<PaginatedResponse<ContactResource>> {
    return this.http
      .get<ApiResponse<ContactResource[]> & Partial<Pick<PaginatedResponse<ContactResource>, 'meta'>>>(
        this.url,
        { params: toHttpParams(filters) },
      )
      .pipe(
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
