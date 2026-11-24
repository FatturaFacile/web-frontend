import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { toHttpParams } from '../http/laravel-http.utils';
import {
  ApiResponse,
  Appointment,
  AppointmentFilterParams,
  PaginatedResponse,
  AppointmentCalendarItem,
  AppointmentConflictCheckRequest,
  AppointmentConflictCheckResponse,
  CancelAppointmentRequest,
  CreateAppointmentRequest,
  UpdateAppointmentRequest,
} from '../models';

@Service()
export class AppointmentApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/appointments`;

  getAppointments(params?: AppointmentFilterParams): Observable<PaginatedResponse<Appointment>> {
    return this.http.get<PaginatedResponse<Appointment>>(this.base, { params: params ? toHttpParams(params) : undefined });
  }

  getAppointment(id: string): Observable<ApiResponse<Appointment>> {
    return this.http.get<ApiResponse<Appointment>>(`${this.base}/${id}`);
  }

  createAppointment(payload: CreateAppointmentRequest): Observable<ApiResponse<Appointment>> {
    return this.http.post<ApiResponse<Appointment>>(this.base, payload);
  }

  updateAppointment(id: string, payload: UpdateAppointmentRequest): Observable<ApiResponse<Appointment>> {
    return this.http.put<ApiResponse<Appointment>>(`${this.base}/${id}`, payload);
  }

  patchAppointment(id: string, payload: UpdateAppointmentRequest): Observable<ApiResponse<Appointment>> {
    return this.http.patch<ApiResponse<Appointment>>(`${this.base}/${id}`, payload);
  }

  deleteAppointment(id: string): Observable<ApiResponse<{ id: string }>> {
    return this.http.delete<ApiResponse<{ id: string }>>(`${this.base}/${id}`);
  }

  getCalendar(params: {
    start: string;
    end: string;
    technician_id?: string;
    contact_id?: string;
    status_id?: string;
  }): Observable<ApiResponse<AppointmentCalendarItem[]>> {
    let httpParams = new HttpParams().set('start', params.start).set('end', params.end);
    if (params.technician_id) httpParams = httpParams.set('technician_id', params.technician_id);
    if (params.contact_id) httpParams = httpParams.set('contact_id', params.contact_id);
    if (params.status_id) httpParams = httpParams.set('status_id', params.status_id);

    return this.http.get<ApiResponse<AppointmentCalendarItem[]>>(`${this.base}/calendar`, {
      params: httpParams,
    });
  }

  checkConflicts(payload: AppointmentConflictCheckRequest): Observable<ApiResponse<AppointmentConflictCheckResponse>> {
    return this.http.post<ApiResponse<AppointmentConflictCheckResponse>>(`${this.base}/check-conflicts`, payload);
  }

  cancelAppointment(id: string, payload: CancelAppointmentRequest): Observable<ApiResponse<Appointment>> {
    return this.http.post<ApiResponse<Appointment>>(`${this.base}/${id}/cancel`, payload);
  }

  convertToServiceReport(id: string): Observable<ApiResponse<{ service_report_id: string }>> {
    return this.http.post<ApiResponse<{ service_report_id: string }>>(`${this.base}/${id}/convert-to-service-report`, {});
  }
}
