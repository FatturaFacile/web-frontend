import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { ApiResponse } from '../models';
import { ExtraListResponse, ExtraPayload, ExtraRecord } from './extra-api.types';

/** Corporate group, multi-company legal entities, operational sites, intercompany transactions and consolidation runs (`/corporate-group`). */
@Service()
export class CorporateGroupApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/corporate-group`;

  listCompanies(): Observable<ExtraListResponse> {
    return this.http.get<ExtraListResponse>(`${this.base}/companies`);
  }

  getCompany(id: string): Observable<ApiResponse<ExtraRecord>> {
    return this.http.get<ApiResponse<ExtraRecord>>(`${this.base}/companies/${id}`);
  }

  createCompany(payload: ExtraPayload): Observable<ApiResponse<ExtraRecord>> {
    return this.http.post<ApiResponse<ExtraRecord>>(`${this.base}/companies`, payload);
  }

  updateCompany(id: string, payload: ExtraPayload): Observable<ApiResponse<ExtraRecord>> {
    return this.http.put<ApiResponse<ExtraRecord>>(`${this.base}/companies/${id}`, payload);
  }

  deleteCompany(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/companies/${id}`);
  }

  listSites(companyId: string): Observable<ExtraListResponse> {
    return this.http.get<ExtraListResponse>(`${this.base}/companies/${companyId}/sites`);
  }

  createSite(companyId: string, payload: ExtraPayload): Observable<ApiResponse<ExtraRecord>> {
    return this.http.post<ApiResponse<ExtraRecord>>(`${this.base}/companies/${companyId}/sites`, payload);
  }

  deleteSite(companyId: string, siteId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/companies/${companyId}/sites/${siteId}`);
  }

  listMembers(companyId: string): Observable<ExtraListResponse> {
    return this.http.get<ExtraListResponse>(`${this.base}/companies/${companyId}/members`);
  }

  addMember(companyId: string, payload: ExtraPayload): Observable<ApiResponse<ExtraRecord>> {
    return this.http.post<ApiResponse<ExtraRecord>>(`${this.base}/companies/${companyId}/members`, payload);
  }

  removeMember(companyId: string, userId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/companies/${companyId}/members/${userId}`);
  }

  getAccountingSettings(companyId: string): Observable<ApiResponse<ExtraRecord>> {
    return this.http.get<ApiResponse<ExtraRecord>>(`${this.base}/companies/${companyId}/accounting-settings`);
  }

  updateAccountingSettings(companyId: string, payload: ExtraPayload): Observable<ApiResponse<ExtraRecord>> {
    return this.http.put<ApiResponse<ExtraRecord>>(`${this.base}/companies/${companyId}/accounting-settings`, payload);
  }

  listIntercompanyTransactions(): Observable<ExtraListResponse> {
    return this.http.get<ExtraListResponse>(`${this.base}/intercompany/transactions`);
  }

  createIntercompanyTransaction(payload: ExtraPayload): Observable<ApiResponse<ExtraRecord>> {
    return this.http.post<ApiResponse<ExtraRecord>>(`${this.base}/intercompany/transactions`, payload);
  }

  getIntercompanyTransaction(id: string): Observable<ApiResponse<ExtraRecord>> {
    return this.http.get<ApiResponse<ExtraRecord>>(`${this.base}/intercompany/transactions/${id}`);
  }

  cancelIntercompanyTransaction(id: string): Observable<ApiResponse<ExtraRecord>> {
    return this.http.post<ApiResponse<ExtraRecord>>(`${this.base}/intercompany/transactions/${id}/cancel`, {});
  }

  listConsolidationRuns(): Observable<ExtraListResponse> {
    return this.http.get<ExtraListResponse>(`${this.base}/consolidation/runs`);
  }

  createConsolidationRun(payload: ExtraPayload): Observable<ApiResponse<ExtraRecord>> {
    return this.http.post<ApiResponse<ExtraRecord>>(`${this.base}/consolidation/runs`, payload);
  }

  getConsolidationRun(id: string): Observable<ApiResponse<ExtraRecord>> {
    return this.http.get<ApiResponse<ExtraRecord>>(`${this.base}/consolidation/runs/${id}`);
  }
}
