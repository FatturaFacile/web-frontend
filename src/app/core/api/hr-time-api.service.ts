import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import {
  ApiResponse,
  CreateTimeEventPayload,
  DailyTimeRecordPayload,
  OvertimeRulePayload,
  OvertimeRuleResource,
  OvertimeSummary,
  PaginatedResponse,
  TimeAuditEntry,
  TimeClosingResource,
  TimeEventFilterParams,
  TimeEventResource,
  TimeProfilePayload,
  TimeProfileResource,
  TimeReport,
  TimeReportParams,
  UpdateTimeEventPayload,
} from '../models';
import { toHttpParams } from '../http/laravel-http.utils';

/**
 * Time tracking under `/hr/time/*`. Successor of the deprecated `/time-attendance/*`.
 * A closed month blocks edits with 409.
 */
@Service()
export class HrTimeApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/hr`;

  getEvents(params?: TimeEventFilterParams): Observable<PaginatedResponse<TimeEventResource>> {
    return this.http.get<PaginatedResponse<TimeEventResource>>(`${this.base}/time/events`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  createEvent(payload: CreateTimeEventPayload): Observable<ApiResponse<TimeEventResource>> {
    return this.http.post<ApiResponse<TimeEventResource>>(`${this.base}/time/events`, payload);
  }

  updateEvent(id: string, payload: UpdateTimeEventPayload): Observable<ApiResponse<TimeEventResource>> {
    return this.http.patch<ApiResponse<TimeEventResource>>(`${this.base}/time/events/${id}`, payload);
  }

  deleteEvent(id: string, reason: string): Observable<ApiResponse<TimeEventResource>> {
    return this.http.delete<ApiResponse<TimeEventResource>>(`${this.base}/time/events/${id}`, {
      params: toHttpParams({ reason }),
    });
  }

  saveDailyRecord(payload: DailyTimeRecordPayload): Observable<ApiResponse<unknown>> {
    return this.http.put<ApiResponse<unknown>>(`${this.base}/time/daily-records`, payload);
  }

  getReport(params: TimeReportParams): Observable<ApiResponse<TimeReport>> {
    return this.http.get<ApiResponse<TimeReport>>(`${this.base}/time/report`, { params: toHttpParams(params) });
  }

  getAudit(params?: TimeEventFilterParams): Observable<PaginatedResponse<TimeAuditEntry>> {
    return this.http.get<PaginatedResponse<TimeAuditEntry>>(`${this.base}/time/audit`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  getHolidays(params?: { canton?: string; year?: number }): Observable<ApiResponse<unknown[]>> {
    return this.http.get<ApiResponse<unknown[]>>(`${this.base}/time/holidays`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  getProfile(userId: string): Observable<ApiResponse<TimeProfileResource>> {
    return this.http.get<ApiResponse<TimeProfileResource>>(`${this.base}/time/profiles/${userId}`);
  }

  saveProfile(userId: string, payload: TimeProfilePayload): Observable<ApiResponse<TimeProfileResource>> {
    return this.http.put<ApiResponse<TimeProfileResource>>(`${this.base}/time/profiles/${userId}`, payload);
  }

  getOvertime(
    params: TimeReportParams & { department_id?: string; user_id?: string },
  ): Observable<ApiResponse<OvertimeSummary>> {
    return this.http.get<ApiResponse<OvertimeSummary>>(`${this.base}/time/overtime`, { params: toHttpParams(params) });
  }

  // --- Overtime rules ---

  getOvertimeRules(): Observable<ApiResponse<OvertimeRuleResource[]>> {
    return this.http.get<ApiResponse<OvertimeRuleResource[]>>(`${this.base}/overtime-rules`);
  }

  createOvertimeRule(payload: OvertimeRulePayload): Observable<ApiResponse<OvertimeRuleResource>> {
    return this.http.post<ApiResponse<OvertimeRuleResource>>(`${this.base}/overtime-rules`, payload);
  }

  updateOvertimeRule(id: string, payload: OvertimeRulePayload): Observable<ApiResponse<OvertimeRuleResource>> {
    return this.http.put<ApiResponse<OvertimeRuleResource>>(`${this.base}/overtime-rules/${id}`, payload);
  }

  deleteOvertimeRule(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/overtime-rules/${id}`);
  }

  // --- Monthly closings ---

  getTimeClosings(year?: number): Observable<ApiResponse<TimeClosingResource[]>> {
    return this.http.get<ApiResponse<TimeClosingResource[]>>(`${this.base}/time-closings`, {
      params: toHttpParams({ year }),
    });
  }

  closeMonth(year: number, month: number): Observable<ApiResponse<TimeClosingResource>> {
    return this.http.post<ApiResponse<TimeClosingResource>>(`${this.base}/time-closings`, { year, month });
  }

  reopenMonth(id: string, reason: string): Observable<ApiResponse<TimeClosingResource>> {
    return this.http.post<ApiResponse<TimeClosingResource>>(`${this.base}/time-closings/${id}/reopen`, { reason });
  }
}
