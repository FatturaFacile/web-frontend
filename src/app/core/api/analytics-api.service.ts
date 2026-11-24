import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { toHttpParams } from '../http/laravel-http.utils';
import {
  ApiResponse,
  AnalyticsKpiReport,
  AnalyticsKpiResult,
  AnalyticsDesignedReport,
  AnalyticsDesignerRequest,
  AnalyticsExportSchedule,
  AnalyticsKpiSnapshot,
  AnalyticsKpiSnapshotParams,
  AnalyticsReportDefinition,
  AnalyticsReportResult,
  AnalyticsSaveDesignedReportRequest,
  AnalyticsSaveExportScheduleRequest,
  AnalyticsSaveReportDefinitionRequest,
  AnalyticsSemanticDataset,
  BreakdownEntry,
  DueCalendarEntry,
  DueCalendarQueryParams,
  PaginatedResponse,
  QueryFilterParams,
  RevenueComparisonData,
  PivotResult,
  StudioCatalog,
  StudioExecutionLog,
  StudioRunRequest,
  StudioSaveReportRequest,
  StudioSaveScheduleRequest,
  StudioSavedReport,
  StudioSchedule,
  StudioScheduleOutcome,
} from '../models';

export interface AnalyticsKpiQueryParams {
  kpis?: string[];
  from?: string;
  to?: string;
  compare?: string;
  period_preset?: string;
}

export interface ReportingFeedQueryParams {
  top?: number;
  skip?: number;
  from?: string;
  to?: string;
}

