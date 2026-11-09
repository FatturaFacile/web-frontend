import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { ApiResponse, LeaveTypePayload, LeaveTypeResource } from '../models';

@Service()
export class HrLeaveApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/hr`;

  getLeaveTypes(): Observable<ApiResponse<LeaveTypeResource[]>> {
    return this.http.get<ApiResponse<LeaveTypeResource[]>>(`${this.base}/leave-types`);
  }

  createLeaveType(payload: LeaveTypePayload): Observable<ApiResponse<LeaveTypeResource>> {
    return this.http.post<ApiResponse<LeaveTypeResource>>(`${this.base}/leave-types`, payload);
  }

  updateLeaveType(id: string, payload: Partial<LeaveTypePayload>): Observable<ApiResponse<LeaveTypeResource>> {
    return this.http.put<ApiResponse<LeaveTypeResource>>(`${this.base}/leave-types/${id}`, payload);
  }
}
