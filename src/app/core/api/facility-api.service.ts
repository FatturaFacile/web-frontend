import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import {
  FacilityBooking,
  FacilityBookingCheckRequest,
  FacilityBookingCheckResult,
  FacilityBookingRequest,
  FacilityBookingRuleEffective,
  FacilityBookingRuleRequest,
  FacilityBookingSeriesRequest,
  FacilityBookingSeriesResult,
  FacilityBookableKind,
  FacilityBuilding,
  FacilityBuildingRequest,
  FacilityCompleteInspectionRequest,
  FacilityInspection,
  FacilityInspectionTemplate,
  FacilityInspectionTemplateRequest,
  FacilityMeter,
  FacilityMeterReading,
  FacilityMeterReadingRequest,
  FacilityMeterRequest,
  FacilityMeterSummary,
  FacilityOverview,
  FacilityRequestComment,
  FacilityRequestCommentRequest,
  FacilityResponse,
  FacilityServiceRequest,
  FacilityServiceRequestBoard,
  FacilityServiceRequestRequest,
  FacilitySpace,
  FacilitySpaceNode,
  FacilitySpaceRequest,
} from '../models';

type Filters = Record<string, string | number | boolean | null | undefined>;

function toParams(filters?: Filters): HttpParams {
  let params = new HttpParams();
  for (const [key, value] of Object.entries(filters ?? {})) {
    if (value !== undefined && value !== null && value !== '') {
      params = params.set(key, typeof value === 'boolean' ? (value ? '1' : '0') : String(value));
    }
  }
  return params;
}

