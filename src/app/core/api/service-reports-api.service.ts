import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { ApiResponse, ServiceReportSummary } from '../models';

export interface ServiceReportLinePayload {
  line_type_id: string;
  item_id?: string | null;
  description: string;
  quantity: number;
  unit_of_measure?: string | null;
  unit_price: number;
  discount_percent?: number | null;
  vat_code_id?: string | null;
  tax_rate?: number | null;
  is_billable?: boolean;
  notes?: string | null;
}

/** Body of `POST /service-reports` and `PUT|PATCH /service-reports/{id}` (all optional on update except where noted by the API). */
export interface ServiceReportPayload {
  contact_id?: string;
  technician_id?: string;
  ticket_id?: string | null;
  project_id?: string | null;
  report_date?: string;
  status_id?: string | null;
  time_start?: string | null;
  time_end?: string | null;
  travel_distance_km?: number | null;
  site_address?: string | null;
  customer_notes?: string | null;
  internal_notes?: string | null;
  is_portal_visible?: boolean;
  lines?: ServiceReportLinePayload[];
}

/** CRUD of the service reports (rapportini di intervento); signing, photos and invoicing live in `FieldServiceApiService`. */
@Service()
export class ServiceReportsApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/service-reports`;

  getServiceReport(id: string): Observable<ApiResponse<ServiceReportSummary>> {
    return this.http.get<ApiResponse<ServiceReportSummary>>(`${this.base}/${id}`);
  }

  createServiceReport(payload: ServiceReportPayload): Observable<ApiResponse<ServiceReportSummary>> {
    return this.http.post<ApiResponse<ServiceReportSummary>>(this.base, payload);
  }

  updateServiceReport(id: string, payload: ServiceReportPayload): Observable<ApiResponse<ServiceReportSummary>> {
    return this.http.put<ApiResponse<ServiceReportSummary>>(`${this.base}/${id}`, payload);
  }

  /** Partial update (same endpoint as PUT). */
  patchServiceReport(id: string, payload: ServiceReportPayload): Observable<ApiResponse<ServiceReportSummary>> {
    return this.http.patch<ApiResponse<ServiceReportSummary>>(`${this.base}/${id}`, payload);
  }

  deleteServiceReport(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