@Service()
export class AnalyticsApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/analytics`;
  private readonly reportingUrl = `${environment.apiBaseUrl}/reporting`;

  /**
   * Cash flow due date calendar with projected inflows and outflows.
   */
  getDueCalendar(params?: DueCalendarQueryParams): Observable<ApiResponse<DueCalendarEntry[]>> {
    let httpParams = new HttpParams();
    if (params?.from) httpParams = httpParams.set('from', params.from);
    if (params?.to) httpParams = httpParams.set('to', params.to);
    if (params?.direction) httpParams = httpParams.set('direction', params.direction);
    if (params?.contact_id) httpParams = httpParams.set('contact_id', params.contact_id);
    if (params?.overdue_only !== undefined) httpParams = httpParams.set('overdue_only', String(params.overdue_only));

    return this.http.get<ApiResponse<DueCalendarEntry[]>>(`${this.baseUrl}/due-calendar`, {
      params: httpParams,
    });
  }

  /**
   * Period-over-period revenue analysis (MoM, YoY) with variance.
   */
  getRevenueComparison(year?: number): Observable<ApiResponse<RevenueComparisonData>> {
    let httpParams = new HttpParams();
    if (year) httpParams = httpParams.set('year', String(year));

    return this.http.get<ApiResponse<RevenueComparisonData>>(`${this.baseUrl}/revenue-comparison`, {
      params: httpParams,
    });
  }

  /**
   * Multi-dimensional revenue/expense breakdown (customer, category, region, payment_method).
   */
  getBreakdown(dimension: string, year?: number): Observable<ApiResponse<BreakdownEntry[]>> {
    let httpParams = new HttpParams();
    if (year) httpParams = httpParams.set('year', String(year));

    return this.http.get<ApiResponse<BreakdownEntry[]>>(
      `${this.baseUrl}/breakdown/${encodeURIComponent(dimension)}`,
      { params: httpParams }
    );
  }

  /**
   * Get KPI report indicators.
   */
  getKpis(params?: AnalyticsKpiQueryParams): Observable<ApiResponse<AnalyticsKpiReport>> {
    let httpParams = new HttpParams();
    if (params?.kpis) {
      params.kpis.forEach(k => {
        httpParams = httpParams.append('kpis[]', k);
      });
    }
    if (params?.from) httpParams = httpParams.set('from', params.from);
    if (params?.to) httpParams = httpParams.set('to', params.to);
    if (params?.compare) httpParams = httpParams.set('compare', params.compare);
    if (params?.period_preset) httpParams = httpParams.set('period_preset', params.period_preset);

    return this.http.get<ApiResponse<AnalyticsKpiReport>>(`${this.baseUrl}/kpis`, {
      params: httpParams,
    });
  }

  /**
   * Get single KPI indicator details and trend data.
   */
  getKpi(kpi: string, params?: AnalyticsKpiQueryParams): Observable<ApiResponse<AnalyticsKpiResult>> {
    let httpParams = new HttpParams();
    if (params?.from) httpParams = httpParams.set('from', params.from);
    if (params?.to) httpParams = httpParams.set('to', params.to);
    if (params?.compare) httpParams = httpParams.set('compare', params.compare);
    if (params?.period_preset) httpParams = httpParams.set('period_preset', params.period_preset);

    return this.http.get<ApiResponse<AnalyticsKpiResult>>(
      `${this.baseUrl}/kpis/${encodeURIComponent(kpi)}`,
      { params: httpParams }
    );
  }

  /**
   * Export KPI indicators report to CSV.
   */
  exportKpisCsv(params?: AnalyticsKpiQueryParams): Observable<Blob> {
    let httpParams = new HttpParams();
    if (params?.kpis) {
      params.kpis.forEach(k => {
        httpParams = httpParams.append('kpis[]', k);
      });
    }
    if (params?.from) httpParams = httpParams.set('from', params.from);
    if (params?.to) httpParams = httpParams.set('to', params.to);
    if (params?.compare) httpParams = httpParams.set('compare', params.compare);

    return this.http.get(`${this.baseUrl}/kpis-export`, {
      params: httpParams,
      responseType: 'blob',
    });
  }

  /**
   * Export individual KPI data to CSV.
   */
  exportKpiCsv(kpi: string, params?: AnalyticsKpiQueryParams): Observable<Blob> {
    let httpParams = new HttpParams();
    if (params?.from) httpParams = httpParams.set('from', params.from);
    if (params?.to) httpParams = httpParams.set('to', params.to);
    if (params?.compare) httpParams = httpParams.set('compare', params.compare);

    return this.http.get(`${this.baseUrl}/kpis/${encodeURIComponent(kpi)}/export`, {
      params: httpParams,
      responseType: 'blob',
    });
  }

  /**
   * List saved custom report definitions.
   */
  getReportDefinitions(params?: QueryFilterParams): Observable<PaginatedResponse<AnalyticsReportDefinition>> {
    return this.http.get<PaginatedResponse<AnalyticsReportDefinition>>(`${this.baseUrl}/report-definitions`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  /**
   * Create a new custom report definition.
   */
  createReportDefinition(
    payload: AnalyticsSaveReportDefinitionRequest
  ): Observable<ApiResponse<AnalyticsReportDefinition>> {
    return this.http.post<ApiResponse<AnalyticsReportDefinition>>(
      `${this.baseUrl}/report-definitions`,
      payload
    );
  }

  /**
   * Retrieve a single custom report definition.
   */
  getReportDefinition(id: string): Observable<ApiResponse<AnalyticsReportDefinition>> {
    return this.http.get<ApiResponse<AnalyticsReportDefinition>>(
      `${this.baseUrl}/report-definitions/${encodeURIComponent(id)}`
    );
  }

  /**
   * Update an existing custom report definition.
   */
  updateReportDefinition(
    id: string,
    payload: AnalyticsSaveReportDefinitionRequest
  ): Observable<ApiResponse<AnalyticsReportDefinition>> {
    return this.http.put<ApiResponse<AnalyticsReportDefinition>>(
      `${this.baseUrl}/report-definitions/${encodeURIComponent(id)}`,
      payload
    );
  }

  /**
   * Delete a custom report definition.
   */
  deleteReportDefinition(id: string): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(
      `${this.baseUrl}/report-definitions/${encodeURIComponent(id)}`
    );
  }

  /**
   * Run custom report definition and obtain dataset results.
   */
  runReportDefinition(id: string): Observable<ApiResponse<AnalyticsKpiReport>> {
    return this.http.get<ApiResponse<AnalyticsKpiReport>>(
      `${this.baseUrl}/report-definitions/${encodeURIComponent(id)}/run`
    );
  }

  /**
   * Export custom report definition results as CSV/document.
   */
  exportReportDefinition(id: string): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/report-definitions/${encodeURIComponent(id)}/export`, {
      responseType: 'blob',
    });
  }

  /**
   * The governed catalogue of the semantic layer: datasets with their allow-listed dimensions and measures.
   */
  getSemanticDatasets(): Observable<ApiResponse<AnalyticsSemanticDataset[]>> {
    return this.http.get<ApiResponse<AnalyticsSemanticDataset[]>>(`${this.baseUrl}/semantic/datasets`);
  }

  getSemanticDataset(dataset: string): Observable<ApiResponse<AnalyticsSemanticDataset>> {
    return this.http.get<ApiResponse<AnalyticsSemanticDataset>>(
      `${this.baseUrl}/semantic/datasets/${encodeURIComponent(dataset)}`
    );
  }

  /**
   * Run a report of the designer: one page of a dataset and a specification.
   */
  runDesigner(payload: AnalyticsDesignerRequest): Observable<ApiResponse<AnalyticsReportResult>> {
    return this.http.post<ApiResponse<AnalyticsReportResult>>(`${this.baseUrl}/designer/run`, payload);
  }

  /**
   * Export a report of the designer (field `format`: csv, excel_csv or xlsx).
   */
  exportDesigner(payload: AnalyticsDesignerRequest): Observable<Blob> {
    return this.http.post(`${this.baseUrl}/designer/export`, payload, { responseType: 'blob' });
  }

  getDesignedReports(): Observable<ApiResponse<AnalyticsDesignedReport[]>> {
    return this.http.get<ApiResponse<AnalyticsDesignedReport[]>>(`${this.baseUrl}/designed-reports`);
  }

  getDesignedReport(id: string): Observable<ApiResponse<AnalyticsDesignedReport>> {
    return this.http.get<ApiResponse<AnalyticsDesignedReport>>(
      `${this.baseUrl}/designed-reports/${encodeURIComponent(id)}`
    );
  }

  createDesignedReport(payload: AnalyticsSaveDesignedReportRequest): Observable<ApiResponse<AnalyticsDesignedReport>> {
    return this.http.post<ApiResponse<AnalyticsDesignedReport>>(`${this.baseUrl}/designed-reports`, payload);
  }

  updateDesignedReport(
    id: string,
    payload: AnalyticsSaveDesignedReportRequest
  ): Observable<ApiResponse<AnalyticsDesignedReport>> {
    return this.http.put<ApiResponse<AnalyticsDesignedReport>>(
      `${this.baseUrl}/designed-reports/${encodeURIComponent(id)}`,
      payload
    );
  }

  deleteDesignedReport(id: string): Observable<ApiResponse<null>> {
    return this.http.delete<ApiResponse<null>>(`${this.baseUrl}/designed-reports/${encodeURIComponent(id)}`);
  }

  runDesignedReport(id: string, page = 1, perPage = 50): Observable<ApiResponse<AnalyticsReportResult>> {
    return this.http.get<ApiResponse<AnalyticsReportResult>>(
      `${this.baseUrl}/designed-reports/${encodeURIComponent(id)}/run`,
      { params: new HttpParams().set('page', String(page)).set('per_page', String(perPage)) }
    );
  }

  exportDesignedReport(id: string, format = 'csv'): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/designed-reports/${encodeURIComponent(id)}/export`, {
      params: new HttpParams().set('format', format),
      responseType: 'blob',
    });
  }

  getExportSchedules(): Observable<ApiResponse<AnalyticsExportSchedule[]>> {
    return this.http.get<ApiResponse<AnalyticsExportSchedule[]>>(`${this.baseUrl}/export-schedules`);
  }

  getExportSchedule(id: string): Observable<ApiResponse<AnalyticsExportSchedule>> {
    return this.http.get<ApiResponse<AnalyticsExportSchedule>>(
      `${this.baseUrl}/export-schedules/${encodeURIComponent(id)}`
    );
  }

  createExportSchedule(payload: AnalyticsSaveExportScheduleRequest): Observable<ApiResponse<AnalyticsExportSchedule>> {
    return this.http.post<ApiResponse<AnalyticsExportSchedule>>(`${this.baseUrl}/export-schedules`, payload);
  }

  updateExportSchedule(
    id: string,
    payload: AnalyticsSaveExportScheduleRequest
  ): Observable<ApiResponse<AnalyticsExportSchedule>> {
    return this.http.put<ApiResponse<AnalyticsExportSchedule>>(
      `${this.baseUrl}/export-schedules/${encodeURIComponent(id)}`,
      payload
    );
  }

  deleteExportSchedule(id: string): Observable<ApiResponse<null>> {
    return this.http.delete<ApiResponse<null>>(`${this.baseUrl}/export-schedules/${encodeURIComponent(id)}`);
  }

  /**
   * Daily KPI values materialised by the nightly refresh, oldest first.
   */
  getKpiSnapshots(params?: AnalyticsKpiSnapshotParams): Observable<ApiResponse<AnalyticsKpiSnapshot[]>> {
    return this.http.get<ApiResponse<AnalyticsKpiSnapshot[]>>(`${this.baseUrl}/kpi-snapshots`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  /**
   * Feed for external BI/reporting tools (PowerBI, Tableau, Google Looker Studio).
   */
  getReportingFeed(
    dataset: string,
    params?: ReportingFeedQueryParams
  ): Observable<ApiResponse<Record<string, unknown>[]>> {
    let httpParams = new HttpParams();
    if (params?.top !== undefined) httpParams = httpParams.set('$top', String(params.top));
    if (params?.skip !== undefined) httpParams = httpParams.set('$skip', String(params.skip));
    if (params?.from) httpParams = httpParams.set('from', params.from);
    if (params?.to) httpParams = httpParams.set('to', params.to);

    return this.http.get<ApiResponse<Record<string, unknown>[]>>(
      `${this.reportingUrl}/feed/${encodeURIComponent(dataset)}`,
      { params: httpParams }
    );
  }

  // ── Report and pivot studio ──────────────────────────────────────────────

  getStudioCatalog(): Observable<ApiResponse<StudioCatalog>> {
    return this.http.get<ApiResponse<StudioCatalog>>(`${this.baseUrl}/semantic/catalog`);
  }

  runPivot(payload: StudioRunRequest): Observable<ApiResponse<PivotResult>> {
    return this.http.post<ApiResponse<PivotResult>>(`${this.baseUrl}/designer/pivot`, payload);
  }

  exportStudio(payload: StudioRunRequest): Observable<Blob> {
    return this.http.post(`${this.baseUrl}/designer/export`, payload, { responseType: 'blob' });
  }

  getStudioReports(): Observable<ApiResponse<StudioSavedReport[]>> {
    return this.http.get<ApiResponse<StudioSavedReport[]>>(`${this.baseUrl}/designed-reports`);
  }

  getStudioReport(id: string): Observable<ApiResponse<StudioSavedReport>> {
    return this.http.get<ApiResponse<StudioSavedReport>>(`${this.baseUrl}/designed-reports/${encodeURIComponent(id)}`);
  }

  createStudioReport(payload: StudioSaveReportRequest): Observable<ApiResponse<StudioSavedReport>> {
    return this.http.post<ApiResponse<StudioSavedReport>>(`${this.baseUrl}/designed-reports`, payload);
  }

  updateStudioReport(id: string, payload: StudioSaveReportRequest): Observable<ApiResponse<StudioSavedReport>> {
    return this.http.put<ApiResponse<StudioSavedReport>>(
      `${this.baseUrl}/designed-reports/${encodeURIComponent(id)}`,
      payload
    );
  }

  getStudioSchedules(): Observable<ApiResponse<StudioSchedule[]>> {
    return this.http.get<ApiResponse<StudioSchedule[]>>(`${this.baseUrl}/export-schedules`);
  }

  createStudioSchedule(payload: StudioSaveScheduleRequest): Observable<ApiResponse<StudioScheduleOutcome>> {
    return this.http.post<ApiResponse<StudioScheduleOutcome>>(`${this.baseUrl}/export-schedules`, payload);
  }

  updateStudioSchedule(id: string, payload: StudioSaveScheduleRequest): Observable<ApiResponse<StudioScheduleOutcome>> {
    return this.http.put<ApiResponse<StudioScheduleOutcome>>(
      `${this.baseUrl}/export-schedules/${encodeURIComponent(id)}`,
      payload
    );
  }

  runStudioScheduleNow(id: string): Observable<ApiResponse<StudioSchedule>> {
    return this.http.post<ApiResponse<StudioSchedule>>(
      `${this.baseUrl}/export-schedules/${encodeURIComponent(id)}/run`,
      {}
    );
  }

  previewCron(cronExpression: string, timezone: string): Observable<ApiResponse<{ next_runs: string[] }>> {
    return this.http.post<ApiResponse<{ next_runs: string[] }>>(`${this.baseUrl}/export-schedules/cron-preview`, {
      cron_expression: cronExpression,
      timezone,
    });
  }

  getExecutionLogs(params?: {
    designed_report_id?: string;
    schedule_id?: string;
  }): Observable<ApiResponse<StudioExecutionLog[]>> {
    return this.http.get<ApiResponse<StudioExecutionLog[]>>(`${this.baseUrl}/execution-logs`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }
}
