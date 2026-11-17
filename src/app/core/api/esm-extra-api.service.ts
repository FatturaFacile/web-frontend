import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { toHttpParams } from '../http/laravel-http.utils';

/** Generic JSON record used for the loosely typed ESM configuration payloads. */
export type EsmRecord = Record<string, unknown>;

export interface EsmData<T = EsmRecord> {
  data: T;
}

export interface EsmList<T = EsmRecord> {
  data: T[];
  meta?: { current_page: number; last_page: number; per_page: number; total: number };
}

export type EsmListFilters = Record<string, string | number | boolean | null | undefined>;

export type EsmWorkOrderAction = 'dispatch' | 'schedule' | 'record-visit' | 'complete' | 'parts' | 'invoice';

/**
 * Helpdesk administration (routing rules, business hours, settings, mailboxes, views, macros, canned responses,
 * knowledge base), ITSM (incidents, problems, changes), field work orders and service contracts (`/esm`).
 * Read endpoints already wrapped by HelpdeskApiService / TicketApiService are not repeated here.
 */
@Service()
export class EsmExtraApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/esm`;

  // --- Helpdesk configuration -------------------------------------------------

  getPriorityMatrix(): Observable<EsmData> {
    return this.http.get<EsmData>(`${this.base}/helpdesk/priority-matrix`);
  }

  getHelpdeskReports(filters: EsmListFilters = {}): Observable<EsmData> {
    return this.http.get<EsmData>(`${this.base}/helpdesk/reports`, { params: toHttpParams(filters) });
  }

  getHelpdeskSettings(): Observable<EsmData> {
    return this.http.get<EsmData>(`${this.base}/helpdesk/settings`);
  }

  updateHelpdeskSettings(payload: EsmRecord): Observable<EsmData> {
    return this.http.put<EsmData>(`${this.base}/helpdesk/settings`, payload);
  }

  updateTeamAssignment(teamId: string, payload: EsmRecord): Observable<EsmData> {
    return this.http.put<EsmData>(`${this.base}/helpdesk/teams/${teamId}/assignment`, payload);
  }

  getRoutingRules(): Observable<EsmList> {
    return this.http.get<EsmList>(`${this.base}/helpdesk/routing-rules`);
  }

  createRoutingRule(payload: EsmRecord): Observable<EsmData> {
    return this.http.post<EsmData>(`${this.base}/helpdesk/routing-rules`, payload);
  }

  updateRoutingRule(id: string, payload: EsmRecord): Observable<EsmData> {
    return this.http.patch<EsmData>(`${this.base}/helpdesk/routing-rules/${id}`, payload);
  }

  deleteRoutingRule(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/helpdesk/routing-rules/${id}`);
  }

  getBusinessHours(): Observable<EsmList> {
    return this.http.get<EsmList>(`${this.base}/helpdesk/business-hours`);
  }

  createBusinessHours(payload: EsmRecord): Observable<EsmData> {
    return this.http.post<EsmData>(`${this.base}/helpdesk/business-hours`, payload);
  }

  updateBusinessHours(id: string, payload: EsmRecord): Observable<EsmData> {
    return this.http.patch<EsmData>(`${this.base}/helpdesk/business-hours/${id}`, payload);
  }

  deleteBusinessHours(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/helpdesk/business-hours/${id}`);
  }

  getNotificationPreferences(): Observable<EsmData> {
    return this.http.get<EsmData>(`${this.base}/helpdesk/notification-preferences`);
  }

  updateNotificationPreferences(payload: EsmRecord): Observable<EsmData> {
    return this.http.put<EsmData>(`${this.base}/helpdesk/notification-preferences`, payload);
  }

  // --- Agent tools: canned responses, macros, views ---------------------------

  createCannedResponse(payload: EsmRecord): Observable<EsmData> {
    return this.http.post<EsmData>(`${this.base}/helpdesk/canned-responses`, payload);
  }

  updateCannedResponse(id: string, payload: EsmRecord): Observable<EsmData> {
    return this.http.patch<EsmData>(`${this.base}/helpdesk/canned-responses/${id}`, payload);
  }

  deleteCannedResponse(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/helpdesk/canned-responses/${id}`);
  }

  createMacro(payload: EsmRecord): Observable<EsmData> {
    return this.http.post<EsmData>(`${this.base}/helpdesk/macros`, payload);
  }

  updateMacro(id: string, payload: EsmRecord): Observable<EsmData> {
    return this.http.patch<EsmData>(`${this.base}/helpdesk/macros/${id}`, payload);
  }

  deleteMacro(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/helpdesk/macros/${id}`);
  }

  getViews(): Observable<EsmList> {
    return this.http.get<EsmList>(`${this.base}/helpdesk/views`);
  }

  createView(payload: EsmRecord): Observable<EsmData> {
    return this.http.post<EsmData>(`${this.base}/helpdesk/views`, payload);
  }

  updateView(id: string, payload: EsmRecord): Observable<EsmData> {
    return this.http.patch<EsmData>(`${this.base}/helpdesk/views/${id}`, payload);
  }

  deleteView(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/helpdesk/views/${id}`);
  }

  // --- Support mailboxes ------------------------------------------------------

  getMailboxes(): Observable<EsmList> {
    return this.http.get<EsmList>(`${this.base}/helpdesk/mailboxes`);
  }

  createMailbox(payload: EsmRecord): Observable<EsmData> {
    return this.http.post<EsmData>(`${this.base}/helpdesk/mailboxes`, payload);
  }

  updateMailbox(id: string, payload: EsmRecord): Observable<EsmData> {
    return this.http.patch<EsmData>(`${this.base}/helpdesk/mailboxes/${id}`, payload);
  }

  deleteMailbox(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/helpdesk/mailboxes/${id}`);
  }

  pollMailbox(id: string): Observable<EsmData> {
    return this.http.post<EsmData>(`${this.base}/helpdesk/mailboxes/${id}/poll`, {});
  }

  getMailboxMessages(id: string, filters: EsmListFilters = {}): Observable<EsmList> {
    return this.http.get<EsmList>(`${this.base}/helpdesk/mailboxes/${id}/messages`, { params: toHttpParams(filters) });
  }

  // --- Knowledge base ---------------------------------------------------------

  getKbCategories(): Observable<EsmList> {
    return this.http.get<EsmList>(`${this.base}/kb/categories`);
  }

  createKbCategory(payload: EsmRecord): Observable<EsmData> {
    return this.http.post<EsmData>(`${this.base}/kb/categories`, payload);
  }

  updateKbCategory(id: string, payload: EsmRecord): Observable<EsmData> {
    return this.http.patch<EsmData>(`${this.base}/kb/categories/${id}`, payload);
  }

  deleteKbCategory(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/kb/categories/${id}`);
  }

  getKbArticle(id: string): Observable<EsmData> {
    return this.http.get<EsmData>(`${this.base}/kb/articles/${id}`);
  }

  createKbArticle(payload: EsmRecord): Observable<EsmData> {
    return this.http.post<EsmData>(`${this.base}/kb/articles`, payload);
  }

  updateKbArticle(id: string, payload: EsmRecord): Observable<EsmData> {
    return this.http.patch<EsmData>(`${this.base}/kb/articles/${id}`, payload);
  }

  deleteKbArticle(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/kb/articles/${id}`);
  }

  getKbArticleVersions(id: string): Observable<EsmList> {
    return this.http.get<EsmList>(`${this.base}/kb/articles/${id}/versions`);
  }

  restoreKbArticleVersion(id: string, version: number): Observable<EsmData> {
    return this.http.post<EsmData>(`${this.base}/kb/articles/${id}/versions/${version}/restore`, {});
  }

  // --- ITSM -------------------------------------------------------------------

  getIncidents(filters: EsmListFilters = {}): Observable<EsmList> {
    return this.http.get<EsmList>(`${this.base}/incidents`, { params: toHttpParams(filters) });
  }

  createIncident(payload: EsmRecord): Observable<EsmData> {
    return this.http.post<EsmData>(`${this.base}/incidents`, payload);
  }

  resolveIncident(id: string, payload: EsmRecord = {}): Observable<EsmData> {
    return this.http.post<EsmData>(`${this.base}/incidents/${id}/resolve`, payload);
  }

  getProblems(filters: EsmListFilters = {}): Observable<EsmList> {
    return this.http.get<EsmList>(`${this.base}/problems`, { params: toHttpParams(filters) });
  }

  getChanges(filters: EsmListFilters = {}): Observable<EsmList> {
    return this.http.get<EsmList>(`${this.base}/changes`, { params: toHttpParams(filters) });
  }

  createChange(payload: EsmRecord): Observable<EsmData> {
    return this.http.post<EsmData>(`${this.base}/changes`, payload);
  }

  approveChange(id: string, payload: EsmRecord = {}): Observable<EsmData> {
    return this.http.post<EsmData>(`${this.base}/changes/${id}/approve`, payload);
  }

  /** Records the customer satisfaction answer of a closed ticket / work order. */
  submitCsat(payload: EsmRecord): Observable<EsmData> {
    return this.http.post<EsmData>(`${this.base}/csat`, payload);
  }

  // --- Work orders and service contracts --------------------------------------

  getWorkOrders(filters: EsmListFilters = {}): Observable<EsmList> {
    return this.http.get<EsmList>(`${this.base}/work-orders`, { params: toHttpParams(filters) });
  }

  getWorkOrder(id: string): Observable<EsmData> {
    return this.http.get<EsmData>(`${this.base}/work-orders/${id}`);
  }

  createWorkOrder(payload: EsmRecord): Observable<EsmData> {
    return this.http.post<EsmData>(`${this.base}/work-orders`, payload);
  }

  /** Workflow transitions: dispatch, schedule, record-visit, complete, parts, invoice. */
  workOrderAction(id: string, action: EsmWorkOrderAction, payload: EsmRecord = {}): Observable<EsmData> {
    return this.http.post<EsmData>(`${this.base}/work-orders/${id}/${action}`, payload);
  }

  getServiceContracts(filters: EsmListFilters = {}): Observable<EsmList> {
    return this.http.get<EsmList>(`${this.base}/service-contracts`, { params: toHttpParams(filters) });
  }

  getServiceContract(id: string): Observable<EsmData> {
    return this.http.get<EsmData>(`${this.base}/service-contracts/${id}`);
  }
}
