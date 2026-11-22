import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { toHttpParams } from '../../../core/http/laravel-http.utils';
import {
  BaselineVariance,
  DependencyPayload,
  Envelope,
  FromTemplatePayload,
  GanttPayload,
  PortfolioFilters,
  Project,
  ProjectBaseline,
  ProjectPayload,
  ProjectStatus,
  ProjectTemplate,
  ReorderItem,
  TaskDependency,
  WbsNode,
  WbsNodePayload,
} from './portfolio.models';

/** HTTP access to the project portfolio, WBS, CPM, Gantt, baseline and Kanban endpoints of the projects API (Mod 078). */
@Service()
export class ProjectPortfolioApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/projects`;

  portfolio(filters: PortfolioFilters = {}): Observable<Envelope<Project[]>> {
    return this.http.get<Envelope<Project[]>>(`${this.base}/portfolio`, {
      params: toHttpParams({ status: filters.status, projectType: filters.projectType, search: filters.search }),
    });
  }

  templates(): Observable<Envelope<ProjectTemplate[]>> {
    return this.http.get<Envelope<ProjectTemplate[]>>(`${this.base}/templates`);
  }

  show(id: string): Observable<Envelope<Project>> {
    return this.http.get<Envelope<Project>>(`${this.base}/${id}`);
  }

  create(payload: ProjectPayload): Observable<Envelope<Project>> {
    return this.http.post<Envelope<Project>>(this.base, payload);
  }

  update(id: string, payload: ProjectPayload): Observable<Envelope<Project>> {
    return this.http.put<Envelope<Project>>(`${this.base}/${id}`, payload);
  }

  changeStatus(id: string, status: ProjectStatus): Observable<Envelope<Project>> {
    return this.http.patch<Envelope<Project>>(`${this.base}/${id}/status`, { status });
  }

  createFromTemplate(payload: FromTemplatePayload): Observable<Envelope<Project>> {
    return this.http.post<Envelope<Project>>(`${this.base}/from-template`, payload);
  }

  gantt(id: string, baselineId?: string | null): Observable<Envelope<GanttPayload>> {
    return this.http.get<Envelope<GanttPayload>>(`${this.base}/${id}/gantt`, { params: toHttpParams({ baselineId }) });
  }

  kanban(id: string): Observable<Envelope<WbsNode[]>> {
    return this.http.get<Envelope<WbsNode[]>>(`${this.base}/${id}/kanban`);
  }

  createNode(id: string, payload: WbsNodePayload): Observable<Envelope<WbsNode>> {
    return this.http.post<Envelope<WbsNode>>(`${this.base}/${id}/wbs-nodes`, payload);
  }

  updateNode(id: string, nodeId: string, payload: Partial<WbsNodePayload>): Observable<Envelope<WbsNode>> {
    return this.http.put<Envelope<WbsNode>>(`${this.base}/${id}/wbs-nodes/${nodeId}`, payload);
  }

  deleteNode(id: string, nodeId: string): Observable<unknown> {
    return this.http.delete(`${this.base}/${id}/wbs-nodes/${nodeId}`);
  }

  reorderNodes(id: string, items: ReorderItem[]): Observable<Envelope<WbsNode[]>> {
    return this.http.patch<Envelope<WbsNode[]>>(`${this.base}/${id}/wbs-nodes/reorder`, { items });
  }

  createDependency(id: string, payload: DependencyPayload): Observable<Envelope<TaskDependency>> {
    return this.http.post<Envelope<TaskDependency>>(`${this.base}/${id}/dependencies`, payload);
  }

  updateDependency(
    id: string,
    dependencyId: string,
    payload: Pick<DependencyPayload, 'dependencyType' | 'lagDays'>,
  ): Observable<Envelope<TaskDependency>> {
    return this.http.put<Envelope<TaskDependency>>(`${this.base}/${id}/dependencies/${dependencyId}`, payload);
  }

  deleteDependency(id: string, dependencyId: string): Observable<unknown> {
    return this.http.delete(`${this.base}/${id}/dependencies/${dependencyId}`);
  }

  recalculate(id: string): Observable<Envelope<WbsNode[]>> {
    return this.http.post<Envelope<WbsNode[]>>(`${this.base}/${id}/cpm/recalculate`, {});
  }

  baselines(id: string): Observable<Envelope<ProjectBaseline[]>> {
    return this.http.get<Envelope<ProjectBaseline[]>>(`${this.base}/${id}/baselines`);
  }

  captureBaseline(id: string, name: string): Observable<Envelope<ProjectBaseline>> {
    return this.http.post<Envelope<ProjectBaseline>>(`${this.base}/${id}/baselines`, { name });
  }

  variance(id: string, baselineId: string): Observable<Envelope<BaselineVariance>> {
    return this.http.get<Envelope<BaselineVariance>>(`${this.base}/${id}/baselines/${baselineId}/variance`);
  }
}
