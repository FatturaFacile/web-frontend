import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import {
  ApiResponse,
  CreateTimeEventPayload,
  DailyTimeRecordPayload,
  MealBookingPayload,
  MealBookingQuery,
  NightWorkBalance,
  OvertimeRulePayload,
  OvertimeRuleResource,
  OvertimeSummary,
  PaginatedResponse,
  PunchImportPayload,
  PunchImportResult,
  QueryFilterParams,
  ScheduleGroupMemberPayload,
  ScheduleGroupPayload,
  ScheduleGroupRecord,
  ScheduleGroupRulesPayload,
  TimeAuditEntry,
  TimeBadgePayload,
  TimeClosingResource,
  TimeEventFilterParams,
  TimeEventResource,
  TimePayrollView,
  TimePresenceRow,
  TimeProfilePayload,
  TimeProfileResource,
  TimeReport,
  TimeReportParams,
  TimeTransferResult,
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

  getOvertimeRules(params?: QueryFilterParams): Observable<PaginatedResponse<OvertimeRuleResource>> {
    return this.http.get<PaginatedResponse<OvertimeRuleResource>>(`${this.base}/overtime-rules`, {
      params: params ? toHttpParams(params) : undefined,
    });
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

  getTimeClosings(year?: number, params?: QueryFilterParams): Observable<PaginatedResponse<TimeClosingResource>> {
    return this.http.get<PaginatedResponse<TimeClosingResource>>(`${this.base}/time-closings`, {
      params: toHttpParams({ ...params, year }),
    });
  }

  closeMonth(year: number, month: number): Observable<ApiResponse<TimeClosingResource>> {
    return this.http.post<ApiResponse<TimeClosingResource>>(`${this.base}/time-closings`, { year, month });
  }

  reopenMonth(id: string, reason: string): Observable<ApiResponse<TimeClosingResource>> {
    return this.http.post<ApiResponse<TimeClosingResource>>(`${this.base}/time-closings/${id}/reopen`, { reason });
  }

  /** Transfers a closed (or approved) period to the payroll variable inputs. */
  transferToPayroll(year: number, month: number): Observable<ApiResponse<TimeTransferResult>> {
    return this.http.post<ApiResponse<TimeTransferResult>>(`${this.base}/time-closings/${year}/${month}/transfer-to-payroll`, {});
  }

  // --- Schedule groups and badges ---

  getScheduleGroups(params?: QueryFilterParams): Observable<PaginatedResponse<ScheduleGroupRecord>> {
    return this.http.get<PaginatedResponse<ScheduleGroupRecord>>(`${this.base}/schedule-groups`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  createScheduleGroup(payload: ScheduleGroupPayload): Observable<ApiResponse<ScheduleGroupRecord>> {
    return this.http.post<ApiResponse<ScheduleGroupRecord>>(`${this.base}/schedule-groups`, payload);
  }

  /** Adds a version of the rules (rounding, tolerances, allowances) valid from a date. */
  addScheduleGroupRules(id: string, payload: ScheduleGroupRulesPayload): Observable<ApiResponse<Record<string, unknown>>> {
    return this.http.post<ApiResponse<Record<string, unknown>>>(`${this.base}/schedule-groups/${id}/rules`, payload);
  }

  addScheduleGroupMember(id: string, payload: ScheduleGroupMemberPayload): Observable<ApiResponse<Record<string, unknown>>> {
    return this.http.post<ApiResponse<Record<string, unknown>>>(`${this.base}/schedule-groups/${id}/members`, payload);
  }

  registerBadge(payload: TimeBadgePayload): Observable<ApiResponse<Record<string, unknown>>> {
    return this.http.post<ApiResponse<Record<string, unknown>>>(`${this.base}/time-badges`, payload);
  }

  // --- Presence, payroll view, punches, meals, night work ---

  getPresence(): Observable<ApiResponse<TimePresenceRow[]>> {
    return this.http.get<ApiResponse<TimePresenceRow[]>>(`${this.base}/time/presence`);
  }

  getPayrollView(params: { employee_id?: string | null; from: string; to: string }): Observable<ApiResponse<TimePayrollView>> {
    return this.http.get<ApiResponse<TimePayrollView>>(`${this.base}/time/payroll-view`, { params: toHttpParams(params) });
  }

  importPunches(payload: PunchImportPayload): Observable<ApiResponse<PunchImportResult>> {
    return this.http.post<ApiResponse<PunchImportResult>>(`${this.base}/time/punches/import`, payload);
  }

  getMealBookings(params: MealBookingQuery & QueryFilterParams): Observable<PaginatedResponse<Record<string, unknown>>> {
    return this.http.get<PaginatedResponse<Record<string, unknown>>>(`${this.base}/time/meal-bookings`, { params: toHttpParams(params) });
  }

  bookMeal(payload: MealBookingPayload): Observable<ApiResponse<Record<string, unknown>>> {
    return this.http.post<ApiResponse<Record<string, unknown>>>(`${this.base}/time/meal-bookings`, payload);
  }

  /** With `user_id` the balance of that user is first re-evaluated (the call writes the row). */
  getNightWorkBalances(params?: { year?: number; user_id?: string }): Observable<ApiResponse<NightWorkBalance[]>> {
    return this.http.get<ApiResponse<NightWorkBalance[]>>(`${this.base}/time/night-work-balances`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }
}
