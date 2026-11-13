import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { toHttpParams } from '../http/laravel-http.utils';
import {
  ApiResponse,
  PaginatedResponse,
  QueryFilterParams,
  PracticeActivityControlResponse,
  PracticeActivityItem,
  PracticeAppliedRetainer,
  PracticeChecklistRequest,
  PracticeCloseRequest,
  PracticeClosing,
  PracticeClosingOverview,
  PracticeClosingRequest,
  PracticeFeeNoteRequest,
  PracticeRetainer,
  PracticeRetainerApplyRequest,
  PracticeRetainerBalance,
  PracticeRetainerRequest,
} from '../models';

@Service()
export class PracticeApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/practice`;

  getActivityControl(params: {
    from: string;
    to: string;
    user_id?: string;
    stale_days?: number;
  }): Observable<ApiResponse<PracticeActivityControlResponse>> {
    let httpParams = new HttpParams().set('from', params.from).set('to', params.to);
    if (params.user_id) httpParams = httpParams.set('user_id', params.user_id);
    if (params.stale_days !== undefined) httpParams = httpParams.set('stale_days', params.stale_days.toString());
    return this.http.get<ApiResponse<PracticeActivityControlResponse>>(`${this.base}/activity-control`, {
      params: httpParams,
    });
  }

  createFeeNoteFromActivities(
    payload: PracticeFeeNoteRequest,
  ): Observable<ApiResponse<{ id: string; status: string }>> {
    return this.http.post<ApiResponse<{ id: string; status: string }>>(
      `${this.base}/fee-notes/from-activities`,
      payload,
    );
  }

  getFeeNoteActivities(feeNoteId: string): Observable<ApiResponse<PracticeActivityItem[]>> {
    return this.http.get<ApiResponse<PracticeActivityItem[]>>(
      `${this.base}/fee-notes/${feeNoteId}/activities`,
    );
  }

  getClosingOverview(params: {
    from: string;
    to: string;
  }): Observable<ApiResponse<PracticeClosingOverview>> {
    const httpParams = new HttpParams().set('from', params.from).set('to', params.to);
    return this.http.get<ApiResponse<PracticeClosingOverview>>(`${this.base}/closing-overview`, {
      params: httpParams,
    });
  }

  openClosing(payload: PracticeClosingRequest): Observable<ApiResponse<PracticeClosing>> {
    return this.http.post<ApiResponse<PracticeClosing>>(`${this.base}/closings`, payload);
  }

  updateClosingChecklist(
    id: string,
    payload: PracticeChecklistRequest,
  ): Observable<ApiResponse<PracticeClosing>> {
    return this.http.put<ApiResponse<PracticeClosing>>(
      `${this.base}/closings/${id}/checklist`,
      payload,
    );
  }

  closePeriod(
    id: string,
    payload: PracticeCloseRequest = {},
  ): Observable<ApiResponse<PracticeClosing>> {
    return this.http.post<ApiResponse<PracticeClosing>>(
      `${this.base}/closings/${id}/close`,
      payload,
    );
  }

  reopenPeriod(id: string): Observable<ApiResponse<PracticeClosing>> {
    return this.http.post<ApiResponse<PracticeClosing>>(
      `${this.base}/closings/${id}/reopen`,
      {},
    );
  }

  /** Retainers, paged on the server; `client_id` and `status` narrow the list, the rest are grid parameters. */
  getRetainers(
    params?: QueryFilterParams & { client_id?: string; status?: string },
  ): Observable<PaginatedResponse<PracticeRetainer>> {
    return this.http.get<PaginatedResponse<PracticeRetainer>>(`${this.base}/retainers`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  createRetainer(payload: PracticeRetainerRequest): Observable<ApiResponse<PracticeRetainer>> {
    return this.http.post<ApiResponse<PracticeRetainer>>(`${this.base}/retainers`, payload);
  }

  getRetainerBalances(clientId?: string): Observable<ApiResponse<PracticeRetainerBalance[]>> {
    let httpParams = new HttpParams();
    if (clientId) httpParams = httpParams.set('client_id', clientId);
    return this.http.get<ApiResponse<PracticeRetainerBalance[]>>(`${this.base}/retainers/balances`, {
      params: httpParams,
    });
  }

  applyRetainer(
    retainerId: string,
    payload: PracticeRetainerApplyRequest,
  ): Observable<ApiResponse<PracticeAppliedRetainer>> {
    return this.http.post<ApiResponse<PracticeAppliedRetainer>>(
      `${this.base}/retainers/${retainerId}/apply`,
      payload,
    );
  }

  voidRetainer(retainerId: string): Observable<ApiResponse<{ id: string; status: string }>> {
    return this.http.post<ApiResponse<{ id: string; status: string }>>(
      `${this.base}/retainers/${retainerId}/void`,
      {},
    );
  }

  getFeeNoteRetainers(feeNoteId: string): Observable<ApiResponse<PracticeAppliedRetainer[]>> {
    return this.http.get<ApiResponse<PracticeAppliedRetainer[]>>(
      `${this.base}/fee-notes/${feeNoteId}/retainers`,
    );
  }
}
