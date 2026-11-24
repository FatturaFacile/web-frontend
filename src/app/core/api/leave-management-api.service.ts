import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { toHttpParams } from '../http/laravel-http.utils';
import {
  ApiResponse,
  ComportoOrCurtailmentEvaluationData,
  DepartmentGanttResponse,
  DepartmentStaffingThresholdRecord,
  EmployeeLeaveAccrualLedgerRecord,
  HolidayCalendarRecord,
  HolidayCatalogResponse,
  LeaveCountryCode,
  LeaveEntitlementPolicyRecord,
  Mod074LeaveRequestRecord,
  PayrollAbsenceSummaryRow,
  RegisterSickLeaveInpsPayload,
  SaveHolidayCalendarPayload,
  SaveLeaveEntitlementPolicyPayload,
  SubmitMod074LeaveRequestPayload,
  UpsertStaffingThresholdPayload,
} from '../models';

/**
 * Mod 074 Leave, Permits & Absences Management API client.
 */
@Service()
export class LeaveManagementApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/leave-management`;

  getHolidayCatalog(params: {
    country: LeaveCountryCode;
    year: number;
    canton_or_province_code?: string;
    municipality_name?: string;
    municipality_patron_saint_date?: string;
    municipality_patron_saint_name?: string;
  }): Observable<ApiResponse<HolidayCatalogResponse>> {
    return this.http.get<ApiResponse<HolidayCatalogResponse>>(`${this.base}/holidays/catalog`, {
      params: toHttpParams(params),
    });
  }

  getHolidayCalendars(params?: {
    country?: LeaveCountryCode;
    year?: number;
    canton_or_province_code?: string;
  }): Observable<ApiResponse<HolidayCalendarRecord[]>> {
    return this.http.get<ApiResponse<HolidayCalendarRecord[]>>(`${this.base}/holiday-calendars`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  createHolidayCalendar(
    payload: SaveHolidayCalendarPayload,
  ): Observable<ApiResponse<HolidayCalendarRecord>> {
    return this.http.post<ApiResponse<HolidayCalendarRecord>>(
      `${this.base}/holiday-calendars`,
      payload,
    );
  }

  updateHolidayCalendar(
    id: string,
    payload: SaveHolidayCalendarPayload,
  ): Observable<ApiResponse<HolidayCalendarRecord>> {
    return this.http.put<ApiResponse<HolidayCalendarRecord>>(
      `${this.base}/holiday-calendars/${id}`,
      payload,
    );
  }

  deleteHolidayCalendar(id: string): Observable<ApiResponse<null>> {
    return this.http.delete<ApiResponse<null>>(`${this.base}/holiday-calendars/${id}`);
  }

  getPolicies(params?: {
    country?: LeaveCountryCode;
    leave_type?: string;
  }): Observable<ApiResponse<LeaveEntitlementPolicyRecord[]>> {
    return this.http.get<ApiResponse<LeaveEntitlementPolicyRecord[]>>(`${this.base}/policies`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  createPolicy(
    payload: SaveLeaveEntitlementPolicyPayload,
  ): Observable<ApiResponse<LeaveEntitlementPolicyRecord>> {
    return this.http.post<ApiResponse<LeaveEntitlementPolicyRecord>>(
      `${this.base}/policies`,
      payload,
    );
  }

  updatePolicy(
    id: string,
    payload: SaveLeaveEntitlementPolicyPayload,
  ): Observable<ApiResponse<LeaveEntitlementPolicyRecord>> {
    return this.http.put<ApiResponse<LeaveEntitlementPolicyRecord>>(
      `${this.base}/policies/${id}`,
      payload,
    );
  }

  deletePolicy(id: string): Observable<ApiResponse<null>> {
    return this.http.delete<ApiResponse<null>>(`${this.base}/policies/${id}`);
  }

  getLedgers(params?: {
    employee_id?: string;
    fiscal_year?: number;
    country?: LeaveCountryCode;
    leave_type?: string;
  }): Observable<ApiResponse<EmployeeLeaveAccrualLedgerRecord[]>> {
    return this.http.get<ApiResponse<EmployeeLeaveAccrualLedgerRecord[]>>(`${this.base}/ledgers`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  calculateMonthlyAccruals(payload: {
    fiscal_year: number;
    month: number;
    employee_id?: string;
    country?: LeaveCountryCode;
  }): Observable<
    ApiResponse<{ processed_ledgers: number; ledgers: EmployeeLeaveAccrualLedgerRecord[] }>
  > {
    return this.http.post<
      ApiResponse<{ processed_ledgers: number; ledgers: EmployeeLeaveAccrualLedgerRecord[] }>
    >(`${this.base}/ledgers/calculate-monthly`, payload);
  }

  getRequests(params?: {
    country?: LeaveCountryCode;
    leave_type?: string;
    status?: string;
    employee_id?: string;
    department_id?: string;
    from?: string;
    to?: string;
  }): Observable<ApiResponse<Mod074LeaveRequestRecord[]>> {
    return this.http.get<ApiResponse<Mod074LeaveRequestRecord[]>>(`${this.base}/requests`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  submitRequest(
    payload: SubmitMod074LeaveRequestPayload,
  ): Observable<ApiResponse<Mod074LeaveRequestRecord>> {
    return this.http.post<ApiResponse<Mod074LeaveRequestRecord>>(`${this.base}/requests`, payload);
  }

  registerSickInps(
    payload: RegisterSickLeaveInpsPayload,
  ): Observable<ApiResponse<Mod074LeaveRequestRecord>> {
    return this.http.post<ApiResponse<Mod074LeaveRequestRecord>>(
      `${this.base}/requests/sick-inps`,
      payload,
    );
  }

  approveRequest(id: string): Observable<ApiResponse<Mod074LeaveRequestRecord>> {
    return this.http.post<ApiResponse<Mod074LeaveRequestRecord>>(
      `${this.base}/requests/${id}/approve`,
      {},
    );
  }

  rejectRequest(id: string, reason: string): Observable<ApiResponse<Mod074LeaveRequestRecord>> {
    return this.http.post<ApiResponse<Mod074LeaveRequestRecord>>(
      `${this.base}/requests/${id}/reject`,
      { reason },
    );
  }

  cancelRequest(id: string, reason: string): Observable<ApiResponse<Mod074LeaveRequestRecord>> {
    return this.http.post<ApiResponse<Mod074LeaveRequestRecord>>(
      `${this.base}/requests/${id}/cancel`,
      { reason },
    );
  }

  getDepartmentCalendar(params: {
    from: string;
    to: string;
    department_id?: string;
    country?: LeaveCountryCode;
    canton_or_province_code?: string;
  }): Observable<ApiResponse<DepartmentGanttResponse>> {
    return this.http.get<ApiResponse<DepartmentGanttResponse>>(`${this.base}/department-calendar`, {
      params: toHttpParams(params),
    });
  }

  getStaffingThresholds(): Observable<ApiResponse<DepartmentStaffingThresholdRecord[]>> {
    return this.http.get<ApiResponse<DepartmentStaffingThresholdRecord[]>>(
      `${this.base}/staffing-thresholds`,
    );
  }

  upsertStaffingThreshold(
    departmentId: string,
    payload: UpsertStaffingThresholdPayload,
  ): Observable<ApiResponse<DepartmentStaffingThresholdRecord>> {
    return this.http.put<ApiResponse<DepartmentStaffingThresholdRecord>>(
      `${this.base}/staffing-thresholds/${departmentId}`,
      payload,
    );
  }

  evaluateComportoOrCurtailment(params: {
    employee_id: string;
    fiscal_year: number;
    country?: LeaveCountryCode;
    apply_curtailment?: boolean;
  }): Observable<ApiResponse<ComportoOrCurtailmentEvaluationData>> {
    return this.http.get<ApiResponse<ComportoOrCurtailmentEvaluationData>>(
      `${this.base}/comporto-curtailment`,
      {
        params: toHttpParams(params),
      },
    );
  }

  getPayrollSummary(params: {
    year: number;
    month: number;
    country?: LeaveCountryCode;
  }): Observable<ApiResponse<PayrollAbsenceSummaryRow[]>> {
    return this.http.get<ApiResponse<PayrollAbsenceSummaryRow[]>>(
      `${this.base}/integrations/payroll-summary`,
      {
        params: toHttpParams(params),
      },
    );
  }
}
