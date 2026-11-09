import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import {
  ApiResponse,
  LeaveAccrualPolicyPayload,
  LeaveAccrualPolicyResource,
  LeaveBalanceResource,
  LeaveCalendarEntry,
  LeaveCalendarParams,
  LeaveTypePayload,
  LeaveTypeResource,
} from '../models';
import { toHttpParams } from '../http/laravel-http.utils';

/** Leave types, accrual policies, balances and the leave calendar. */
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

  getAccrualPolicies(): Observable<ApiResponse<LeaveAccrualPolicyResource[]>> {
    return this.http.get<ApiResponse<LeaveAccrualPolicyResource[]>>(`${this.base}/leave-accrual-policies`);
  }

  createAccrualPolicy(payload: LeaveAccrualPolicyPayload): Observable<ApiResponse<LeaveAccrualPolicyResource>> {
    return this.http.post<ApiResponse<LeaveAccrualPolicyResource>>(`${this.base}/leave-accrual-policies`, payload);
  }

  updateAccrualPolicy(
    id: string,
    payload: LeaveAccrualPolicyPayload,
  ): Observable<ApiResponse<LeaveAccrualPolicyResource>> {
    return this.http.put<ApiResponse<LeaveAccrualPolicyResource>>(`${this.base}/leave-accrual-policies/${id}`, payload);
  }

  deleteAccrualPolicy(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/leave-accrual-policies/${id}`);
  }

  getLeaveBalances(employeeId?: string): Observable<ApiResponse<LeaveBalanceResource[]>> {
    return this.http.get<ApiResponse<LeaveBalanceResource[]>>(`${this.base}/leave-balances`, {
      params: toHttpParams({ employee_id: employeeId }),
    });
  }

  accrueLeaveBalances(month?: number): Observable<ApiResponse<{ balances_accrued: number }>> {
    return this.http.post<ApiResponse<{ balances_accrued: number }>>(
      `${this.base}/leave-balances/accrue`,
      month === undefined ? {} : { month },
    );
  }

  getLeaveCalendar(params: LeaveCalendarParams): Observable<ApiResponse<LeaveCalendarEntry[]>> {
    return this.http.get<ApiResponse<LeaveCalendarEntry[]>>(`${this.base}/leave-calendar`, {
      params: toHttpParams(params),
    });
  }
}
