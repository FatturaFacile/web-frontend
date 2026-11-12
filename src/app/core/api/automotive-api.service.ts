import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import {
  ApiResponse,
  AutomotiveVehicle,
  AutomotiveVehiclePage,
  AutomotiveVehiclePayload,
  TireCheckInPayload,
  TireCheckInResult,
  TireHotelRecord,
} from '../models';

@Service()
export class AutomotiveApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/automotive`;

  getVehicles(): Observable<ApiResponse<AutomotiveVehiclePage>> {
    return this.http.get<ApiResponse<AutomotiveVehiclePage>>(`${this.base}/vehicles`);
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

  getSeasonalSwitchPlan(): Observable<ApiResponse<TireHotelRecord[]>> {
    return this.http.get<ApiResponse<TireHotelRecord[]>>(`${this.base}/tire-hotel/seasonal-switch-plan`);
  }

  checkInTires(payload: TireCheckInPayload): Observable<ApiResponse<TireCheckInResult>> {
    return this.http.post<ApiResponse<TireCheckInResult>>(`${this.base}/tire-hotel/check-in`, payload);
  }

  checkOutTires(id: string): Observable<ApiResponse<void>> {
    return this.http.post<ApiResponse<void>>(`${this.base}/tire-hotel/${id}/check-out`, {});
  }
}
