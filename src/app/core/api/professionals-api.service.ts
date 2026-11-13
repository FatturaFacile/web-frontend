import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { toHttpParams } from '../http/laravel-http.utils';
import {
  ApiResponse,
  PaginatedResponse,
  QueryFilterParams,
  CreateTimeLogPayload,
  FeeNote,
  LegalCase,
  TimeLog,
} from '../models';

@Service()
export class ProfessionalsApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/professionals`;

  /** Legal cases; the grid parameters (paging, sorting, filters) are the query string of the API. */
  getCases(params?: QueryFilterParams): Observable<PaginatedResponse<LegalCase>> {
    return this.http.get<PaginatedResponse<LegalCase>>(`${this.base}/cases`, { params: params ? toHttpParams(params) : undefined });
  }

  /** Billable activities of a period; `is_billed` narrows to billed or unbilled ones. */
  getTimeLogs(params?: QueryFilterParams): Observable<PaginatedResponse<TimeLog>> {
    return this.http.get<PaginatedResponse<TimeLog>>(`${this.base}/time-logs`, { params: params ? toHttpParams(params) : undefined });
  }

  logTime(payload: CreateTimeLogPayload): Observable<ApiResponse<TimeLog>> {
    return this.http.post<ApiResponse<TimeLog>>(`${this.base}/time-logs`, payload);
  }

  getFeeNotes(params?: QueryFilterParams): Observable<PaginatedResponse<FeeNote>> {
    return this.http.get<PaginatedResponse<FeeNote>>(`${this.base}/fee-notes`, { params: params ? toHttpParams(params) : undefined });
  }
}
