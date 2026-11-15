import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import {
  AbsenteeismAnalytics,
  ApiResponse,
  EmployeeGoalProgress,
  ExitInterviewPayload,
  ExitInterviewRecord,
  ExitReasonOption,
  GoalCheckInPayload,
  GoalCheckInRecord,
  GoalCyclePayload,
  GoalCycleRecord,
  GoalKeyResultPayload,
  GoalKeyResultRecord,
  GoalPayload,
  GoalRecord,
  HeadcountAnalytics,
  HrAnalyticsQuery,
  OffboardingChecklistRecord,
  OffboardingTaskRecord,
  OffboardingTemplatePayload,
  OffboardingTemplateRecord,
  PaginatedResponse,
  PositionsAnalytics,
  QueryFilterParams,
  StartOffboardingPayload,
  TeamRecord,
  TenureAnalytics,
  TurnoverAnalytics,
  UpcomingExpiriesAnalytics,
} from '../models';
import { toHttpParams } from '../http/laravel-http.utils';

/** Goals and OKR, offboarding with exit interviews, and workforce analytics. */
@Service()
export class HrWorkforceApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/hr`;

  private list<T>(path: string, params?: QueryFilterParams): Observable<PaginatedResponse<T>> {
    return this.http.get<PaginatedResponse<T>>(`${this.base}/${path}`, { params: params ? toHttpParams(params) : undefined });
  }

  // --- Goals and OKR ---

  getGoalCycles(params?: QueryFilterParams): Observable<PaginatedResponse<GoalCycleRecord>> {
    return this.list('goal-cycles', params);
  }

  createGoalCycle(payload: GoalCyclePayload): Observable<ApiResponse<GoalCycleRecord>> {
    return this.http.post<ApiResponse<GoalCycleRecord>>(`${this.base}/goal-cycles`, payload);
  }

  updateGoalCycle(id: string, payload: GoalCyclePayload): Observable<ApiResponse<GoalCycleRecord>> {
    return this.http.put<ApiResponse<GoalCycleRecord>>(`${this.base}/goal-cycles/${id}`, payload);
  }

  closeGoalCycle(id: string): Observable<ApiResponse<GoalCycleRecord>> {
    return this.http.post<ApiResponse<GoalCycleRecord>>(`${this.base}/goal-cycles/${id}/close`, {});
  }

  getTeams(): Observable<PaginatedResponse<TeamRecord>> {
    return this.list('teams');
  }

  getGoals(params?: QueryFilterParams): Observable<PaginatedResponse<GoalRecord>> {
    return this.list('goals', params);
  }

  getGoal(id: string): Observable<ApiResponse<GoalRecord>> {
    return this.http.get<ApiResponse<GoalRecord>>(`${this.base}/goals/${id}`);
  }

  createGoal(payload: GoalPayload): Observable<ApiResponse<GoalRecord>> {
    return this.http.post<ApiResponse<GoalRecord>>(`${this.base}/goals`, payload);
  }

  updateGoal(id: string, payload: GoalPayload): Observable<ApiResponse<GoalRecord>> {
    return this.http.put<ApiResponse<GoalRecord>>(`${this.base}/goals/${id}`, payload);
  }

  deleteGoal(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/goals/${id}`);
  }

  addKeyResult(goalId: string, payload: GoalKeyResultPayload): Observable<ApiResponse<GoalKeyResultRecord>> {
    return this.http.post<ApiResponse<GoalKeyResultRecord>>(`${this.base}/goals/${goalId}/key-results`, payload);
  }

  updateKeyResult(id: string, payload: GoalKeyResultPayload): Observable<ApiResponse<GoalKeyResultRecord>> {
    return this.http.put<ApiResponse<GoalKeyResultRecord>>(`${this.base}/goal-key-results/${id}`, payload);
  }

  deleteKeyResult(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/goal-key-results/${id}`);
  }

  getGoalCheckIns(goalId: string): Observable<PaginatedResponse<GoalCheckInRecord>> {
    return this.list(`goals/${goalId}/check-ins`);
  }

  checkInGoal(goalId: string, payload: GoalCheckInPayload): Observable<ApiResponse<GoalCheckInRecord>> {
    return this.http.post<ApiResponse<GoalCheckInRecord>>(`${this.base}/goals/${goalId}/check-ins`, payload);
  }

  getEmployeeGoalProgress(employeeId: string, goalCycleId?: string): Observable<ApiResponse<EmployeeGoalProgress>> {
    return this.http.get<ApiResponse<EmployeeGoalProgress>>(`${this.base}/employees/${employeeId}/goal-progress`, {
      params: goalCycleId ? toHttpParams({ goal_cycle_id: goalCycleId }) : undefined,
    });
  }

  // --- Offboarding ---

  getOffboardingTemplates(params?: QueryFilterParams): Observable<PaginatedResponse<OffboardingTemplateRecord>> {
    return this.list('offboarding-templates', params);
  }

  createOffboardingTemplate(payload: OffboardingTemplatePayload): Observable<ApiResponse<OffboardingTemplateRecord>> {
    return this.http.post<ApiResponse<OffboardingTemplateRecord>>(`${this.base}/offboarding-templates`, payload);
  }

  updateOffboardingTemplate(id: string, payload: OffboardingTemplatePayload): Observable<ApiResponse<OffboardingTemplateRecord>> {
    return this.http.put<ApiResponse<OffboardingTemplateRecord>>(`${this.base}/offboarding-templates/${id}`, payload);
  }

  deleteOffboardingTemplate(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/offboarding-templates/${id}`);
  }

  getOffboardingChecklists(params?: QueryFilterParams): Observable<PaginatedResponse<OffboardingChecklistRecord>> {
    return this.list('offboarding-checklists', params);
  }

  getOffboardingChecklist(id: string): Observable<ApiResponse<OffboardingChecklistRecord>> {
    return this.http.get<ApiResponse<OffboardingChecklistRecord>>(`${this.base}/offboarding-checklists/${id}`);
  }

  startOffboarding(payload: StartOffboardingPayload): Observable<ApiResponse<OffboardingChecklistRecord>> {
    return this.http.post<ApiResponse<OffboardingChecklistRecord>>(`${this.base}/offboarding-checklists`, payload);
  }

  completeOffboardingTask(id: string): Observable<ApiResponse<OffboardingTaskRecord>> {
    return this.http.post<ApiResponse<OffboardingTaskRecord>>(`${this.base}/offboarding-tasks/${id}/complete`, {});
  }

  getExitReasonCodes(): Observable<ApiResponse<ExitReasonOption[]>> {
    return this.http.get<ApiResponse<ExitReasonOption[]>>(`${this.base}/exit-reason-codes`);
  }

  getExitInterviews(params?: QueryFilterParams): Observable<PaginatedResponse<ExitInterviewRecord>> {
    return this.list('exit-interviews', params);
  }

  recordExitInterview(payload: ExitInterviewPayload): Observable<ApiResponse<ExitInterviewRecord>> {
    return this.http.post<ApiResponse<ExitInterviewRecord>>(`${this.base}/exit-interviews`, payload);
  }

  // --- Analytics ---

  private analytics<T>(report: string, query?: HrAnalyticsQuery): Observable<ApiResponse<T>> {
    return this.http.get<ApiResponse<T>>(`${this.base}/analytics/${report}`, { params: query ? toHttpParams({ ...query }) : undefined });
  }

  getHeadcountAnalytics(query?: HrAnalyticsQuery): Observable<ApiResponse<HeadcountAnalytics>> {
    return this.analytics('headcount', query);
  }

  getTurnoverAnalytics(query?: HrAnalyticsQuery): Observable<ApiResponse<TurnoverAnalytics>> {
    return this.analytics('turnover', query);
  }

  getTenureAnalytics(query?: HrAnalyticsQuery): Observable<ApiResponse<TenureAnalytics>> {
    return this.analytics('tenure', query);
  }

  getAbsenteeismAnalytics(query?: HrAnalyticsQuery): Observable<ApiResponse<AbsenteeismAnalytics>> {
    return this.analytics('absenteeism', query);
  }

  getPositionsAnalytics(query?: HrAnalyticsQuery): Observable<ApiResponse<PositionsAnalytics>> {
    return this.analytics('positions', query);
  }

  getUpcomingExpiries(query?: HrAnalyticsQuery): Observable<ApiResponse<UpcomingExpiriesAnalytics>> {
    return this.analytics('upcoming-expiries', query);
  }
}
