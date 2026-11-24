import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { toHttpParams } from '../http/laravel-http.utils';
import {
  ApiResponse,
  PaginatedResponse,
  ProjectBillingInvoice,
  ProjectBudget,
  ProjectBudgetPayload,
  ProjectCapacityRow,
  ProjectChangeOrder,
  ProjectChangeOrderPayload,
  ProjectClosureChecks,
  ProjectCostEntry,
  ProjectCostPayload,
  ProjectCriticalPath,
  ProjectDependencyType,
  ProjectExpensePayload,
  ProjectGantt,
  ProjectMilestone,
  ProjectMilestonePayload,
  ProjectPaged,
  ProjectProfitability,
  ProjectRateCard,
  ProjectRateCardPayload,
  ProjectResource,
  ProjectResourceProfile,
  ProjectResourceProfilePayload,
  ProjectRevenueRecognition,
  QueryFilterParams,
} from '../models';

/** Project controlling endpoints beyond `ProjectApiService`. */
@Service()
export class ProjectControlApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/projects`;

  // --- Budget ---

  getBudget(projectId: string): Observable<ApiResponse<ProjectBudget>> {
    return this.http.get<ApiResponse<ProjectBudget>>(`${this.base}/${projectId}/budget`);
  }

  saveBudget(projectId: string, payload: ProjectBudgetPayload): Observable<ApiResponse<ProjectBudget>> {
    return this.http.post<ApiResponse<ProjectBudget>>(`${this.base}/${projectId}/budget`, payload);
  }

  baselineBudget(projectId: string): Observable<ApiResponse<ProjectBudget>> {
    return this.http.post<ApiResponse<ProjectBudget>>(`${this.base}/${projectId}/budget/baseline`, {});
  }

  approveBudget(projectId: string): Observable<ApiResponse<ProjectBudget>> {
    return this.http.post<ApiResponse<ProjectBudget>>(`${this.base}/${projectId}/budget/approve`, {});
  }

  rejectBudget(projectId: string, reason: string): Observable<ApiResponse<ProjectBudget>> {
    return this.http.post<ApiResponse<ProjectBudget>>(`${this.base}/${projectId}/budget/reject`, { reason });
  }

  // --- Milestones ---

  getMilestones(projectId: string, params?: QueryFilterParams): Observable<PaginatedResponse<ProjectMilestone>> {
    return this.http.get<PaginatedResponse<ProjectMilestone>>(`${this.base}/${projectId}/milestones`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  createMilestone(projectId: string, payload: ProjectMilestonePayload): Observable<ApiResponse<ProjectMilestone>> {
    return this.http.post<ApiResponse<ProjectMilestone>>(`${this.base}/${projectId}/milestones`, payload);
  }

  updateMilestone(milestoneId: string, payload: ProjectMilestonePayload): Observable<ApiResponse<ProjectMilestone>> {
    return this.http.put<ApiResponse<ProjectMilestone>>(`${this.base}/milestones/${milestoneId}`, payload);
  }

  completeMilestone(milestoneId: string): Observable<ApiResponse<ProjectMilestone>> {
    return this.http.post<ApiResponse<ProjectMilestone>>(`${this.base}/milestones/${milestoneId}/complete`, {});
  }

  // --- Change orders ---

  getChangeOrders(projectId: string, params?: QueryFilterParams & { status?: string }): Observable<PaginatedResponse<ProjectChangeOrder>> {
    return this.http.get<PaginatedResponse<ProjectChangeOrder>>(`${this.base}/${projectId}/change-orders`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  createChangeOrder(projectId: string, payload: ProjectChangeOrderPayload): Observable<ApiResponse<ProjectChangeOrder>> {
    return this.http.post<ApiResponse<ProjectChangeOrder>>(`${this.base}/${projectId}/change-orders`, payload);
  }

  approveChangeOrder(orderId: string): Observable<ApiResponse<ProjectChangeOrder>> {
    return this.http.post<ApiResponse<ProjectChangeOrder>>(`${this.base}/change-orders/${orderId}/approve`, {});
  }

  rejectChangeOrder(orderId: string, reason: string): Observable<ApiResponse<ProjectChangeOrder>> {
    return this.http.post<ApiResponse<ProjectChangeOrder>>(`${this.base}/change-orders/${orderId}/reject`, { reason });
  }

  // --- Billing and revenue recognition ---

  billMilestone(
    projectId: string,
    milestoneId: string,
    payload: { tax_rate: number; up_to_date?: string | null },
  ): Observable<ApiResponse<ProjectBillingInvoice>> {
    return this.http.post<ApiResponse<ProjectBillingInvoice>>(
      `${this.base}/${projectId}/billing/milestones/${milestoneId}`,
      payload,
    );
  }

  billTimeAndMaterials(
    projectId: string,
    payload: { tax_rate: number; up_to_date?: string | null },
  ): Observable<ApiResponse<ProjectBillingInvoice>> {
    return this.http.post<ApiResponse<ProjectBillingInvoice>>(`${this.base}/${projectId}/billing/time-and-materials`, payload);
  }

  getBillingEvents(projectId: string): Observable<ProjectPaged<Record<string, unknown>>> {
    return this.http.get<ProjectPaged<Record<string, unknown>>>(`${this.base}/${projectId}/billing-events`);
  }

  getRevenueRecognitions(projectId: string, params?: QueryFilterParams): Observable<PaginatedResponse<ProjectRevenueRecognition>> {
    return this.http.get<PaginatedResponse<ProjectRevenueRecognition>>(`${this.base}/${projectId}/revenue-recognitions`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  runRevenueRecognition(
    projectId: string,
    payload: { accounting_period_date: string; override_completion_percentage?: number | null },
  ): Observable<ApiResponse<ProjectRevenueRecognition>> {
    return this.http.post<ApiResponse<ProjectRevenueRecognition>>(`${this.base}/${projectId}/revenue-recognitions`, payload);
  }

  // --- Costs and expenses ---

  getCosts(
    projectId: string,
    params?: QueryFilterParams & { cost_category?: string; task_id?: string; approval_status?: string },
  ): Observable<PaginatedResponse<ProjectCostEntry>> {
    return this.http.get<PaginatedResponse<ProjectCostEntry>>(`${this.base}/${projectId}/costs`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  createCost(projectId: string, payload: ProjectCostPayload): Observable<ApiResponse<ProjectCostEntry>> {
    return this.http.post<ApiResponse<ProjectCostEntry>>(`${this.base}/${projectId}/costs`, payload);
  }

  createExpense(projectId: string, payload: ProjectExpensePayload): Observable<ApiResponse<ProjectCostEntry>> {
    return this.http.post<ApiResponse<ProjectCostEntry>>(`${this.base}/${projectId}/expenses`, payload);
  }

  approveExpense(expenseId: string): Observable<ApiResponse<ProjectCostEntry>> {
    return this.http.post<ApiResponse<ProjectCostEntry>>(`${this.base}/expenses/${expenseId}/approve`, {});
  }

  rejectExpense(expenseId: string, reason: string): Observable<ApiResponse<ProjectCostEntry>> {
    return this.http.post<ApiResponse<ProjectCostEntry>>(`${this.base}/expenses/${expenseId}/reject`, { reason });
  }

  // --- Analysis ---

  getForecast(projectId: string): Observable<ApiResponse<Record<string, unknown>>> {
    return this.http.get<ApiResponse<Record<string, unknown>>>(`${this.base}/${projectId}/forecast`);
  }

  getProfitability(projectId: string): Observable<ApiResponse<ProjectProfitability>> {
    return this.http.get<ApiResponse<ProjectProfitability>>(`${this.base}/${projectId}/profitability`);
  }

  getClosureChecks(projectId: string): Observable<ApiResponse<ProjectClosureChecks>> {
    return this.http.get<ApiResponse<ProjectClosureChecks>>(`${this.base}/${projectId}/closure-checks`);
  }

  getEvmSnapshots(projectId: string): Observable<ProjectPaged<Record<string, unknown>>> {
    return this.http.get<ProjectPaged<Record<string, unknown>>>(`${this.base}/${projectId}/evm-snapshots`);
  }

  getAuditTrail(projectId: string, eventType?: string | null): Observable<ProjectPaged<Record<string, unknown>>> {
    return this.http.get<ProjectPaged<Record<string, unknown>>>(`${this.base}/${projectId}/audit-trail`, {
      params: eventType ? toHttpParams({ event_type: eventType }) : undefined,
    });
  }

  // --- Planning ---

  getGantt(projectId: string): Observable<ApiResponse<ProjectGantt>> {
    return this.http.get<ApiResponse<ProjectGantt>>(`${this.base}/${projectId}/gantt`);
  }

  getCriticalPath(projectId: string): Observable<ApiResponse<ProjectCriticalPath>> {
    return this.http.get<ApiResponse<ProjectCriticalPath>>(`${this.base}/${projectId}/critical-path`);
  }

  baselineSchedule(projectId: string): Observable<ApiResponse<ProjectResource>> {
    return this.http.post<ApiResponse<ProjectResource>>(`${this.base}/${projectId}/schedule/baseline`, {});
  }

  addTaskDependency(
    taskId: string,
    payload: { predecessor_task_id: string; dependency_type?: ProjectDependencyType | null; lag_days?: number | null },
  ): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(`${this.base}/tasks/${taskId}/dependencies`, payload);
  }

  removeTaskDependency(dependencyId: string): Observable<ApiResponse<unknown>> {
    return this.http.delete<ApiResponse<unknown>>(`${this.base}/task-dependencies/${dependencyId}`);
  }

  assignTask(
    taskId: string,
    payload: { user_id: string; allocated_hours: number; role_description?: string | null },
  ): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(`${this.base}/tasks/${taskId}/assignments`, payload);
  }

  removeTaskAssignment(assignmentId: string): Observable<ApiResponse<unknown>> {
    return this.http.delete<ApiResponse<unknown>>(`${this.base}/task-assignments/${assignmentId}`);
  }

  // --- Resources and rate cards ---

  getResources(): Observable<ProjectPaged<ProjectResourceProfile>> {
    return this.http.get<ProjectPaged<ProjectResourceProfile>>(`${this.base}/resources`);
  }

  updateResource(userId: string, payload: ProjectResourceProfilePayload): Observable<ApiResponse<ProjectResourceProfile>> {
    return this.http.put<ApiResponse<ProjectResourceProfile>>(`${this.base}/resources/${userId}`, payload);
  }

  getResourceCapacity(params: { from: string; to: string; user_id?: string | null }): Observable<ApiResponse<ProjectCapacityRow[]>> {
    return this.http.get<ApiResponse<ProjectCapacityRow[]>>(`${this.base}/resource-capacity`, {
      params: toHttpParams(params),
    });
  }

  getRateCards(params?: { project_id?: string; user_id?: string }): Observable<ProjectPaged<ProjectRateCard>> {
    return this.http.get<ProjectPaged<ProjectRateCard>>(`${this.base}/rate-cards`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  createRateCard(payload: ProjectRateCardPayload): Observable<ApiResponse<ProjectRateCard>> {
    return this.http.post<ApiResponse<ProjectRateCard>>(`${this.base}/rate-cards`, payload);
  }

  deleteRateCard(rateCardId: string): Observable<ApiResponse<unknown>> {
    return this.http.delete<ApiResponse<unknown>>(`${this.base}/rate-cards/${rateCardId}`);
  }
}
