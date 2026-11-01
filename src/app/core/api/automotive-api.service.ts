import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import {
  ApiResponse,
  AutomotiveVehicle,
  TireCheckInPayload,
  TireRecord,
} from '../models';

@Service()
export class AutomotiveApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/automotive`;

  getVehicles(): Observable<ApiResponse<AutomotiveVehicle[]>> {
    return this.http.get<ApiResponse<AutomotiveVehicle[]>>(`${this.base}/vehicles`);
  }

  getTireHotelRecords(): Observable<TireRecord[]> {
    return this.http.get<TireRecord[]>(`${this.base}/tire-hotel`);
  }

  getSeasonalSwitchPlan(): Observable<ApiResponse<TireRecord[]>> {
    return this.http.get<ApiResponse<TireRecord[]>>(`${this.base}/tire-hotel/seasonal-switch-plan`);
  }

  checkInTires(payload: TireCheckInPayload): Observable<ApiResponse<void>> {
    return this.http.post<ApiResponse<void>>(`${this.base}/tire-hotel/check-in`, payload);
  }

  checkOutTires(id: string): Observable<ApiResponse<void>> {
    return this.http.post<ApiResponse<void>>(`${this.base}/tire-hotel/${id}/check-out`, {});
  }

  sendReminder(tireId: string): Observable<ApiResponse<void>> {
    return this.http.post<ApiResponse<void>>(`${this.base}/tire-hotel/${tireId}/reminder`, {});
  }
}
