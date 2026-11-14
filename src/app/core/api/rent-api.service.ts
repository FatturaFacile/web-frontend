import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { map, Observable } from 'rxjs';
import { toHttpParams } from '../http/laravel-http.utils';
import {
  ApiResponse,
  LaravelPaginationMeta,
  PaginatedResponse,
  QueryFilterParams,
  CheckInInspectionPayload,
  CheckOutInspectionPayload,
  RentalBooking,
  RentalVehicle,
} from '../models';

@Service()
export class RentApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/rent`;

  /** Grid list: paging, sorting, column filters and `grid_values` travel in the query. */
  getVehicles(params: QueryFilterParams = {}): Observable<PaginatedResponse<RentalVehicle>> {
    return this.http
      .get<ApiResponse<RentalVehicle[]> & { meta?: LaravelPaginationMeta }>(`${this.base}/vehicles`, { params: toHttpParams(params) })
      .pipe(map((res) => withMeta(res, params)));
  }

  getBookings(params: QueryFilterParams = {}): Observable<PaginatedResponse<RentalBooking>> {
    return this.http
      .get<ApiResponse<RentalBooking[]> & { meta?: LaravelPaginationMeta }>(`${this.base}/bookings`, { params: toHttpParams(params) })
      .pipe(map((res) => withMeta(res, params)));
  }

  recordCheckInInspection(payload: CheckInInspectionPayload): Observable<ApiResponse<void>> {
    return this.http.post<ApiResponse<void>>(`${this.base}/check-in-inspection`, payload);
  }

  recordCheckOutInspection(payload: CheckOutInspectionPayload): Observable<ApiResponse<void>> {
    return this.http.post<ApiResponse<void>>(`${this.base}/check-out-inspection`, payload);
  }
}

/** The `grid_values` answer is a plain list without meta: give it one so every response is a PaginatedResponse. */
function withMeta<T>(res: ApiResponse<T[]> & { meta?: LaravelPaginationMeta }, params: QueryFilterParams): PaginatedResponse<T> {
  const items = res.data ?? [];
  return {
    ...res,
    meta: res.meta ?? { current_page: params.page ?? 1, from: null, to: null, last_page: 1, per_page: items.length, total: items.length },
  };
}
