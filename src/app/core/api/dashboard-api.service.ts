import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { toHttpParams } from '../http/laravel-http.utils';
import {
  ApiResponse,
  CashFlowForecastPoint,
  DashboardLayout,
  DashboardWidgetData,
  DashboardWidgetDefinition,
  KpiSummary,
  SaveDashboardLayoutPayload,
  TaxDeadline,
} from '../models';

@Service()
export class DashboardApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/dashboard`;

  getKpiSummary(): Observable<ApiResponse<KpiSummary>> {
    return this.http.get<ApiResponse<KpiSummary>>(`${this.base}/kpi-summary`);
  }

  getCashFlowForecast(): Observable<ApiResponse<CashFlowForecastPoint[]>> {
    return this.http.get<ApiResponse<CashFlowForecastPoint[]>>(`${this.base}/cash-flow-forecast`);
  }

  getTaxDeadlines(): Observable<ApiResponse<TaxDeadline[]>> {
    return this.http.get<ApiResponse<TaxDeadline[]>>(`${this.base}/tax-deadlines`);
  }

  getAvailableWidgets(): Observable<ApiResponse<DashboardWidgetDefinition[]>> {
    return this.http.get<ApiResponse<DashboardWidgetDefinition[]>>(`${this.base}/available-widgets`);
  }

  getLayout(): Observable<ApiResponse<DashboardLayout>> {
    return this.http.get<ApiResponse<DashboardLayout>>(`${this.base}/layout`);
  }

  saveLayout(payload: SaveDashboardLayoutPayload): Observable<ApiResponse<DashboardLayout>> {
    return this.http.put<ApiResponse<DashboardLayout>>(`${this.base}/layout`, payload);
  }

  resetLayout(): Observable<ApiResponse<DashboardLayout>> {
    return this.http.post<ApiResponse<DashboardLayout>>(`${this.base}/layout/reset`, {});
  }

  getWidgetData(widgetIds?: string[]): Observable<ApiResponse<DashboardWidgetData>> {
    return this.http.get<ApiResponse<DashboardWidgetData>>(`${this.base}/data`, {
      params: widgetIds && widgetIds.length > 0 ? toHttpParams({ widgets: widgetIds.join(',') }) : undefined,
    });
  }
}
