import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { map, Observable } from 'rxjs';
import { toHttpParams } from '../http/laravel-http.utils';
import {
  ApiResponse,
  AutomotiveVehicle,
  AutomotiveVehiclePage,
  AutomotiveVehiclePayload,
  PaginatedResponse,
  QueryFilterParams,
  TireCheckInPayload,
  TireCheckInResult,
  TireHotelRecord,
  TireHotelRecordPage,
} from '../models';

@Service()
export class AutomotiveApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/automotive`;

  getVehicles(): Observable<ApiResponse<AutomotiveVehiclePage>> {
    return this.http.get<ApiResponse<AutomotiveVehiclePage>>(`${this.base}/vehicles`);
  }

  /** Grid list of the vehicle registry (the API wraps the Laravel paginator in `data`; `grid_values` answers a plain list). */
  listVehicles(params: QueryFilterParams = {}): Observable<PaginatedResponse<AutomotiveVehicle>> {
    return this.http
      .get<ApiResponse<AutomotiveVehiclePage | AutomotiveVehicle[]>>(`${this.base}/vehicles`, { params: toHttpParams(params) })
      .pipe(
        map((res) => {
          const body = res.data;
          const items = Array.isArray(body) ? body : body.data;
          const total = Array.isArray(body) ? items.length : body.total;
          return {
            ...res,
            data: items,
            meta: {
              current_page: Array.isArray(body) ? 1 : body.current_page,
              from: null,
              to: null,
              last_page: Array.isArray(body) ? 1 : body.last_page,
              per_page: Array.isArray(body) ? items.length : body.per_page,
              total,
            },
          };
        }),
      );
  }

  getVehicle(id: string): Observable<ApiResponse<AutomotiveVehicle>> {
    return this.http.get<ApiResponse<AutomotiveVehicle>>(`${this.base}/vehicles/${id}`);
  }

  registerVehicle(payload: AutomotiveVehiclePayload): Observable<ApiResponse<AutomotiveVehicle>> {
    return this.http.post<ApiResponse<AutomotiveVehicle>>(`${this.base}/vehicles`, payload);
  }

  updateVehicle(id: string, payload: AutomotiveVehiclePayload): Observable<ApiResponse<AutomotiveVehicle>> {
    return this.http.put<ApiResponse<AutomotiveVehicle>>(`${this.base}/vehicles/${id}`, payload);
  }

  deleteVehicle(id: string): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${this.base}/vehicles/${id}`);
  }

  /** Grid list of the stored tire sets (the API wraps the Laravel paginator in `data`; `grid_values` answers a plain list). */
  listSeasonalSwitchPlan(params: QueryFilterParams = {}): Observable<PaginatedResponse<TireHotelRecord>> {
    return this.http
      .get<ApiResponse<TireHotelRecordPage | TireHotelRecord[]>>(`${this.base}/tire-hotel/seasonal-switch-plan`, {
        params: toHttpParams(params),
      })
      .pipe(
        map((res) => {
          const body = res.data;
          const items = Array.isArray(body) ? body : body.data;
          return {
            ...res,
            data: items,
            meta: {
              current_page: Array.isArray(body) ? 1 : body.current_page,
              from: null,
              to: null,
              last_page: Array.isArray(body) ? 1 : body.last_page,
              per_page: Array.isArray(body) ? items.length : body.per_page,
              total: Array.isArray(body) ? items.length : body.total,
            },
          };
        }),
      );
  }

  checkInTires(payload: TireCheckInPayload): Observable<ApiResponse<TireCheckInResult>> {
    return this.http.post<ApiResponse<TireCheckInResult>>(`${this.base}/tire-hotel/check-in`, payload);
  }

  checkOutTires(id: string): Observable<ApiResponse<void>> {
    return this.http.post<ApiResponse<void>>(`${this.base}/tire-hotel/${id}/check-out`, {});
  }
}
