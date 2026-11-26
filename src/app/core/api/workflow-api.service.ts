import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { map, Observable } from 'rxjs';
import {
  ApiResponse,
  PaginatedResponse,
  QueryFilterParams,
  WorkflowAuditEntryResource,
  WorkflowApprovalMatrix,
  WorkflowAuditVerification,
  WorkflowBusinessCalendar,
  WorkflowCreateHolidayRequest,
  WorkflowHoliday,
  WorkflowPendingCount,
  WorkflowRemoteApprovalPreview,
  WorkflowRemoteApprovalConfirm,
  WorkflowRemoteApprovalResult,
  WorkflowSaveCalendarRequest,
  WorkflowSaveMatrixRequest,
  WorkflowSeedHolidaysRequest,
  WorkflowSimulateRequest,
  WorkflowSimulationResult,
  WorkflowSubjectType,
  WorkflowTimelineEntry,
  WorkflowCreateDelegationRequest,
  WorkflowDefinitionParams,
  WorkflowDefinitionResource,
  WorkflowDelegationModel,
  WorkflowEscalationRule,
  WorkflowHistoryEntry,
  WorkflowInstanceParams,
  WorkflowInstanceResource,
  WorkflowNodeResource,
  WorkflowRecordDecisionRequest,
  WorkflowSaveDefinitionRequest,
  WorkflowSaveEscalationRuleRequest,
  WorkflowSaveNodeRequest,
  WorkflowSaveTransitionRequest,
  WorkflowSlaReport,
  WorkflowStartWorkflowRequest,
  WorkflowTask,
  WorkflowTaskParams,
  WorkflowTransitionResource,
} from '../models';
import { toHttpParams } from '../http/laravel-http.utils';

