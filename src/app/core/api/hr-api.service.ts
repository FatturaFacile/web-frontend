import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import {
  ApiResponse,
  EmployeeResource,
  FrontierWorkerResource,
  HireEmployeePayload,
  LeaveRequestResource,
  PaginatedResponse,
  PayrollRunResource,
  PromoteEmployeePayload,
  QueryFilterParams,
  SubmitLeaveRequestPayload,
  SubmitTimesheetPayload,
  TerminateEmployeePayload,
  TimesheetResource,
} from '../models';
import { toHttpParams } from '../http/laravel-http.utils';

@Service()
export class HrApiService {
  private readonly http = inject(HttpClient);
  private readonly hrBase = `${environment.apiBaseUrl}/hr`;
  private readonly payrollBase = `${environment.apiBaseUrl}/payroll`;

  // --- Employees ---

  getEmployees(params?: QueryFilterParams): Observable<PaginatedResponse<EmployeeResource>> {
    return this.http.get<PaginatedResponse<EmployeeResource>>(`${this.hrBase}/employees`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  getEmployee(id: string): Observable<ApiResponse<EmployeeResource>> {
    return this.http.get<ApiResponse<EmployeeResource>>(`${this.hrBase}/employees/${id}`);
  }

  createEmployee(payload: HireEmployeePayload): Observable<ApiResponse<EmployeeResource>> {
    return this.http.post<ApiResponse<EmployeeResource>>(`${this.hrBase}/employees`, payload);
  }

  completeProbation(id: string): Observable<ApiResponse<EmployeeResource>> {
    return this.http.post<ApiResponse<EmployeeResource>>(`${this.hrBase}/employees/${id}/complete-probation`, {});
  }

  promoteEmployee(id: string, payload: PromoteEmployeePayload): Observable<ApiResponse<EmployeeResource>> {
    return this.http.post<ApiResponse<EmployeeResource>>(`${this.hrBase}/employees/${id}/promote`, payload);
  }

  terminateEmployee(id: string, payload: TerminateEmployeePayload): Observable<ApiResponse<EmployeeResource>> {
    return this.http.post<ApiResponse<EmployeeResource>>(`${this.hrBase}/employees/${id}/terminate`, payload);
  }

  rehireEmployee(id: string, payload: Record<string, unknown>): Observable<ApiResponse<EmployeeResource>> {
    return this.http.post<ApiResponse<EmployeeResource>>(`${this.hrBase}/employees/${id}/rehire`, payload);
  }

  // --- Leave Requests ---

  getLeaveRequests(params?: QueryFilterParams): Observable<PaginatedResponse<LeaveRequestResource>> {
    return this.http.get<PaginatedResponse<LeaveRequestResource>>(`${this.hrBase}/leave-requests`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  submitLeaveRequest(payload: SubmitLeaveRequestPayload): Observable<ApiResponse<LeaveRequestResource>> {
    return this.http.post<ApiResponse<LeaveRequestResource>>(`${this.hrBase}/leave-requests`, payload);
  }

  approveLeaveRequest(id: string): Observable<ApiResponse<LeaveRequestResource>> {
    return this.http.post<ApiResponse<LeaveRequestResource>>(`${this.hrBase}/leave-requests/${id}/approve`, {});
  }

  rejectLeaveRequest(id: string): Observable<ApiResponse<LeaveRequestResource>> {
    return this.http.post<ApiResponse<LeaveRequestResource>>(`${this.hrBase}/leave-requests/${id}/reject`, {});
  }

  cancelLeaveRequest(id: string, reason: string): Observable<ApiResponse<LeaveRequestResource>> {
    return this.http.post<ApiResponse<LeaveRequestResource>>(`${this.hrBase}/leave-requests/${id}/cancel`, { reason });
  }

  // --- Timesheets ---

  getTimesheets(params?: QueryFilterParams): Observable<PaginatedResponse<TimesheetResource>> {
    return this.http.get<PaginatedResponse<TimesheetResource>>(`${this.hrBase}/timesheets`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  submitTimesheet(payload: SubmitTimesheetPayload): Observable<ApiResponse<TimesheetResource>> {
    return this.http.post<ApiResponse<TimesheetResource>>(`${this.hrBase}/timesheets`, payload);
  }

  approveTimesheet(id: string): Observable<ApiResponse<TimesheetResource>> {
    return this.http.post<ApiResponse<TimesheetResource>>(`${this.hrBase}/timesheets/${id}/approve`, {});
  }

  // --- Payroll Runs & Frontier Workers ---

  getPayrollRuns(params?: QueryFilterParams): Observable<PaginatedResponse<PayrollRunResource>> {
    return this.http.get<PaginatedResponse<PayrollRunResource>>(`${this.payrollBase}/runs`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  getFrontierWorkers(params?: QueryFilterParams): Observable<PaginatedResponse<FrontierWorkerResource>> {
    return this.http.get<PaginatedResponse<FrontierWorkerResource>>(`${this.payrollBase}/frontier-workers`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }
}
