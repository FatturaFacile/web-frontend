import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import {
  ApiResponse,
  VisitorsCheckInRequest,
  VisitorsKiosk,
  VisitorsKioskCheckInRequest,
  VisitorsKioskCheckOutRequest,
  VisitorsKioskRequest,
  VisitorsKioskVisit,
  VisitorsVisit,
  VisitorsVisitRequest,
  VisitorsVisitor,
  VisitorsVisitorRequest,
} from '../models';

@Service()
export class VisitorsApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/visitors`;
  private readonly kioskBase = `${environment.apiBaseUrl}/visitor-kiosk`;

  // Visitors registry
  getVisitors(params?: {
    search?: string;
    page?: number;
    per_page?: number;
  }): Observable<ApiResponse<VisitorsVisitor[]>> {
    let httpParams = new HttpParams();
    if (params?.search) httpParams = httpParams.set('search', params.search);
    if (params?.page) httpParams = httpParams.set('page', params.page.toString());
    if (params?.per_page) httpParams = httpParams.set('per_page', params.per_page.toString());

    return this.http.get<ApiResponse<VisitorsVisitor[]>>(`${this.base}/visitors`, {
      params: httpParams,
    });
  }

  getVisitor(id: string): Observable<ApiResponse<VisitorsVisitor>> {
    return this.http.get<ApiResponse<VisitorsVisitor>>(`${this.base}/visitors/${id}`);
  }

  createVisitor(payload: VisitorsVisitorRequest): Observable<ApiResponse<VisitorsVisitor>> {
    return this.http.post<ApiResponse<VisitorsVisitor>>(`${this.base}/visitors`, payload);
  }

  updateVisitor(
    id: string,
    payload: Partial<VisitorsVisitorRequest>,
  ): Observable<ApiResponse<VisitorsVisitor>> {
    return this.http.put<ApiResponse<VisitorsVisitor>>(`${this.base}/visitors/${id}`, payload);
  }

  eraseVisitor(id: string): Observable<{ message?: string }> {
    return this.http.delete<{ message?: string }>(`${this.base}/visitors/${id}`);
  }

  // Visits
  getVisits(params?: {
    status?: string;
    host_user_id?: string;
    from?: string;
    to?: string;
    page?: number;
    per_page?: number;
  }): Observable<ApiResponse<VisitorsVisit[]>> {
    let httpParams = new HttpParams();
    if (params?.status) httpParams = httpParams.set('status', params.status);
    if (params?.host_user_id) httpParams = httpParams.set('host_user_id', params.host_user_id);
    if (params?.from) httpParams = httpParams.set('from', params.from);
    if (params?.to) httpParams = httpParams.set('to', params.to);
    if (params?.page) httpParams = httpParams.set('page', params.page.toString());
    if (params?.per_page) httpParams = httpParams.set('per_page', params.per_page.toString());

    return this.http.get<ApiResponse<VisitorsVisit[]>>(`${this.base}/visits`, {
      params: httpParams,
    });
  }

  getVisit(id: string): Observable<ApiResponse<VisitorsVisit>> {
    return this.http.get<ApiResponse<VisitorsVisit>>(`${this.base}/visits/${id}`);
  }

  announceVisit(payload: VisitorsVisitRequest): Observable<ApiResponse<VisitorsVisit>> {
    return this.http.post<ApiResponse<VisitorsVisit>>(`${this.base}/visits`, payload);
  }

  checkInVisit(id: string, payload: VisitorsCheckInRequest): Observable<ApiResponse<VisitorsVisit>> {
    return this.http.post<ApiResponse<VisitorsVisit>>(`${this.base}/visits/${id}/check-in`, payload);
  }

  checkOutVisit(id: string): Observable<ApiResponse<VisitorsVisit>> {
    return this.http.post<ApiResponse<VisitorsVisit>>(`${this.base}/visits/${id}/check-out`, {});
  }

  cancelVisit(id: string): Observable<ApiResponse<VisitorsVisit>> {
    return this.http.post<ApiResponse<VisitorsVisit>>(`${this.base}/visits/${id}/cancel`, {});
  }

  getOnSiteVisitors(): Observable<ApiResponse<VisitorsVisit[]>> {
    return this.http.get<ApiResponse<VisitorsVisit[]>>(`${this.base}/on-site`);
  }

  // Kiosks management
  getKiosks(): Observable<ApiResponse<VisitorsKiosk[]>> {
    return this.http.get<ApiResponse<VisitorsKiosk[]>>(`${this.base}/kiosks`);
  }

  registerKiosk(payload: VisitorsKioskRequest): Observable<ApiResponse<VisitorsKiosk>> {
    return this.http.post<ApiResponse<VisitorsKiosk>>(`${this.base}/kiosks`, payload);
  }

  rotateKioskSecret(id: string): Observable<ApiResponse<VisitorsKiosk>> {
    return this.http.post<ApiResponse<VisitorsKiosk>>(`${this.base}/kiosks/${id}/rotate-secret`, {});
  }

  retireKiosk(id: string): Observable<{ message?: string }> {
    return this.http.delete<{ message?: string }>(`${this.base}/kiosks/${id}`);
  }

  // Visitor Kiosk Self-Service
  getKioskExpected(kioskDeviceKey?: string): Observable<ApiResponse<VisitorsKioskVisit[]>> {
    let httpParams = new HttpParams();
    if (kioskDeviceKey) httpParams = httpParams.set('kiosk_key', kioskDeviceKey);

    return this.http.get<ApiResponse<VisitorsKioskVisit[]>>(`${this.kioskBase}/expected`, {
      params: httpParams,
    });
  }

  kioskCheckIn(payload: VisitorsKioskCheckInRequest): Observable<ApiResponse<VisitorsKioskVisit>> {
    return this.http.post<ApiResponse<VisitorsKioskVisit>>(`${this.kioskBase}/check-in`, payload);
  }

  kioskCheckOut(payload: VisitorsKioskCheckOutRequest): Observable<ApiResponse<VisitorsKioskVisit>> {
    return this.http.post<ApiResponse<VisitorsKioskVisit>>(`${this.kioskBase}/check-out`, payload);
  }
}
