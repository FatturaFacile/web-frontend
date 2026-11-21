import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { toHttpParams } from '../http/laravel-http.utils';
import { ApiResponse, PaginatedResponse, QueryFilterParams } from '../models/api.models';
import {
  CalculateRoutingPayload,
  MfgCalendarPreviewDay,
  MfgMachineDetail,
  MfgOeeQuery,
  MfgOeeResult,
  MfgRoutingDetail,
  MfgRoutingSimulation,
  MfgWorkCenterDetail,
  MfgWorkingCalendarDetail,
  SaveMachinePayload,
  SaveRoutingPayload,
  SaveWorkCenterPayload,
  SaveWorkingCalendarPayload,
} from '../models/manufacturing-production.model';

/** Production engineering API (Mod 061): work centres, machines, working calendars, routings and OEE. */
@Service()
export class ManufacturingProductionApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/manufacturing`;

  // --- Work centres ---
  listWorkCenters(params?: QueryFilterParams): Observable<PaginatedResponse<MfgWorkCenterDetail>> {
    return this.http.get<PaginatedResponse<MfgWorkCenterDetail>>(`${this.base}/work-centers`, { params: toHttpParams(params ?? {}) });
  }

  createWorkCenter(payload: SaveWorkCenterPayload): Observable<ApiResponse<MfgWorkCenterDetail>> {
    return this.http.post<ApiResponse<MfgWorkCenterDetail>>(`${this.base}/work-centers`, payload);
  }

  updateWorkCenter(id: string, payload: SaveWorkCenterPayload): Observable<ApiResponse<MfgWorkCenterDetail>> {
    return this.http.put<ApiResponse<MfgWorkCenterDetail>>(`${this.base}/work-centers/${id}`, payload);
  }

  deleteWorkCenter(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/work-centers/${id}`);
  }

  // --- Machines ---
  listMachines(params?: QueryFilterParams & { work_center_id?: string; status?: string }): Observable<PaginatedResponse<MfgMachineDetail>> {
    return this.http.get<PaginatedResponse<MfgMachineDetail>>(`${this.base}/machines`, { params: toHttpParams(params ?? {}) });
  }

  createMachine(payload: SaveMachinePayload): Observable<ApiResponse<MfgMachineDetail>> {
    return this.http.post<ApiResponse<MfgMachineDetail>>(`${this.base}/machines`, payload);
  }

  updateMachine(id: string, payload: SaveMachinePayload): Observable<ApiResponse<MfgMachineDetail>> {
    return this.http.put<ApiResponse<MfgMachineDetail>>(`${this.base}/machines/${id}`, payload);
  }

  deleteMachine(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/machines/${id}`);
  }

  // --- Working calendars ---
  listWorkingCalendars(params?: QueryFilterParams): Observable<PaginatedResponse<MfgWorkingCalendarDetail>> {
    return this.http.get<PaginatedResponse<MfgWorkingCalendarDetail>>(`${this.base}/working-calendars`, { params: toHttpParams(params ?? {}) });
  }

  getWorkingCalendar(id: string): Observable<ApiResponse<MfgWorkingCalendarDetail>> {
    return this.http.get<ApiResponse<MfgWorkingCalendarDetail>>(`${this.base}/working-calendars/${id}`);
  }

  createWorkingCalendar(payload: SaveWorkingCalendarPayload): Observable<ApiResponse<MfgWorkingCalendarDetail>> {
    return this.http.post<ApiResponse<MfgWorkingCalendarDetail>>(`${this.base}/working-calendars`, payload);
  }

  updateWorkingCalendar(id: string, payload: SaveWorkingCalendarPayload): Observable<ApiResponse<MfgWorkingCalendarDetail>> {
    return this.http.put<ApiResponse<MfgWorkingCalendarDetail>>(`${this.base}/working-calendars/${id}`, payload);
  }

  deleteWorkingCalendar(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/working-calendars/${id}`);
  }

  previewCalendarDays(id: string, from: string, to: string): Observable<ApiResponse<MfgCalendarPreviewDay[]>> {
    return this.http.get<ApiResponse<MfgCalendarPreviewDay[]>>(`${this.base}/working-calendars/${id}/preview-days`, {
      params: toHttpParams({ from, to }),
    });
  }

  // --- Routings ---
  listRoutings(params?: QueryFilterParams & { mfg_item_id?: string }): Observable<PaginatedResponse<MfgRoutingDetail>> {
    return this.http.get<PaginatedResponse<MfgRoutingDetail>>(`${this.base}/routings`, { params: toHttpParams(params ?? {}) });
  }

  getRouting(id: string): Observable<ApiResponse<MfgRoutingDetail>> {
    return this.http.get<ApiResponse<MfgRoutingDetail>>(`${this.base}/routings/${id}`);
  }

  createRouting(payload: SaveRoutingPayload): Observable<ApiResponse<MfgRoutingDetail>> {
    return this.http.post<ApiResponse<MfgRoutingDetail>>(`${this.base}/routings`, payload);
  }

  updateRouting(id: string, payload: SaveRoutingPayload): Observable<ApiResponse<MfgRoutingDetail>> {
    return this.http.put<ApiResponse<MfgRoutingDetail>>(`${this.base}/routings/${id}`, payload);
  }

  cloneRoutingRevision(id: string, revision?: string): Observable<ApiResponse<MfgRoutingDetail>> {
    return this.http.post<ApiResponse<MfgRoutingDetail>>(`${this.base}/routings/${id}/clone-revision`, revision ? { revision } : {});
  }

  calculateRouting(id: string, payload: CalculateRoutingPayload): Observable<ApiResponse<MfgRoutingSimulation>> {
    return this.http.post<ApiResponse<MfgRoutingSimulation>>(`${this.base}/routings/${id}/calculate-lead-time-and-cost`, payload);
  }

  // --- OEE ---
  oeeSummary(query: MfgOeeQuery): Observable<ApiResponse<MfgOeeResult>> {
    return this.http.get<ApiResponse<MfgOeeResult>>(`${this.base}/oee/summary`, { params: toHttpParams(query) });
  }

  oeeTimeseries(query: MfgOeeQuery): Observable<ApiResponse<MfgOeeResult>> {
    return this.http.get<ApiResponse<MfgOeeResult>>(`${this.base}/oee/timeseries`, { params: toHttpParams(query) });
  }
}
