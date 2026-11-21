import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { toHttpParams } from '../../core/http/laravel-http.utils';
import {
  CatalogEntry,
  Cockpit,
  CockpitFilters,
  DrillDown,
  DrillSegment,
  KpiAlert,
  LayoutBody,
  RoleCode,
  ThresholdBody,
  ThresholdRule,
} from './kpi-dashboards.models';

export interface Envelope<T> {
  success: boolean;
  message: string;
  data: T;
}

/** The global filters as the query string of the cockpit and the drill-down. */
export function filterParams(filters: CockpitFilters): Record<string, unknown> {
  return {
    preset: filters.preset,
    from: filters.preset === 'custom' ? filters.from : null,
    to: filters.preset === 'custom' ? filters.to : null,
    comparison: filters.comparison,
    company_ids: filters.companyIds.length > 0 ? filters.companyIds : null,
    cost_center_ids: filters.costCenterIds.length > 0 ? filters.costCenterIds : null,
    currency: filters.currency,
    include_intercompany_eliminations: filters.consolidated ? 1 : 0,
  };
}

/** HTTP access to `/api/v1/kpi-dashboards` (Mod 090). */
@Service()
export class KpiDashboardsApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/kpi-dashboards`;

  cockpit(
    role: RoleCode,
    filters: CockpitFilters,
    dashboardId?: string | null,
  ): Observable<Envelope<Cockpit>> {
    return this.http.get<Envelope<Cockpit>>(`${this.base}/cockpit`, {
      params: toHttpParams({ ...filterParams(filters), role, dashboard_id: dashboardId }),
    });
  }

  drillDown(
    kpi: string,
    filters: CockpitFilters,
    segment: DrillSegment,
    page = 1,
    perPage = 25,
  ): Observable<Envelope<DrillDown>> {
    return this.http.get<Envelope<DrillDown>>(`${this.base}/drill-down/${kpi}`, {
      params: toHttpParams({ ...filterParams(filters), ...segment, page, per_page: perPage }),
    });
  }

  /** CSV of every row behind a KPI segment. */
  exportCsv(kpi: string, filters: CockpitFilters, segment: DrillSegment): Observable<Blob> {
    return this.http.get(`${this.base}/drill-down/${kpi}`, {
      params: toHttpParams({ ...filterParams(filters), ...segment, export: 'csv' }),
      responseType: 'blob',
    });
  }

  catalog(): Observable<Envelope<CatalogEntry[]>> {
    return this.http.get<Envelope<CatalogEntry[]>>(`${this.base}/catalog`);
  }

  saveLayout(body: LayoutBody): Observable<Envelope<{ id: string; version: number }>> {
    return this.http.post<Envelope<{ id: string; version: number }>>(`${this.base}/layout`, body);
  }

  refreshCubes(): Observable<Envelope<{ refreshed: boolean; debounced: boolean }>> {
    return this.http.post<Envelope<{ refreshed: boolean; debounced: boolean }>>(
      `${this.base}/cubes/refresh`,
      {},
    );
  }

  alerts(): Observable<Envelope<{ rules: ThresholdRule[]; alerts: KpiAlert[] }>> {
    return this.http.get<Envelope<{ rules: ThresholdRule[]; alerts: KpiAlert[] }>>(
      `${this.base}/alerts`,
    );
  }

  configureAlert(body: ThresholdBody): Observable<Envelope<ThresholdRule>> {
    return this.http.post<Envelope<ThresholdRule>>(`${this.base}/alerts`, body);
  }

  acknowledgeAlert(id: string): Observable<Envelope<{ id: string; status: string }>> {
    return this.http.post<Envelope<{ id: string; status: string }>>(
      `${this.base}/alerts/${id}/acknowledge`,
      {},
    );
  }
}
