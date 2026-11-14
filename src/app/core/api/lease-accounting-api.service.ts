import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { map, Observable } from 'rxjs';
import { toHttpParams } from '../http/laravel-http.utils';
import {
  ApiResponse,
  LaravelPaginationMeta,
  LeaseActivateRequest,
  LeaseCancelRequest,
  LeaseContract,
  LeaseContractRequest,
  LeaseMaturityReport,
  LeaseMeasurementPreview,
  LeasePeriodPosting,
  LeasePostingRunResult,
  LeaseRemeasureRequest,
  LeaseScheduleLine,
  LeaseScheduleVersion,
  PaginatedResponse,
  QueryFilterParams,
} from '../models';

@Service()
export class LeaseAccountingApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/leases`;

  /** Grid list: page-level filters plus the grid query (paging, sort, column filters, grid_values). */
  getContracts(
    params: QueryFilterParams & { status?: string; asset_class?: string; currency?: string; exemption?: string } = {},
  ): Observable<PaginatedResponse<LeaseContract>> {
    return this.http
      .get<ApiResponse<LeaseContract[]> & { meta?: LaravelPaginationMeta }>(`${this.base}/contracts`, { params: toHttpParams(params) })
      .pipe(map((res) => ({ ...res, meta: res.meta ?? plainListMeta(res.data, params) })));
  }

  getContract(id: string): Observable<ApiResponse<LeaseContract>> {
    return this.http.get<ApiResponse<LeaseContract>>(`${this.base}/contracts/${id}`);
  }

  createContract(payload: LeaseContractRequest): Observable<ApiResponse<LeaseContract>> {
    return this.http.post<ApiResponse<LeaseContract>>(`${this.base}/contracts`, payload);
  }

  updateContract(id: string, payload: Partial<LeaseContractRequest>): Observable<ApiResponse<LeaseContract>> {
    return this.http.put<ApiResponse<LeaseContract>>(`${this.base}/contracts/${id}`, payload);
  }

  deleteContract(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/contracts/${id}`);
  }

  previewContract(id: string): Observable<ApiResponse<LeaseMeasurementPreview>> {
    return this.http.get<ApiResponse<LeaseMeasurementPreview>>(`${this.base}/contracts/${id}/preview`);
  }

  activateContract(id: string, payload: LeaseActivateRequest = {}): Observable<ApiResponse<LeaseContract>> {
    return this.http.post<ApiResponse<LeaseContract>>(`${this.base}/contracts/${id}/activate`, payload);
  }

  remeasureContract(id: string, payload: LeaseRemeasureRequest): Observable<ApiResponse<LeaseScheduleVersion>> {
    return this.http.post<ApiResponse<LeaseScheduleVersion>>(`${this.base}/contracts/${id}/remeasure`, payload);
  }

  cancelContract(id: string, payload: LeaseCancelRequest): Observable<ApiResponse<LeaseContract>> {
    return this.http.post<ApiResponse<LeaseContract>>(`${this.base}/contracts/${id}/cancel`, payload);
  }

  /** The schedule in force, or the rows a given version produced (including the ones a remeasurement superseded). */
  getSchedule(id: string, versionNumber?: number): Observable<ApiResponse<LeaseScheduleLine[]>> {
    let params = new HttpParams();
    if (versionNumber !== undefined) {
      params = params.set('version_number', versionNumber.toString());
    }
    return this.http.get<ApiResponse<LeaseScheduleLine[]>>(`${this.base}/contracts/${id}/schedule`, { params });
  }

  getVersions(id: string): Observable<ApiResponse<LeaseScheduleVersion[]>> {
    return this.http.get<ApiResponse<LeaseScheduleVersion[]>>(`${this.base}/contracts/${id}/versions`);
  }

  postPeriods(id: string, throughDate: string): Observable<ApiResponse<LeasePeriodPosting[]>> {
    return this.http.post<ApiResponse<LeasePeriodPosting[]>>(`${this.base}/contracts/${id}/post-periods`, {
      through_date: throughDate,
    });
  }

  runPostings(throughDate: string): Observable<ApiResponse<LeasePostingRunResult[]>> {
    return this.http.post<ApiResponse<LeasePostingRunResult[]>>(`${this.base}/postings/run`, {
      through_date: throughDate,
    });
  }

  getMaturityReport(params: { as_of?: string; currency?: string } = {}): Observable<ApiResponse<LeaseMaturityReport>> {
    return this.http.get<ApiResponse<LeaseMaturityReport>>(`${this.base}/reports/maturity`, {
      params: toHttpParams(params),
    });
  }
}

/** The `grid_values` answer is a plain list without meta: give it one so every response is a PaginatedResponse. */
function plainListMeta(items: unknown[] | undefined, params: QueryFilterParams): LaravelPaginationMeta {
  const count = items?.length ?? 0;
  return { current_page: params.page ?? 1, from: null, to: null, last_page: 1, per_page: count, total: count };
}
