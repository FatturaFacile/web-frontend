import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import {
  ApiResponse,
  CollectiveAgreementLevelPayload,
  CollectiveAgreementPayload,
  CollectiveAgreementResource,
  PaginatedResponse,
  QueryFilterParams,
} from '../models';
import { toHttpParams } from '../http/laravel-http.utils';

/** Collective agreements (CCNL) and their levels. Generic agreements are read-only on the server. */
@Service()
export class PayrollAgreementApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/payroll/collective-agreements`;

  getAgreements(params?: QueryFilterParams): Observable<PaginatedResponse<CollectiveAgreementResource>> {
    return this.http.get<PaginatedResponse<CollectiveAgreementResource>>(this.base, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  getAgreement(id: string): Observable<ApiResponse<CollectiveAgreementResource>> {
    return this.http.get<ApiResponse<CollectiveAgreementResource>>(`${this.base}/${id}`);
  }

  createAgreement(payload: CollectiveAgreementPayload): Observable<ApiResponse<CollectiveAgreementResource>> {
    return this.http.post<ApiResponse<CollectiveAgreementResource>>(this.base, payload);
  }

  updateAgreement(id: string, payload: CollectiveAgreementPayload): Observable<ApiResponse<CollectiveAgreementResource>> {
    return this.http.put<ApiResponse<CollectiveAgreementResource>>(`${this.base}/${id}`, payload);
  }

  deleteAgreement(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  addLevel(id: string, payload: CollectiveAgreementLevelPayload): Observable<ApiResponse<CollectiveAgreementResource>> {
    return this.http.post<ApiResponse<CollectiveAgreementResource>>(`${this.base}/${id}/levels`, payload);
  }

  updateLevel(
    id: string,
    levelId: string,
    payload: CollectiveAgreementLevelPayload,
  ): Observable<ApiResponse<CollectiveAgreementResource>> {
    return this.http.put<ApiResponse<CollectiveAgreementResource>>(`${this.base}/${id}/levels/${levelId}`, payload);
  }

  deleteLevel(id: string, levelId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}/levels/${levelId}`);
  }
}
