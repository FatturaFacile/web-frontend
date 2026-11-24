import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import {
  ApiResponse,
  EmployeeDocumentResource,
  SelfServiceLeaveBalance,
  SelfServiceLeaveRequest,
  SelfServiceLeaveType,
  SelfServiceProfile,
  SelfServiceTraining,
  SubmitSelfServiceLeaveRequestPayload,
} from '../models';
import { toHttpParams } from '../http/laravel-http.utils';

/** Employee portal: every call is scoped by the server to the employee linked to the user (403 otherwise). */
@Service()
export class HrSelfServiceApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/hr/me`;

  getProfile(): Observable<ApiResponse<SelfServiceProfile>> {
    return this.http.get<ApiResponse<SelfServiceProfile>>(this.base);
  }

  /** The absence types, to label own balances and requests (no HR role needed). */
  getLeaveTypes(): Observable<ApiResponse<SelfServiceLeaveType[]>> {
    return this.http.get<ApiResponse<SelfServiceLeaveType[]>>(`${this.base}/leave-types`);
  }

  getLeaveBalances(year?: number): Observable<ApiResponse<SelfServiceLeaveBalance[]>> {
    return this.http.get<ApiResponse<SelfServiceLeaveBalance[]>>(`${this.base}/leave-balances`, {
      params: toHttpParams({ year }),
    });
  }

  getLeaveRequests(): Observable<ApiResponse<SelfServiceLeaveRequest[]>> {
    return this.http.get<ApiResponse<SelfServiceLeaveRequest[]>>(`${this.base}/leave-requests`);
  }

  submitLeaveRequest(payload: SubmitSelfServiceLeaveRequestPayload): Observable<ApiResponse<SelfServiceLeaveRequest>> {
    return this.http.post<ApiResponse<SelfServiceLeaveRequest>>(`${this.base}/leave-requests`, payload);
  }

  cancelLeaveRequest(id: string, reason: string): Observable<ApiResponse<SelfServiceLeaveRequest>> {
    return this.http.post<ApiResponse<SelfServiceLeaveRequest>>(`${this.base}/leave-requests/${id}/cancel`, { reason });
  }

  getTraining(): Observable<ApiResponse<SelfServiceTraining>> {
    return this.http.get<ApiResponse<SelfServiceTraining>>(`${this.base}/training`);
  }

  getDocuments(): Observable<ApiResponse<EmployeeDocumentResource[]>> {
    return this.http.get<ApiResponse<EmployeeDocumentResource[]>>(`${this.base}/documents`);
  }

  downloadDocument(id: string, inline = false): Observable<Blob> {
    return this.http.get(`${this.base}/documents/${id}/download`, {
      params: toHttpParams({ inline: inline ? 1 : undefined }),
      responseType: 'blob',
    });
  }
}
