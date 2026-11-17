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

/** Additional endpoints of the workshop API not covered by the dedicated typed services. */
@Service()
export class WorkshopExtraApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  /** GET /workshop/vehicle-stock/{} */
  getVehicleStock(vehicleStockId: string, filters?: Filters): Observable<ApiResponse<Row>> {
    return this.http.get<ApiResponse<Row>>(`${this.base}/workshop/vehicle-stock/${vehicleStockId}`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** GET /workshop/bays */
  listBays(filters?: Filters): Observable<ListResponse<Row>> {
    return this.http.get<ListResponse<Row>>(`${this.base}/workshop/bays`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** POST /workshop/bays */
  createBay(payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/workshop/bays`, payload);
  }

  /** PUT /workshop/bays/{} */
  updateBay(bayId: string, payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.put<ApiResponse<Row>>(`${this.base}/workshop/bays/${bayId}`, payload);
  }

  /** GET /workshop/schedule */
  getSchedule(filters?: Filters): Observable<ApiResponse<Row>> {
    return this.http.get<ApiResponse<Row>>(`${this.base}/workshop/schedule`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** POST /workshop/schedule */
  createSchedule(payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/workshop/schedule`, payload);
  }

  /** PUT /workshop/schedule/{} */
  updateSchedule(scheduleId: string, payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.put<ApiResponse<Row>>(`${this.base}/workshop/schedule/${scheduleId}`, payload);
  }

  /** POST /workshop/schedule/{}/start */
  startSchedule(scheduleId: string, payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/workshop/schedule/${scheduleId}/start`, payload);
  }

  /** POST /workshop/schedule/{}/complete */
  completeSchedule(scheduleId: string, payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/workshop/schedule/${scheduleId}/complete`, payload);
  }

  /** POST /workshop/schedule/{}/cancel */
  cancelSchedule(scheduleId: string, payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/workshop/schedule/${scheduleId}/cancel`, payload);
  }

  /** GET /workshop/estimates */
  listEstimates(filters?: Filters): Observable<ListResponse<Row>> {
    return this.http.get<ListResponse<Row>>(`${this.base}/workshop/estimates`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** POST /workshop/estimates */
  createEstimate(payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/workshop/estimates`, payload);
  }

  /** GET /workshop/estimates/{} */
  getEstimate(estimateId: string, filters?: Filters): Observable<ApiResponse<Row>> {
    return this.http.get<ApiResponse<Row>>(`${this.base}/workshop/estimates/${estimateId}`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** PUT /workshop/estimates/{} */
  updateEstimate(estimateId: string, payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.put<ApiResponse<Row>>(`${this.base}/workshop/estimates/${estimateId}`, payload);
  }

  /** DELETE /workshop/estimates/{} */
  deleteEstimate(estimateId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/workshop/estimates/${estimateId}`);
  }

  /** POST /workshop/estimates/{}/lines */
  createEstimateLine(estimateId: string, payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/workshop/estimates/${estimateId}/lines`, payload);
  }

  /** DELETE /workshop/estimates/{}/lines/{} */
  deleteEstimateLine(estimateId: string, lineId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/workshop/estimates/${estimateId}/lines/${lineId}`);
  }

  /** POST /workshop/estimates/{}/send */
  sendEstimate(estimateId: string, payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/workshop/estimates/${estimateId}/send`, payload);
  }

  /** POST /workshop/estimates/{}/approve */
  approveEstimate(estimateId: string, payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/workshop/estimates/${estimateId}/approve`, payload);
  }

  /** POST /workshop/estimates/{}/reject */
  rejectEstimate(estimateId: string, payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/workshop/estimates/${estimateId}/reject`, payload);
  }

  /** POST /workshop/estimates/{}/convert */
  convertEstimate(estimateId: string, payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/workshop/estimates/${estimateId}/convert`, payload);
  }

  /** GET /workshop/warranty-claims */
  listWarrantyClaims(filters?: Filters): Observable<ListResponse<Row>> {
    return this.http.get<ListResponse<Row>>(`${this.base}/workshop/warranty-claims`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** POST /workshop/warranty-claims */
  createWarrantyClaim(payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/workshop/warranty-claims`, payload);
  }

  /** GET /workshop/warranty-claims/{} */
  getWarrantyClaim(warrantyClaimId: string, filters?: Filters): Observable<ApiResponse<Row>> {
    return this.http.get<ApiResponse<Row>>(`${this.base}/workshop/warranty-claims/${warrantyClaimId}`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** PUT /workshop/warranty-claims/{} */
  updateWarrantyClaim(warrantyClaimId: string, payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.put<ApiResponse<Row>>(`${this.base}/workshop/warranty-claims/${warrantyClaimId}`, payload);
  }

  /** POST /workshop/warranty-claims/{}/submit */
  submitWarrantyClaim(warrantyClaimId: string, payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/workshop/warranty-claims/${warrantyClaimId}/submit`, payload);
  }

  /** POST /workshop/warranty-claims/{}/accept */
  acceptWarrantyClaim(warrantyClaimId: string, payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/workshop/warranty-claims/${warrantyClaimId}/accept`, payload);
  }

  /** POST /workshop/warranty-claims/{}/reject */
  rejectWarrantyClaim(warrantyClaimId: string, payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/workshop/warranty-claims/${warrantyClaimId}/reject`, payload);
  }

  /** POST /workshop/warranty-claims/{}/reimburse */
  reimburseWarrantyClaim(warrantyClaimId: string, payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/workshop/warranty-claims/${warrantyClaimId}/reimburse`, payload);
  }

  /** GET /workshop/folders/{}/parts */
  listFolderParts(folderId: string, filters?: Filters): Observable<ListResponse<Row>> {
    return this.http.get<ListResponse<Row>>(`${this.base}/workshop/folders/${folderId}/parts`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** POST /workshop/folders/{}/parts */
  createFolderPart(folderId: string, payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/workshop/folders/${folderId}/parts`, payload);
  }

  /** GET /workshop/parts/{}/availability */
  getPartAvailability(partId: string, filters?: Filters): Observable<ApiResponse<Row>> {
    return this.http.get<ApiResponse<Row>>(`${this.base}/workshop/parts/${partId}/availability`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** POST /workshop/part-consumptions/{}/issue */
  issuePartConsumption(partConsumptionId: string, payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/workshop/part-consumptions/${partConsumptionId}/issue`, payload);
  }

  /** POST /workshop/part-consumptions/{}/release */
  releasePartConsumption(partConsumptionId: string, payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/workshop/part-consumptions/${partConsumptionId}/release`, payload);
  }
}
