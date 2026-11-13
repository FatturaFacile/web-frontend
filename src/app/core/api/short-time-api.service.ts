import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { toHttpParams } from '../http/laravel-http.utils';
import {
  ApiResponse,
  ConstructionCalendarPayload,
  ConstructionHours,
  ConstructionParametersPayload,
  ConstructionQuery,
  JointCommissionReport,
  PaginatedResponse,
  PayrollGenericRecord,
  QueryFilterParams,
  ShortTimeCasePayload,
  ShortTimeCaseRecord,
  ShortTimeClaim,
  ShortTimeClaimPayload,
  ShortTimeReimbursementPayload,
} from '../models';

/** Short-time work, bad weather and the construction wage under a collective agreement (Swiss companies only: 422 otherwise). */
@Service()
export class ShortTimeApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/payroll`;

  getCases(params?: QueryFilterParams): Observable<PaginatedResponse<ShortTimeCaseRecord>> {
    return this.http.get<PaginatedResponse<ShortTimeCaseRecord>>(`${this.base}/short-time/cases`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  createCase(payload: ShortTimeCasePayload): Observable<ApiResponse<ShortTimeCaseRecord>> {
    return this.http.post<ApiResponse<ShortTimeCaseRecord>>(`${this.base}/short-time/cases`, payload);
  }

  /** Calculates the claim of a month; recalculating replaces a draft. */
  calculateClaim(caseId: string, payload: ShortTimeClaimPayload): Observable<ApiResponse<ShortTimeClaim>> {
    return this.http.post<ApiResponse<ShortTimeClaim>>(`${this.base}/short-time/cases/${caseId}/claims`, payload);
  }

  getClaim(id: string): Observable<ApiResponse<ShortTimeClaim>> {
    return this.http.get<ApiResponse<ShortTimeClaim>>(`${this.base}/short-time/claims/${id}`);
  }

  /** Marks the claim as sent to the fund. */
  submitClaim(id: string): Observable<ApiResponse<ShortTimeClaim>> {
    return this.http.post<ApiResponse<ShortTimeClaim>>(`${this.base}/short-time/claims/${id}/submit`, {});
  }

  /** Carries the claim into the payroll variable inputs. */
  applyClaim(id: string): Observable<ApiResponse<ShortTimeClaim>> {
    return this.http.post<ApiResponse<ShortTimeClaim>>(`${this.base}/short-time/claims/${id}/apply`, {});
  }

  recordReimbursement(id: string, payload: ShortTimeReimbursementPayload): Observable<ApiResponse<ShortTimeClaim>> {
    return this.http.post<ApiResponse<ShortTimeClaim>>(`${this.base}/short-time/claims/${id}/reimbursement`, payload);
  }

  /** CSV with the figures for the forms of the fund (not the official form). */
  downloadClaim(id: string): Observable<Blob> {
    return this.http.get(`${this.base}/short-time/claims/${id}/export`, { responseType: 'blob' });
  }

  // --- Construction wage ---

  addConstructionParameters(payload: ConstructionParametersPayload): Observable<ApiResponse<PayrollGenericRecord>> {
    return this.http.post<ApiResponse<PayrollGenericRecord>>(`${this.base}/construction/parameters`, payload);
  }

  saveConstructionCalendar(payload: ConstructionCalendarPayload): Observable<ApiResponse<{ saved: number }>> {
    return this.http.put<ApiResponse<{ saved: number }>>(`${this.base}/construction/calendar`, payload);
  }

  getConstructionHours(query: ConstructionQuery): Observable<ApiResponse<ConstructionHours>> {
    return this.http.get<ApiResponse<ConstructionHours>>(`${this.base}/construction/hours`, {
      params: toHttpParams(query),
    });
  }

  getJointCommissionReport(query: ConstructionQuery): Observable<ApiResponse<JointCommissionReport>> {
    return this.http.get<ApiResponse<JointCommissionReport>>(`${this.base}/construction/joint-commission-report`, {
      params: toHttpParams(query),
    });
  }
}
