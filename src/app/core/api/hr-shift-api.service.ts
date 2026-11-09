import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import {
  AbsencePlanEntry,
  ApiResponse,
  PlaceShiftPayload,
  PlannedShift,
  ShiftBoard,
  ShiftExceptionPayload,
  ShiftPeriodParams,
  ShiftPeriodPayload,
  ShiftSequenceAssignmentPayload,
  ShiftSequencePayload,
  ShiftSequenceRecord,
  ShiftTypePayload,
  ShiftTypeRecord,
  StaffingNeedPayload,
} from '../models';
import { toHttpParams } from '../http/laravel-http.utils';

/** Shift planning: shift types, rotation sequences, staffing needs, the board and published shifts. */
@Service()
export class HrShiftApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/hr`;

  getShiftTypes(): Observable<ApiResponse<ShiftTypeRecord[]>> {
    return this.http.get<ApiResponse<ShiftTypeRecord[]>>(`${this.base}/shift-types`);
  }

  createShiftType(payload: ShiftTypePayload): Observable<ApiResponse<ShiftTypeRecord>> {
    return this.http.post<ApiResponse<ShiftTypeRecord>>(`${this.base}/shift-types`, payload);
  }

  updateShiftType(id: string, payload: ShiftTypePayload): Observable<ApiResponse<ShiftTypeRecord>> {
    return this.http.put<ApiResponse<ShiftTypeRecord>>(`${this.base}/shift-types/${id}`, payload);
  }

  getShiftSequences(): Observable<ApiResponse<ShiftSequenceRecord[]>> {
    return this.http.get<ApiResponse<ShiftSequenceRecord[]>>(`${this.base}/shift-sequences`);
  }

  createShiftSequence(payload: ShiftSequencePayload): Observable<ApiResponse<ShiftSequenceRecord>> {
    return this.http.post<ApiResponse<ShiftSequenceRecord>>(`${this.base}/shift-sequences`, payload);
  }

  assignShiftSequence(payload: ShiftSequenceAssignmentPayload): Observable<ApiResponse<Record<string, unknown>>> {
    return this.http.post<ApiResponse<Record<string, unknown>>>(`${this.base}/shift-sequences/assignments`, payload);
  }

  addShiftException(payload: ShiftExceptionPayload): Observable<ApiResponse<Record<string, unknown>>> {
    return this.http.post<ApiResponse<Record<string, unknown>>>(`${this.base}/shift-exceptions`, payload);
  }

  setStaffingNeed(payload: StaffingNeedPayload): Observable<ApiResponse<Record<string, unknown>>> {
    return this.http.post<ApiResponse<Record<string, unknown>>>(`${this.base}/staffing-needs`, payload);
  }

  getBoard(params: ShiftPeriodParams): Observable<ApiResponse<ShiftBoard>> {
    return this.http.get<ApiResponse<ShiftBoard>>(`${this.base}/shifts/board`, { params: toHttpParams(params) });
  }

  generateShifts(payload: ShiftPeriodPayload): Observable<ApiResponse<{ created: number }>> {
    return this.http.post<ApiResponse<{ created: number }>>(`${this.base}/shifts/generate`, payload);
  }

  publishShifts(payload: ShiftPeriodPayload): Observable<ApiResponse<Record<string, unknown>>> {
    return this.http.post<ApiResponse<Record<string, unknown>>>(`${this.base}/shifts/publish`, payload);
  }

  placeShift(payload: PlaceShiftPayload): Observable<ApiResponse<Record<string, unknown>>> {
    return this.http.post<ApiResponse<Record<string, unknown>>>(`${this.base}/shifts`, payload);
  }

  moveShift(id: string, payload: PlaceShiftPayload): Observable<ApiResponse<Record<string, unknown>>> {
    return this.http.put<ApiResponse<Record<string, unknown>>>(`${this.base}/shifts/${id}`, payload);
  }

  deleteShift(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/shifts/${id}`);
  }

  getAbsencePlan(params: ShiftPeriodParams): Observable<ApiResponse<AbsencePlanEntry[]>> {
    return this.http.get<ApiResponse<AbsencePlanEntry[]>>(`${this.base}/absence-plan`, { params: toHttpParams(params) });
  }

  getMyShifts(params: ShiftPeriodParams): Observable<ApiResponse<PlannedShift[]>> {
    return this.http.get<ApiResponse<PlannedShift[]>>(`${this.base}/time/my-shifts`, { params: toHttpParams(params) });
  }
}
