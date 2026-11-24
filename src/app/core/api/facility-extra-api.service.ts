import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { toHttpParams } from '../http/laravel-http.utils';
import { ApiResponse, LaravelPaginationMeta } from '../models';

type Filters = Record<string, string | number | boolean | null | undefined | string[]>;
/** Request body: field names mirror the Laravel FormRequest of the route. */
type Payload = Record<string, unknown>;
/** Generic resource returned by the API. */
type Row = Record<string, unknown>;
type ListResponse<T> = ApiResponse<T[]> & { meta?: LaravelPaginationMeta };

/** Additional endpoints of the facility API not covered by the dedicated typed services. */
@Service()
export class FacilityExtraApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  /** GET /facility/buildings/{} */
  getBuilding(buildingId: string, filters?: Filters): Observable<ApiResponse<Row>> {
    return this.http.get<ApiResponse<Row>>(`${this.base}/facility/buildings/${buildingId}`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** GET /facility/spaces/{} */
  getSpace(spaceId: string, filters?: Filters): Observable<ApiResponse<Row>> {
    return this.http.get<ApiResponse<Row>>(`${this.base}/facility/spaces/${spaceId}`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** GET /facility/bookings/{} */
  getBooking(bookingId: string, filters?: Filters): Observable<ApiResponse<Row>> {
    return this.http.get<ApiResponse<Row>>(`${this.base}/facility/bookings/${bookingId}`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** GET /facility/booking-series */
  listBookingSeries(filters?: Filters): Observable<ListResponse<Row>> {
    return this.http.get<ListResponse<Row>>(`${this.base}/facility/booking-series`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** GET /facility/booking-series/{} */
  getBookingSery(bookingSeryId: string, filters?: Filters): Observable<ApiResponse<Row>> {
    return this.http.get<ApiResponse<Row>>(`${this.base}/facility/booking-series/${bookingSeryId}`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** GET /facility/service-requests/{} */
  getServiceRequest(serviceRequestId: string, filters?: Filters): Observable<ApiResponse<Row>> {
    return this.http.get<ApiResponse<Row>>(`${this.base}/facility/service-requests/${serviceRequestId}`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** PUT /facility/service-requests/{} */
  updateServiceRequest(serviceRequestId: string, payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.put<ApiResponse<Row>>(`${this.base}/facility/service-requests/${serviceRequestId}`, payload);
  }

  /** POST /facility/service-requests/{}/assign */
  assignServiceRequest(serviceRequestId: string, payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/facility/service-requests/${serviceRequestId}/assign`, payload);
  }

  /** POST /facility/service-requests/{}/start */
  startServiceRequest(serviceRequestId: string, payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/facility/service-requests/${serviceRequestId}/start`, payload);
  }

  /** POST /facility/service-requests/{}/hold */
  holdServiceRequest(serviceRequestId: string, payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/facility/service-requests/${serviceRequestId}/hold`, payload);
  }

  /** POST /facility/service-requests/{}/resolve */
  resolveServiceRequest(serviceRequestId: string, payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/facility/service-requests/${serviceRequestId}/resolve`, payload);
  }

  /** POST /facility/service-requests/{}/close */
  closeServiceRequest(serviceRequestId: string, payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/facility/service-requests/${serviceRequestId}/close`, payload);
  }

  /** POST /facility/service-requests/{}/reopen */
  reopenServiceRequest(serviceRequestId: string, payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/facility/service-requests/${serviceRequestId}/reopen`, payload);
  }

  /** POST /facility/service-requests/{}/cancel */
  cancelServiceRequest(serviceRequestId: string, payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/facility/service-requests/${serviceRequestId}/cancel`, payload);
  }

  /** POST /facility/service-requests/{}/link-work-order */
  linkWorkOrderServiceRequest(serviceRequestId: string, payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/facility/service-requests/${serviceRequestId}/link-work-order`, payload);
  }

  /** POST /facility/service-requests/{}/raise-work-order */
  raiseWorkOrderServiceRequest(serviceRequestId: string, payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/facility/service-requests/${serviceRequestId}/raise-work-order`, payload);
  }

  /** GET /facility/inspection-templates/{} */
  getInspectionTemplate(inspectionTemplateId: string, filters?: Filters): Observable<ApiResponse<Row>> {
    return this.http.get<ApiResponse<Row>>(`${this.base}/facility/inspection-templates/${inspectionTemplateId}`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** GET /facility/inspections/{} */
  getInspection(inspectionId: string, filters?: Filters): Observable<ApiResponse<Row>> {
    return this.http.get<ApiResponse<Row>>(`${this.base}/facility/inspections/${inspectionId}`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** GET /facility/meters/{} */
  getMeter(meterId: string, filters?: Filters): Observable<ApiResponse<Row>> {
    return this.http.get<ApiResponse<Row>>(`${this.base}/facility/meters/${meterId}`, { params: filters ? toHttpParams(filters) : undefined });
  }
}