/** Facility management and workplace API (`/facility`). Payload field names mirror the API form requests. */
@Service()
export class FacilityApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/facility`;

  getOverview(): Observable<FacilityResponse<FacilityOverview>> {
    return this.http.get<FacilityResponse<FacilityOverview>>(`${this.base}/overview`);
  }

  // Buildings and spaces
  getBuildings(filters?: { active?: boolean; q?: string; per_page?: number }): Observable<FacilityResponse<FacilityBuilding[]>> {
    return this.http.get<FacilityResponse<FacilityBuilding[]>>(`${this.base}/buildings`, { params: toParams(filters) });
  }

  createBuilding(payload: FacilityBuildingRequest): Observable<FacilityResponse<FacilityBuilding>> {
    return this.http.post<FacilityResponse<FacilityBuilding>>(`${this.base}/buildings`, payload);
  }

  updateBuilding(id: string, payload: FacilityBuildingRequest): Observable<FacilityResponse<FacilityBuilding>> {
    return this.http.put<FacilityResponse<FacilityBuilding>>(`${this.base}/buildings/${id}`, payload);
  }

  deleteBuilding(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/buildings/${id}`);
  }

  getSpaceTree(buildingId: string): Observable<FacilityResponse<FacilitySpaceNode[]>> {
    return this.http.get<FacilityResponse<FacilitySpaceNode[]>>(`${this.base}/buildings/${buildingId}/tree`);
  }

  getSpaces(filters?: { building_id?: string; parent_id?: string; kind?: string; bookable?: boolean; active?: boolean; q?: string; per_page?: number }): Observable<FacilityResponse<FacilitySpace[]>> {
    return this.http.get<FacilityResponse<FacilitySpace[]>>(`${this.base}/spaces`, { params: toParams(filters) });
  }

  getAvailableSpaces(filters: { starts_at: string; ends_at: string; building_id?: string; kind?: string; min_capacity?: number }): Observable<FacilityResponse<FacilitySpace[]>> {
    return this.http.get<FacilityResponse<FacilitySpace[]>>(`${this.base}/spaces/available`, { params: toParams(filters) });
  }

  createSpace(payload: FacilitySpaceRequest): Observable<FacilityResponse<FacilitySpace>> {
    return this.http.post<FacilityResponse<FacilitySpace>>(`${this.base}/spaces`, payload);
  }

  updateSpace(id: string, payload: FacilitySpaceRequest): Observable<FacilityResponse<FacilitySpace>> {
    return this.http.put<FacilityResponse<FacilitySpace>>(`${this.base}/spaces/${id}`, payload);
  }

  deleteSpace(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/spaces/${id}`);
  }

  // Bookings
  getBookingRules(): Observable<FacilityResponse<FacilityBookingRuleEffective[]>> {
    return this.http.get<FacilityResponse<FacilityBookingRuleEffective[]>>(`${this.base}/booking-rules`);
  }

  saveBookingRule(kind: FacilityBookableKind, payload: FacilityBookingRuleRequest): Observable<FacilityResponse<FacilityBookingRuleEffective>> {
    return this.http.put<FacilityResponse<FacilityBookingRuleEffective>>(`${this.base}/booking-rules/${kind}`, payload);
  }

  getBookings(filters?: { from?: string; to?: string; space_id?: string; building_id?: string; member_id?: string; status?: string; mine?: boolean; active?: boolean; per_page?: number }): Observable<FacilityResponse<FacilityBooking[]>> {
    return this.http.get<FacilityResponse<FacilityBooking[]>>(`${this.base}/bookings`, { params: toParams(filters) });
  }

  checkBooking(payload: FacilityBookingCheckRequest): Observable<FacilityResponse<FacilityBookingCheckResult>> {
    return this.http.post<FacilityResponse<FacilityBookingCheckResult>>(`${this.base}/bookings/check`, payload);
  }

  createBooking(payload: FacilityBookingRequest): Observable<FacilityResponse<FacilityBooking>> {
    return this.http.post<FacilityResponse<FacilityBooking>>(`${this.base}/bookings`, payload);
  }

  checkInBooking(id: string): Observable<FacilityResponse<FacilityBooking>> {
    return this.http.post<FacilityResponse<FacilityBooking>>(`${this.base}/bookings/${id}/check-in`, {});
  }

  cancelBooking(id: string, reason?: string | null): Observable<FacilityResponse<FacilityBooking>> {
    return this.http.post<FacilityResponse<FacilityBooking>>(`${this.base}/bookings/${id}/cancel`, { reason: reason ?? null });
  }

  createBookingSeries(payload: FacilityBookingSeriesRequest): Observable<FacilityResponse<FacilityBookingSeriesResult>> {
    return this.http.post<FacilityResponse<FacilityBookingSeriesResult>>(`${this.base}/booking-series`, payload);
  }

  cancelBookingSeries(id: string, reason?: string | null): Observable<FacilityResponse<{ id: string; status: string; cancelled_bookings: number }>> {
    return this.http.post<FacilityResponse<{ id: string; status: string; cancelled_bookings: number }>>(`${this.base}/booking-series/${id}/cancel`, { reason: reason ?? null });
  }

  // Service requests
  getServiceRequests(filters?: { status?: string; category?: string; priority?: string; assignee_id?: string; building_id?: string; mine?: boolean; open?: boolean; overdue?: boolean; q?: string; per_page?: number }): Observable<FacilityResponse<FacilityServiceRequest[]>> {
    return this.http.get<FacilityResponse<FacilityServiceRequest[]>>(`${this.base}/service-requests`, { params: toParams(filters) });
  }

  getServiceRequestBoard(): Observable<FacilityResponse<FacilityServiceRequestBoard>> {
    return this.http.get<FacilityResponse<FacilityServiceRequestBoard>>(`${this.base}/service-requests/board`);
  }

  createServiceRequest(payload: FacilityServiceRequestRequest): Observable<FacilityResponse<FacilityServiceRequest>> {
    return this.http.post<FacilityResponse<FacilityServiceRequest>>(`${this.base}/service-requests`, payload);
  }

  /** A status action of a request: assign, start, hold, resolve, close, reopen, cancel, link-work-order or raise-work-order. */
  actOnServiceRequest(id: string, action: 'assign' | 'start' | 'hold' | 'resolve' | 'close' | 'reopen' | 'cancel' | 'link-work-order' | 'raise-work-order', payload: Record<string, unknown> = {}): Observable<FacilityResponse<FacilityServiceRequest>> {
    return this.http.post<FacilityResponse<FacilityServiceRequest>>(`${this.base}/service-requests/${id}/${action}`, payload);
  }

  getRequestComments(id: string): Observable<FacilityResponse<FacilityRequestComment[]>> {
    return this.http.get<FacilityResponse<FacilityRequestComment[]>>(`${this.base}/service-requests/${id}/comments`);
  }

  addRequestComment(id: string, payload: FacilityRequestCommentRequest): Observable<FacilityResponse<FacilityRequestComment>> {
    return this.http.post<FacilityResponse<FacilityRequestComment>>(`${this.base}/service-requests/${id}/comments`, payload);
  }

  // Inspections
  getInspectionTemplates(filters?: { active?: boolean; per_page?: number }): Observable<FacilityResponse<FacilityInspectionTemplate[]>> {
    return this.http.get<FacilityResponse<FacilityInspectionTemplate[]>>(`${this.base}/inspection-templates`, { params: toParams(filters) });
  }

  createInspectionTemplate(payload: FacilityInspectionTemplateRequest): Observable<FacilityResponse<FacilityInspectionTemplate>> {
    return this.http.post<FacilityResponse<FacilityInspectionTemplate>>(`${this.base}/inspection-templates`, payload);
  }

  updateInspectionTemplate(id: string, payload: FacilityInspectionTemplateRequest): Observable<FacilityResponse<FacilityInspectionTemplate>> {
    return this.http.put<FacilityResponse<FacilityInspectionTemplate>>(`${this.base}/inspection-templates/${id}`, payload);
  }

  deleteInspectionTemplate(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/inspection-templates/${id}`);
  }

  generateInspections(payload: { as_of?: string | null; template_id?: string | null } = {}): Observable<FacilityResponse<FacilityInspection[]>> {
    return this.http.post<FacilityResponse<FacilityInspection[]>>(`${this.base}/inspection-templates/generate`, payload);
  }

  getInspections(filters?: { status?: string; assignee_id?: string; building_id?: string; template_id?: string; from?: string; to?: string; mine?: boolean; open?: boolean; overdue?: boolean; per_page?: number }): Observable<FacilityResponse<FacilityInspection[]>> {
    return this.http.get<FacilityResponse<FacilityInspection[]>>(`${this.base}/inspections`, { params: toParams(filters) });
  }

  startInspection(id: string): Observable<FacilityResponse<FacilityInspection>> {
    return this.http.post<FacilityResponse<FacilityInspection>>(`${this.base}/inspections/${id}/start`, {});
  }

  completeInspection(id: string, payload: FacilityCompleteInspectionRequest): Observable<FacilityResponse<FacilityInspection>> {
    return this.http.post<FacilityResponse<FacilityInspection>>(`${this.base}/inspections/${id}/complete`, payload);
  }

  cancelInspection(id: string, reason: string): Observable<FacilityResponse<FacilityInspection>> {
    return this.http.post<FacilityResponse<FacilityInspection>>(`${this.base}/inspections/${id}/cancel`, { reason });
  }

  // Meters
  getMeters(filters?: { building_id?: string; kind?: string; active?: boolean; per_page?: number }): Observable<FacilityResponse<FacilityMeter[]>> {
    return this.http.get<FacilityResponse<FacilityMeter[]>>(`${this.base}/meters`, { params: toParams(filters) });
  }

  createMeter(payload: FacilityMeterRequest): Observable<FacilityResponse<FacilityMeter>> {
    return this.http.post<FacilityResponse<FacilityMeter>>(`${this.base}/meters`, payload);
  }

  updateMeter(id: string, payload: FacilityMeterRequest): Observable<FacilityResponse<FacilityMeter>> {
    return this.http.put<FacilityResponse<FacilityMeter>>(`${this.base}/meters/${id}`, payload);
  }

  deleteMeter(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/meters/${id}`);
  }

  getMeterReadings(id: string, filters?: { from?: string; to?: string; per_page?: number }): Observable<FacilityResponse<FacilityMeterReading[]>> {
    return this.http.get<FacilityResponse<FacilityMeterReading[]>>(`${this.base}/meters/${id}/readings`, { params: toParams(filters) });
  }

  recordMeterReading(id: string, payload: FacilityMeterReadingRequest): Observable<FacilityResponse<FacilityMeterReading>> {
    return this.http.post<FacilityResponse<FacilityMeterReading>>(`${this.base}/meters/${id}/readings`, payload);
  }

  deleteMeterReading(id: string, readingId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/meters/${id}/readings/${readingId}`);
  }

  getMeterSummary(filters: { year: number; building_id?: string; kind?: string }): Observable<FacilityResponse<FacilityMeterSummary>> {
    return this.http.get<FacilityResponse<FacilityMeterSummary>>(`${this.base}/meters/summary`, { params: toParams(filters) });
  }
}
