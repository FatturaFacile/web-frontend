import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import {
  ApiResponse,
  PaginatedResponse,
  ProjectFinancialSummary,
  ProjectResource,
  ProjectTaskResource,
  ProjectTimesheetResource,
  QueryFilterParams,
  StoreProjectPayload,
  StoreProjectTaskPayload,
  StoreProjectTimesheetPayload,
  UpdateProjectPayload,
} from '../models';
import { toHttpParams } from '../http/laravel-http.utils';

export interface ProjectFilterParams extends QueryFilterParams {
  status?: string;
  project_type?: string;
  search?: string;
}

@Service()
export class ProjectApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/projects`;

  // --- Project CRUD & Lifecycle ---
  getProjects(params?: ProjectFilterParams): Observable<PaginatedResponse<ProjectResource>> {
    return this.http.get<PaginatedResponse<ProjectResource>>(this.base, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  getProjectById(id: string): Observable<ApiResponse<ProjectResource>> {
    return this.http.get<ApiResponse<ProjectResource>>(`${this.base}/${id}`);
  }

  createProject(payload: StoreProjectPayload): Observable<ApiResponse<ProjectResource>> {
    return this.http.post<ApiResponse<ProjectResource>>(this.base, payload);
  }

  updateProject(id: string, payload: UpdateProjectPayload): Observable<ApiResponse<ProjectResource>> {
    return this.http.put<ApiResponse<ProjectResource>>(`${this.base}/${id}`, payload);
  }

  deleteProject(id: string): Observable<ApiResponse<unknown>> {
    return this.http.delete<ApiResponse<unknown>>(`${this.base}/${id}`);
  }

  startProject(id: string): Observable<ApiResponse<ProjectResource>> {
    return this.http.post<ApiResponse<ProjectResource>>(`${this.base}/${id}/start`, {});
  }

  pauseProject(id: string): Observable<ApiResponse<ProjectResource>> {
    return this.http.post<ApiResponse<ProjectResource>>(`${this.base}/${id}/pause`, {});
  }

  resumeProject(id: string): Observable<ApiResponse<ProjectResource>> {
    return this.http.post<ApiResponse<ProjectResource>>(`${this.base}/${id}/resume`, {});
  }

  completeProject(id: string): Observable<ApiResponse<ProjectResource>> {
    return this.http.post<ApiResponse<ProjectResource>>(`${this.base}/${id}/complete`, {});
  }

  closeProject(id: string): Observable<ApiResponse<ProjectResource>> {
    return this.http.post<ApiResponse<ProjectResource>>(`${this.base}/${id}/close`, {});
  }

  // --- Tasks ---
  getTasks(projectId: string, params?: QueryFilterParams): Observable<PaginatedResponse<ProjectTaskResource>> {
    return this.http.get<PaginatedResponse<ProjectTaskResource>>(`${this.base}/${projectId}/tasks`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  createTask(projectId: string, payload: StoreProjectTaskPayload): Observable<ApiResponse<ProjectTaskResource>> {
    return this.http.post<ApiResponse<ProjectTaskResource>>(`${this.base}/${projectId}/tasks`, payload);
  }

  updateTask(taskId: string, payload: Partial<StoreProjectTaskPayload>): Observable<ApiResponse<ProjectTaskResource>> {
    return this.http.put<ApiResponse<ProjectTaskResource>>(`${this.base}/tasks/${taskId}`, payload);
  }

  deleteTask(taskId: string): Observable<ApiResponse<unknown>> {
    return this.http.delete<ApiResponse<unknown>>(`${this.base}/tasks/${taskId}`);
  }

  // --- Timesheets ---
  getTimesheets(projectId: string, params?: QueryFilterParams): Observable<PaginatedResponse<ProjectTimesheetResource>> {
    return this.http.get<PaginatedResponse<ProjectTimesheetResource>>(`${this.base}/${projectId}/timesheets`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  createTimesheet(projectId: string, payload: StoreProjectTimesheetPayload): Observable<ApiResponse<ProjectTimesheetResource>> {
    return this.http.post<ApiResponse<ProjectTimesheetResource>>(`${this.base}/${projectId}/timesheets`, payload);
  }

  submitTimesheet(timesheetId: string): Observable<ApiResponse<ProjectTimesheetResource>> {
    return this.http.post<ApiResponse<ProjectTimesheetResource>>(`${this.base}/timesheets/${timesheetId}/submit`, {});
  }

  approveTimesheet(timesheetId: string): Observable<ApiResponse<ProjectTimesheetResource>> {
    return this.http.post<ApiResponse<ProjectTimesheetResource>>(`${this.base}/timesheets/${timesheetId}/approve`, {});
  }

  rejectTimesheet(timesheetId: string, reason: string): Observable<ApiResponse<ProjectTimesheetResource>> {
    return this.http.post<ApiResponse<ProjectTimesheetResource>>(`${this.base}/timesheets/${timesheetId}/reject`, {
      reason,
    });
  }

  // --- Financial Summary & EVM ---
  getFinancialSummary(projectId: string): Observable<ApiResponse<ProjectFinancialSummary>> {
    return this.http.get<ApiResponse<ProjectFinancialSummary>>(`${this.base}/${projectId}/financial-summary`);
  }

  recalculateEvm(projectId: string): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(`${this.base}/${projectId}/recalculate-evm`, {});
  }
}
