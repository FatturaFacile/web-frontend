import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import {
  ApiResponse,
  AnalyticsKpiReport,
  AnalyticsKpiResult,
  AnalyticsReportDefinition,
  AnalyticsSaveReportDefinitionRequest,
  BreakdownEntry,
  DueCalendarEntry,
  DueCalendarQueryParams,
  RevenueComparisonData,
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
  getReportDefinitions(): Observable<ApiResponse<AnalyticsReportDefinition[]>> {
    return this.http.get<ApiResponse<AnalyticsReportDefinition[]>>(`${this.baseUrl}/report-definitions`);
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
}
