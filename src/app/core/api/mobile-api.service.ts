import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { ApiResponse, PaginatedResponse, QueryFilterParams } from '../models';
import { toHttpParams } from '../http/laravel-http.utils';

export type MobileRecord = Record<string, unknown>;

/**
 * Mobile module endpoints usable from the web back-office (devices, approvals, payslips, shifts, work sites).
 * Machine-only endpoints (PKCE, bootstrap, sync, push-token, biometric, manifest, wipe-ack) are intentionally omitted.
 */
@Service()
export class MobileApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/mobile`;

  private list(path: string, params?: QueryFilterParams): Observable<PaginatedResponse<MobileRecord>> {
    return this.http.get<PaginatedResponse<MobileRecord>>(`${this.base}/${path}`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  private post(path: string, payload: MobileRecord = {}): Observable<ApiResponse<MobileRecord>> {
    return this.http.post<ApiResponse<MobileRecord>>(`${this.base}/${path}`, payload);
  }

  private remove(path: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${path}`);
  }

  getAdminDevices(params?: QueryFilterParams) { return this.list('admin/devices', params); }
  publishPayslips(payload: MobileRecord) { return this.post('admin/payslips', payload); }

  getApprovals(params?: QueryFilterParams) { return this.list('approvals', params); }
  decideApproval(id: string, payload: MobileRecord) { return this.post(`approvals/${id}/decision`, payload); }

  getDevices(params?: QueryFilterParams) { return this.list('devices', params); }
  registerDevice(payload: MobileRecord) { return this.post('devices', payload); }
  deleteDevice(id: string) { return this.remove(`devices/${id}`); }

  getPayslips(params?: QueryFilterParams) { return this.list('payslips', params); }
  downloadPayslip(id: string): Observable<Blob> {
    return this.http.get(`${this.base}/payslips/${id}/download`, { responseType: 'blob' });
  }
  markPayslipRead(id: string) { return this.post(`payslips/${id}/read-receipt`); }

  parseReceipt(payload: MobileRecord) { return this.post('receipts/parse', payload); }

  getShifts(params?: QueryFilterParams) { return this.list('shifts', params); }
  startShift(payload: MobileRecord) { return this.post('shifts', payload); }
  deleteShift(id: string) { return this.remove(`shifts/${id}`); }

  getWorkSites(params?: QueryFilterParams) { return this.list('work-sites', params); }
  createWorkSite(payload: MobileRecord) { return this.post('work-sites', payload); }
  updateWorkSite(id: string, payload: MobileRecord): Observable<ApiResponse<MobileRecord>> {
    return this.http.put<ApiResponse<MobileRecord>>(`${this.base}/work-sites/${id}`, payload);
  }
  deleteWorkSite(id: string) { return this.remove(`work-sites/${id}`); }
}
