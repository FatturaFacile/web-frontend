import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import {
  ApiResponse,
  CheckInInspectionPayload,
  CheckOutInspectionPayload,
  RentalBooking,
  RentalVehicle,
} from '../models';

@Service()
export class RentApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/rent`;

  getVehicles(): Observable<ApiResponse<RentalVehicle[]>> {
    return this.http.get<ApiResponse<RentalVehicle[]>>(`${this.base}/vehicles`);
  }

  getBookings(): Observable<ApiResponse<RentalBooking[]>> {
    return this.http.get<ApiResponse<RentalBooking[]>>(`${this.base}/bookings`);
  }

  recordCheckInInspection(payload: CheckInInspectionPayload): Observable<ApiResponse<void>> {
    return this.http.post<ApiResponse<void>>(`${this.base}/check-in-inspection`, payload);
  }

  recordCheckOutInspection(payload: CheckOutInspectionPayload): Observable<ApiResponse<void>> {
    return this.http.post<ApiResponse<void>>(`${this.base}/check-out-inspection`, payload);
  }
}
