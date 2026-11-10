import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { toHttpParams } from '../http/laravel-http.utils';
import {
  ApiResponse,
  FieldServiceTicket,
  FieldWorkOrder,
  FieldWorkOrderListParams,
  FieldWorkOrderPage,
  FieldWorkOrderPayload,
  GeneratedInvoice,
  PaginatedResponse,
  ServiceReportListParams,
  ServiceReportPhoto,
  ServiceReportPhotoStage,
  ServiceReportSignPayload,
  ServiceReportSummary,
  WorkOrderSignaturePayload,
} from '../models';

// TODO: Pending API contract update
@Service()
export class FieldServiceApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/field-service`;
  private readonly reportsBase = `${environment.apiBaseUrl}/service-reports`;

  getTickets(): Observable<ApiResponse<FieldServiceTicket[]>> {
    return this.http.get<ApiResponse<FieldServiceTicket[]>>(`${this.base}/tickets`);
  }

  // --- Work orders (field service) ---
  getWorkOrders(params?: FieldWorkOrderListParams): Observable<ApiResponse<FieldWorkOrderPage>> {
    return this.http.get<ApiResponse<FieldWorkOrderPage>>(`${this.base}/work-orders`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  getWorkOrder(id: string): Observable<ApiResponse<FieldWorkOrder>> {
    return this.http.get<ApiResponse<FieldWorkOrder>>(`${this.base}/work-orders/${id}`);
  }

  createWorkOrder(payload: FieldWorkOrderPayload): Observable<ApiResponse<FieldWorkOrder>> {
    return this.http.post<ApiResponse<FieldWorkOrder>>(`${this.base}/work-orders`, payload);
  }

  updateWorkOrder(id: string, payload: FieldWorkOrderPayload): Observable<ApiResponse<FieldWorkOrder>> {
    return this.http.put<ApiResponse<FieldWorkOrder>>(`${this.base}/work-orders/${id}`, payload);
  }

  completeWorkOrder(id: string): Observable<ApiResponse<FieldWorkOrder>> {
    return this.http.post<ApiResponse<FieldWorkOrder>>(`${this.base}/work-orders/${id}/complete`, {});
  }

  signWorkOrder(id: string, payload: WorkOrderSignaturePayload): Observable<ApiResponse<FieldWorkOrder>> {
    return this.http.post<ApiResponse<FieldWorkOrder>>(`${this.base}/work-orders/${id}/signature`, payload);
  }

  invoiceWorkOrder(id: string): Observable<ApiResponse<GeneratedInvoice>> {
    return this.http.post<ApiResponse<GeneratedInvoice>>(`${this.base}/work-orders/${id}/invoice`, {});
  }

  // --- Service reports ---
  getServiceReports(params?: ServiceReportListParams): Observable<PaginatedResponse<ServiceReportSummary>> {
    return this.http.get<PaginatedResponse<ServiceReportSummary>>(this.reportsBase, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  signServiceReport(id: string, payload: ServiceReportSignPayload): Observable<ApiResponse<ServiceReportSummary>> {
    return this.http.post<ApiResponse<ServiceReportSummary>>(`${this.reportsBase}/${id}/sign`, payload);
  }

  generateServiceReportInvoice(id: string): Observable<ApiResponse<GeneratedInvoice>> {
    return this.http.post<ApiResponse<GeneratedInvoice>>(`${this.reportsBase}/${id}/generate-invoice`, {});
  }

  generateConsolidatedInvoice(reportIds: string[]): Observable<ApiResponse<GeneratedInvoice>> {
    return this.http.post<ApiResponse<GeneratedInvoice>>(`${this.reportsBase}/generate-consolidated-invoice`, {
      report_ids: reportIds,
    });
  }

  uploadServiceReportPhoto(
    id: string,
    file: File,
    stage?: ServiceReportPhotoStage | null,
    caption?: string | null,
  ): Observable<ApiResponse<ServiceReportPhoto>> {
    const formData = new FormData();
    formData.append('photo', file, file.name);
    if (stage) {
      formData.append('stage', stage);
    }
    if (caption) {
      formData.append('caption', caption);
    }
    return this.http.post<ApiResponse<ServiceReportPhoto>>(`${this.reportsBase}/${id}/upload-photo`, formData);
  }

  downloadServiceReportPdf(id: string): Observable<Blob> {
    return this.http.get(`${this.reportsBase}/${id}/pdf`, { responseType: 'blob' });
  }
}