@Service()
export class WorkflowApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  // --- INBOX & TASKS ---
  getMyTasks(params?: WorkflowTaskParams): Observable<PaginatedResponse<WorkflowTask>> {
    return this.http.get<PaginatedResponse<WorkflowTask>>(`${this.base}/workflows/my-tasks`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  getMyPending(params?: WorkflowTaskParams): Observable<ApiResponse<WorkflowTask[]>> {
    return this.http.get<ApiResponse<WorkflowTask[]>>(`${this.base}/workflows/my-pending`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  getMyHistory(params?: { page?: number; per_page?: number }): Observable<PaginatedResponse<WorkflowHistoryEntry>> {
    return this.http.get<PaginatedResponse<WorkflowHistoryEntry>>(`${this.base}/workflows/my-history`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  getMyRequests(params?: { page?: number; per_page?: number }): Observable<PaginatedResponse<WorkflowInstanceResource>> {
    return this.http.get<PaginatedResponse<WorkflowInstanceResource>>(`${this.base}/workflows/my-requests`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  getSlaReport(): Observable<ApiResponse<WorkflowSlaReport>> {
    return this.http.get<ApiResponse<WorkflowSlaReport>>(`${this.base}/workflows/sla-report`);
  }

  recordDecision(
    stepId: string,
    payload: WorkflowRecordDecisionRequest,
  ): Observable<ApiResponse<{ success: boolean; message?: string }>> {
    return this.http.post<ApiResponse<{ success: boolean; message?: string }>>(
      `${this.base}/workflows/steps/${stepId}/decide`,
      payload,
    );
  }

  consumeRemoteApproval(payload: {
    token: string;
    decision: 'approved' | 'rejected';
    comment?: string;
  }): Observable<ApiResponse<{ success: boolean; message?: string }>> {
    return this.http.post<ApiResponse<{ success: boolean; message?: string }>>(
      `${this.base}/workflows/remote-approval`,
      payload,
    );
  }

  // --- INSTANCES ---
  getInstances(params?: WorkflowInstanceParams): Observable<PaginatedResponse<WorkflowInstanceResource>> {
    return this.http.get<PaginatedResponse<WorkflowInstanceResource>>(`${this.base}/workflows/instances`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  getInstance(id: string): Observable<ApiResponse<WorkflowInstanceResource>> {
    return this.http.get<ApiResponse<WorkflowInstanceResource>>(`${this.base}/workflows/instances/${id}`);
  }

  startInstance(payload: WorkflowStartWorkflowRequest): Observable<ApiResponse<WorkflowInstanceResource>> {
    return this.http.post<ApiResponse<WorkflowInstanceResource>>(`${this.base}/workflows/instances`, payload);
  }

  cancelInstance(id: string, reason?: string): Observable<ApiResponse<{ success: boolean }>> {
    return this.http.post<ApiResponse<{ success: boolean }>>(`${this.base}/workflows/instances/${id}/cancel`, {
      reason,
    });
  }

  getInstanceAuditTrail(id: string): Observable<ApiResponse<WorkflowAuditEntryResource[]>> {
    return this.http.get<ApiResponse<WorkflowAuditEntryResource[]>>(
      `${this.base}/workflows/instances/${id}/audit-trail`,
    );
  }

  verifyInstanceAuditTrail(id: string): Observable<ApiResponse<WorkflowAuditVerification>> {
    return this.http.get<ApiResponse<WorkflowAuditVerification>>(
      `${this.base}/workflows/instances/${id}/audit-trail/verify`,
    );
  }

  // --- DEFINITIONS & DESIGNER ---
  getDefinitions(params?: WorkflowDefinitionParams): Observable<PaginatedResponse<WorkflowDefinitionResource>> {
    return this.http.get<PaginatedResponse<WorkflowDefinitionResource>>(`${this.base}/workflows/definitions`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  getDefinition(id: string): Observable<ApiResponse<WorkflowDefinitionResource>> {
    return this.http.get<ApiResponse<WorkflowDefinitionResource>>(`${this.base}/workflows/definitions/${id}`);
  }

  createDefinition(
    payload: WorkflowSaveDefinitionRequest,
  ): Observable<ApiResponse<WorkflowDefinitionResource>> {
    return this.http.post<ApiResponse<WorkflowDefinitionResource>>(`${this.base}/workflows/definitions`, payload);
  }

  updateDefinition(
    id: string,
    payload: Partial<WorkflowSaveDefinitionRequest>,
  ): Observable<ApiResponse<WorkflowDefinitionResource>> {
    return this.http.put<ApiResponse<WorkflowDefinitionResource>>(
      `${this.base}/workflows/definitions/${id}`,
      payload,
    );
  }

  deleteDefinition(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/workflows/definitions/${id}`);
  }

  publishDefinition(id: string): Observable<ApiResponse<WorkflowDefinitionResource>> {
    return this.http.post<ApiResponse<WorkflowDefinitionResource>>(
      `${this.base}/workflows/definitions/${id}/publish`,
      {},
    );
  }

  addNode(
    definitionId: string,
    payload: WorkflowSaveNodeRequest,
  ): Observable<ApiResponse<WorkflowNodeResource>> {
    return this.http.post<ApiResponse<WorkflowNodeResource>>(
      `${this.base}/workflows/definitions/${definitionId}/nodes`,
      payload,
    );
  }

  updateNode(
    definitionId: string,
    nodeId: string,
    payload: Partial<WorkflowSaveNodeRequest>,
  ): Observable<ApiResponse<WorkflowNodeResource>> {
    return this.http.put<ApiResponse<WorkflowNodeResource>>(
      `${this.base}/workflows/definitions/${definitionId}/nodes/${nodeId}`,
      payload,
    );
  }

  deleteNode(definitionId: string, nodeId: string): Observable<void> {
    return this.http.delete<void>(
      `${this.base}/workflows/definitions/${definitionId}/nodes/${nodeId}`,
    );
  }

  addTransition(
    definitionId: string,
    payload: WorkflowSaveTransitionRequest,
  ): Observable<ApiResponse<WorkflowTransitionResource>> {
    return this.http.post<ApiResponse<WorkflowTransitionResource>>(
      `${this.base}/workflows/definitions/${definitionId}/transitions`,
      payload,
    );
  }

  updateTransition(
    definitionId: string,
    transitionId: string,
    payload: Partial<WorkflowSaveTransitionRequest>,
  ): Observable<ApiResponse<WorkflowTransitionResource>> {
    return this.http.put<ApiResponse<WorkflowTransitionResource>>(
      `${this.base}/workflows/definitions/${definitionId}/transitions/${transitionId}`,
      payload,
    );
  }

  deleteTransition(definitionId: string, transitionId: string): Observable<void> {
    return this.http.delete<void>(
      `${this.base}/workflows/definitions/${definitionId}/transitions/${transitionId}`,
    );
  }

  // --- DELEGATIONS ---
  getDelegations(params?: QueryFilterParams): Observable<PaginatedResponse<WorkflowDelegationModel>> {
    return this.http.get<PaginatedResponse<WorkflowDelegationModel>>(`${this.base}/workflows/delegations`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  /** The API answers with the bare delegation (no envelope): both shapes are accepted. */
  createDelegation(
    payload: WorkflowCreateDelegationRequest,
  ): Observable<ApiResponse<WorkflowDelegationModel>> {
    return this.http
      .post<ApiResponse<WorkflowDelegationModel> | WorkflowDelegationModel>(`${this.base}/workflows/delegations`, payload)
      .pipe(map((res) => ('data' in res ? res : ({ success: true, data: res } as ApiResponse<WorkflowDelegationModel>))));
  }

  deleteDelegation(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/workflows/delegations/${id}`);
  }

  // --- ESCALATION RULES ---
  getEscalationRules(params?: QueryFilterParams): Observable<PaginatedResponse<WorkflowEscalationRule>> {
    return this.http.get<PaginatedResponse<WorkflowEscalationRule>>(`${this.base}/workflows/escalation-rules`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  createEscalationRule(
    payload: WorkflowSaveEscalationRuleRequest,
  ): Observable<ApiResponse<WorkflowEscalationRule>> {
    return this.http.post<ApiResponse<WorkflowEscalationRule>>(
      `${this.base}/workflows/escalation-rules`,
      payload,
    );
  }

  updateEscalationRule(
    id: string,
    payload: Partial<WorkflowSaveEscalationRuleRequest>,
  ): Observable<ApiResponse<WorkflowEscalationRule>> {
    return this.http.put<ApiResponse<WorkflowEscalationRule>>(
      `${this.base}/workflows/escalation-rules/${id}`,
      payload,
    );
  }

  deleteEscalationRule(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/workflows/escalation-rules/${id}`);
  }
  // --- APPROVAL ENGINE (Mod 006) ---
  /** Counters of the header badge. */
  getPendingCount(): Observable<ApiResponse<WorkflowPendingCount>> {
    return this.http.get<ApiResponse<WorkflowPendingCount>>(`${this.base}/workflows/pending-count`);
  }

  getSubjectTypes(): Observable<ApiResponse<WorkflowSubjectType[]>> {
    return this.http.get<ApiResponse<WorkflowSubjectType[]>>(`${this.base}/workflows/subject-types`);
  }

  // Approval matrices
  getMatrices(params?: QueryFilterParams): Observable<PaginatedResponse<WorkflowApprovalMatrix>> {
    return this.http.get<PaginatedResponse<WorkflowApprovalMatrix>>(`${this.base}/workflows/matrices`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  getMatrix(id: string): Observable<ApiResponse<WorkflowApprovalMatrix>> {
    return this.http.get<ApiResponse<WorkflowApprovalMatrix>>(`${this.base}/workflows/matrices/${id}`);
  }

  createMatrix(payload: WorkflowSaveMatrixRequest): Observable<ApiResponse<WorkflowApprovalMatrix>> {
    return this.http.post<ApiResponse<WorkflowApprovalMatrix>>(`${this.base}/workflows/matrices`, payload);
  }

  updateMatrix(id: string, payload: WorkflowSaveMatrixRequest): Observable<ApiResponse<WorkflowApprovalMatrix>> {
    return this.http.put<ApiResponse<WorkflowApprovalMatrix>>(`${this.base}/workflows/matrices/${id}`, payload);
  }

  simulateMatrix(payload: WorkflowSimulateRequest): Observable<ApiResponse<WorkflowSimulationResult>> {
    return this.http.post<ApiResponse<WorkflowSimulationResult>>(`${this.base}/workflows/matrices/simulate`, payload);
  }

  // Business calendars
  getCalendars(): Observable<ApiResponse<WorkflowBusinessCalendar[]>> {
    return this.http.get<ApiResponse<WorkflowBusinessCalendar[]>>(`${this.base}/workflows/calendars`);
  }

  createCalendar(payload: WorkflowSaveCalendarRequest): Observable<ApiResponse<WorkflowBusinessCalendar>> {
    return this.http.post<ApiResponse<WorkflowBusinessCalendar>>(`${this.base}/workflows/calendars`, payload);
  }

  updateCalendar(id: string, payload: WorkflowSaveCalendarRequest): Observable<ApiResponse<WorkflowBusinessCalendar>> {
    return this.http.put<ApiResponse<WorkflowBusinessCalendar>>(`${this.base}/workflows/calendars/${id}`, payload);
  }

  getHolidays(calendarId: string): Observable<ApiResponse<WorkflowHoliday[]>> {
    return this.http.get<ApiResponse<WorkflowHoliday[]>>(`${this.base}/workflows/calendars/${calendarId}/holidays`);
  }

  addHoliday(calendarId: string, payload: WorkflowCreateHolidayRequest): Observable<ApiResponse<WorkflowHoliday>> {
    return this.http.post<ApiResponse<WorkflowHoliday>>(
      `${this.base}/workflows/calendars/${calendarId}/holidays`,
      payload,
    );
  }

  deleteHoliday(calendarId: string, holidayId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/workflows/calendars/${calendarId}/holidays/${holidayId}`);
  }

  seedHolidays(calendarId: string, payload: WorkflowSeedHolidaysRequest): Observable<ApiResponse<WorkflowHoliday[]>> {
    return this.http.post<ApiResponse<WorkflowHoliday[]>>(
      `${this.base}/workflows/calendars/${calendarId}/seed-holidays`,
      payload,
    );
  }

  // Instances: timeline, withdrawal and evidence
  getInstanceTimeline(id: string): Observable<ApiResponse<WorkflowTimelineEntry[]>> {
    return this.http.get<ApiResponse<WorkflowTimelineEntry[]>>(`${this.base}/workflows/instances/${id}/timeline`);
  }

  withdrawInstance(id: string): Observable<ApiResponse<{ success: boolean }>> {
    return this.http.post<ApiResponse<{ success: boolean }>>(`${this.base}/workflows/instances/${id}/withdraw`, {});
  }

  /** Administrative cancellation: the reason is mandatory. */
  cancelInstanceWithReason(id: string, reason: string): Observable<ApiResponse<{ success: boolean }>> {
    return this.cancelInstance(id, reason);
  }

  /** Evidence PDF of the instance. */
  downloadInstanceEvidence(id: string): Observable<Blob> {
    return this.http.get(`${this.base}/workflows/instances/${id}/evidence`, { responseType: 'blob' });
  }

  exportSlaReport(format: 'xlsx' | 'pdf'): Observable<Blob> {
    return this.http.get(`${this.base}/workflows/sla-report/export`, {
      params: { format },
      responseType: 'blob',
    });
  }

  // Remote (token) approval: public, no session
  getRemoteApprovalPreview(token: string, action: 'approve' | 'reject'): Observable<ApiResponse<WorkflowRemoteApprovalPreview>> {
    return this.http.get<ApiResponse<WorkflowRemoteApprovalPreview>>(
      `${this.base}/workflows/remote-approval/${encodeURIComponent(token)}`,
      { params: { action } },
    );
  }

  confirmRemoteApproval(
    token: string,
    payload: WorkflowRemoteApprovalConfirm,
  ): Observable<ApiResponse<WorkflowRemoteApprovalResult> | WorkflowRemoteApprovalResult> {
    return this.http.post<ApiResponse<WorkflowRemoteApprovalResult> | WorkflowRemoteApprovalResult>(
      `${this.base}/workflows/remote-approval/${encodeURIComponent(token)}/confirm`,
      payload,
    );
  }
}
