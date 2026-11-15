import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import {
  BiCalculatedMeasure,
  BiCalculatedMeasureRequest,
  BiDashboard,
  BiDashboardRequest,
  BiDataset,
  BiExplorerRequest,
  BiMember,
  BiOverview,
  BiQueryOutcome,
  BiResponse,
  BiSavedQuery,
  BiSavedQueryRequest,
  BiShare,
  BiShareRequest,
  BiShareResourceType,
  BiSnapshot,
  BiSnapshotComparison,
  BiWidget,
  BiWidgetData,
  BiWidgetDataFilters,
  BiWidgetLayout,
  BiWidgetRequest,
} from '../models';

@Service()
export class BusinessIntelligenceApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/business-intelligence`;

  getOverview(): Observable<BiResponse<BiOverview>> {
    return this.http.get<BiResponse<BiOverview>>(`${this.base}/overview`);
  }

  // Semantic layer
  getDatasets(): Observable<BiResponse<BiDataset[]>> {
    return this.http.get<BiResponse<BiDataset[]>>(`${this.base}/datasets`);
  }

  // Calculated measures
  getCalculatedMeasures(dataset?: string): Observable<BiResponse<BiCalculatedMeasure[]>> {
    return this.http.get<BiResponse<BiCalculatedMeasure[]>>(`${this.base}/calculated-measures`, { params: this.params({ dataset, per_page: 100 }) });
  }

  createCalculatedMeasure(payload: BiCalculatedMeasureRequest): Observable<BiResponse<BiCalculatedMeasure>> {
    return this.http.post<BiResponse<BiCalculatedMeasure>>(`${this.base}/calculated-measures`, payload);
  }

  updateCalculatedMeasure(id: string, payload: Partial<BiCalculatedMeasureRequest>): Observable<BiResponse<BiCalculatedMeasure>> {
    return this.http.put<BiResponse<BiCalculatedMeasure>>(`${this.base}/calculated-measures/${id}`, payload);
  }

  deleteCalculatedMeasure(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/calculated-measures/${id}`);
  }

  // Saved queries and the explorer
  getSavedQueries(filters?: { dataset?: string; search?: string; per_page?: number }): Observable<BiResponse<BiSavedQuery[]>> {
    return this.http.get<BiResponse<BiSavedQuery[]>>(`${this.base}/saved-queries`, { params: this.params(filters) });
  }

  getSavedQuery(id: string): Observable<BiResponse<BiSavedQuery>> {
    return this.http.get<BiResponse<BiSavedQuery>>(`${this.base}/saved-queries/${id}`);
  }

  createSavedQuery(payload: BiSavedQueryRequest): Observable<BiResponse<BiSavedQuery>> {
    return this.http.post<BiResponse<BiSavedQuery>>(`${this.base}/saved-queries`, payload);
  }

  updateSavedQuery(id: string, payload: Partial<BiSavedQueryRequest>): Observable<BiResponse<BiSavedQuery>> {
    return this.http.put<BiResponse<BiSavedQuery>>(`${this.base}/saved-queries/${id}`, payload);
  }

  deleteSavedQuery(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/saved-queries/${id}`);
  }

  runSavedQuery(id: string): Observable<BiResponse<BiQueryOutcome>> {
    return this.http.get<BiResponse<BiQueryOutcome>>(`${this.base}/saved-queries/${id}/run`);
  }

  explore(payload: BiExplorerRequest): Observable<BiResponse<BiQueryOutcome>> {
    return this.http.post<BiResponse<BiQueryOutcome>>(`${this.base}/explorer/run`, payload);
  }

  // Dashboards
  getDashboards(filters?: { search?: string; per_page?: number }): Observable<BiResponse<BiDashboard[]>> {
    return this.http.get<BiResponse<BiDashboard[]>>(`${this.base}/dashboards`, { params: this.params(filters) });
  }

  getDashboard(id: string): Observable<BiResponse<BiDashboard>> {
    return this.http.get<BiResponse<BiDashboard>>(`${this.base}/dashboards/${id}`);
  }

  createDashboard(payload: BiDashboardRequest): Observable<BiResponse<BiDashboard>> {
    return this.http.post<BiResponse<BiDashboard>>(`${this.base}/dashboards`, payload);
  }

  updateDashboard(id: string, payload: Partial<BiDashboardRequest>): Observable<BiResponse<BiDashboard>> {
    return this.http.put<BiResponse<BiDashboard>>(`${this.base}/dashboards/${id}`, payload);
  }

  deleteDashboard(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/dashboards/${id}`);
  }

  saveLayout(id: string, layout: ({ id: string } & BiWidgetLayout)[]): Observable<BiResponse<BiDashboard>> {
    return this.http.put<BiResponse<BiDashboard>>(`${this.base}/dashboards/${id}/layout`, { layout });
  }

  getDashboardData(id: string, view?: Pick<BiWidgetDataFilters, 'period' | 'filters'>): Observable<BiResponse<BiWidgetData[]>> {
    return this.http.get<BiResponse<BiWidgetData[]>>(`${this.base}/dashboards/${id}/data`, { params: this.viewParams(view) });
  }

  // Widgets
  addWidget(dashboardId: string, payload: BiWidgetRequest): Observable<BiResponse<BiWidget>> {
    return this.http.post<BiResponse<BiWidget>>(`${this.base}/dashboards/${dashboardId}/widgets`, payload);
  }

  updateWidget(id: string, payload: Partial<BiWidgetRequest>): Observable<BiResponse<BiWidget>> {
    return this.http.put<BiResponse<BiWidget>>(`${this.base}/widgets/${id}`, payload);
  }

  deleteWidget(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/widgets/${id}`);
  }

  getWidgetData(id: string, view?: BiWidgetDataFilters): Observable<BiResponse<BiWidgetData>> {
    return this.http.get<BiResponse<BiWidgetData>>(`${this.base}/widgets/${id}/data`, { params: this.viewParams(view) });
  }

  // Sharing
  getMembers(): Observable<BiResponse<BiMember[]>> {
    return this.http.get<BiResponse<BiMember[]>>(`${this.base}/members`);
  }

  getShares(resourceType: BiShareResourceType, resourceId: string): Observable<BiResponse<BiShare[]>> {
    return this.http.get<BiResponse<BiShare[]>>(`${this.base}/shares`, { params: this.params({ resource_type: resourceType, resource_id: resourceId }) });
  }

  share(payload: BiShareRequest): Observable<BiResponse<BiShare>> {
    return this.http.post<BiResponse<BiShare>>(`${this.base}/shares`, payload);
  }

  unshare(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/shares/${id}`);
  }

  // Snapshots
  getSnapshots(sourceType: BiShareResourceType, sourceId: string): Observable<BiResponse<BiSnapshot[]>> {
    return this.http.get<BiResponse<BiSnapshot[]>>(`${this.base}/snapshots`, { params: this.params({ source_type: sourceType, source_id: sourceId }) });
  }

  takeSnapshot(sourceType: BiShareResourceType, sourceId: string): Observable<BiResponse<BiSnapshot>> {
    return this.http.post<BiResponse<BiSnapshot>>(`${this.base}/snapshots`, { source_type: sourceType, source_id: sourceId });
  }

  getSnapshot(id: string): Observable<BiResponse<BiSnapshot>> {
    return this.http.get<BiResponse<BiSnapshot>>(`${this.base}/snapshots/${id}`);
  }

  compareSnapshot(id: string): Observable<BiResponse<BiSnapshotComparison>> {
    return this.http.get<BiResponse<BiSnapshotComparison>>(`${this.base}/snapshots/${id}/compare`);
  }

  deleteSnapshot(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/snapshots/${id}`);
  }

  /** Query string of the filters of a viewer (Laravel nested keys: `period[from]`, `filters[0][field]`, `drill[0][dimension]`). */
  private viewParams(view?: BiWidgetDataFilters): HttpParams {
    let params = new HttpParams();
    if (view?.period) {
      for (const [key, value] of Object.entries(view.period)) {
        if (value) {
          params = params.set(`period[${key}]`, value);
        }
      }
    }
    (view?.filters ?? []).forEach((filter, index) => {
      params = params.set(`filters[${index}][field]`, filter.field).set(`filters[${index}][operator]`, filter.operator);
      if (filter.value !== undefined && filter.value !== null) {
        params = params.set(`filters[${index}][value]`, String(filter.value));
      }
    });
    (view?.drill ?? []).forEach((step, index) => {
      params = params.set(`drill[${index}][dimension]`, step.dimension);
      if (step.value !== null) {
        params = params.set(`drill[${index}][value]`, step.value);
      }
    });
    return params;
  }

  private params(values?: object): HttpParams {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(values ?? {})) {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, String(value));
      }
    }
    return params;
  }
}
