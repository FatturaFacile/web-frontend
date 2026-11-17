import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { ApiResponse, PaginatedResponse, QueryFilterParams } from '../models';
import { toHttpParams } from '../http/laravel-http.utils';

export type TrustRecord = Record<string, unknown>;

/** Document-trust preservation packages, disposal workflow, legal hold, sealing and settings. */
@Service()
export class DocumentTrustExtraApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/document-trust`;

  private list(path: string, params?: QueryFilterParams): Observable<PaginatedResponse<TrustRecord>> {
    return this.http.get<PaginatedResponse<TrustRecord>>(`${this.base}/${path}`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  private post(path: string, payload: TrustRecord = {}): Observable<ApiResponse<TrustRecord>> {
    return this.http.post<ApiResponse<TrustRecord>>(`${this.base}/${path}`, payload);
  }

  // Read-only lists
  getPreservationAccessLogs(params?: QueryFilterParams) { return this.list('preservation-access-logs', params); }
  getPreservationItems(params?: QueryFilterParams) { return this.list('preservation-items', params); }
  getPreservationDisposals(params?: QueryFilterParams) { return this.list('preservation-disposals', params); }
  getDisposalCandidates(params?: QueryFilterParams) { return this.list('preservation-disposal-candidates', params); }

  // Disposal proposals
  getDisposalProposals(params?: QueryFilterParams) { return this.list('preservation-disposal-proposals', params); }
  createDisposalProposal(payload: TrustRecord) { return this.post('preservation-disposal-proposals', payload); }
  approveDisposalProposal(id: string, payload: TrustRecord = {}) { return this.post(`preservation-disposal-proposals/${id}/approve`, payload); }
  rejectDisposalProposal(id: string, payload: TrustRecord = {}) { return this.post(`preservation-disposal-proposals/${id}/reject`, payload); }
  executeDisposalProposal(id: string, payload: TrustRecord = {}) { return this.post(`preservation-disposal-proposals/${id}/execute`, payload); }

  // Packages
  getPreservationPackages(params?: QueryFilterParams) { return this.list('preservation-packages', params); }
  createPreservationPackage(payload: TrustRecord) { return this.post('preservation-packages', payload); }
  getPreservationPackage(id: string): Observable<ApiResponse<TrustRecord>> {
    return this.http.get<ApiResponse<TrustRecord>>(`${this.base}/preservation-packages/${id}`);
  }
  deletePreservationPackage(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/preservation-packages/${id}`);
  }
  closePreservationPackage(id: string, payload: TrustRecord = {}) { return this.post(`preservation-packages/${id}/close`, payload); }
  verifyPreservationPackage(id: string) { return this.post(`preservation-packages/${id}/verify`); }
  exportPreservationPackage(id: string): Observable<Blob> {
    return this.http.get(`${this.base}/preservation-packages/${id}/export`, { responseType: 'blob' });
  }
  addPackageItems(id: string, payload: TrustRecord) { return this.post(`preservation-packages/${id}/items`, payload); }
  removePackageItem(id: string, itemId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/preservation-packages/${id}/items/${itemId}`);
  }
  placeLegalHold(id: string, payload: TrustRecord = {}) { return this.post(`preservation-packages/${id}/legal-hold`, payload); }
  releaseLegalHold(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/preservation-packages/${id}/legal-hold`);
  }

  // Sealing
  sealJournalBook(payload: TrustRecord) { return this.post('preservation-seal/journal-book', payload); }
  sealPayslips(payload: TrustRecord) { return this.post('preservation-seal/payslips', payload); }

  // Settings
  getPreservationSettings(): Observable<ApiResponse<TrustRecord>> {
    return this.http.get<ApiResponse<TrustRecord>>(`${this.base}/preservation-settings`);
  }
  updatePreservationSettings(payload: TrustRecord): Observable<ApiResponse<TrustRecord>> {
    return this.http.put<ApiResponse<TrustRecord>>(`${this.base}/preservation-settings`, payload);
  }
}
