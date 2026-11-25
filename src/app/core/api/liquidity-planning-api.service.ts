import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { toHttpParams } from '../http/laravel-http.utils';
import {
  LpAlert,
  LpAlertStatus,
  LpEnvelope,
  LpExportFormat,
  LpManualItem,
  LpManualItemPayload,
  LpOverview,
  LpOverviewParams,
  LpPreset,
  LpReport,
  LpScenario,
  LpScenarioPayload,
  LpSettings,
} from '../models';

/** Cash flow forecasting and liquidity planning endpoints (Mod 017). */
@Service()
export class LiquidityPlanningApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/liquidity-planning`;

  getOverview(params: LpOverviewParams = {}): Observable<LpEnvelope<LpOverview>> {
    return this.http.get<LpEnvelope<LpOverview>>(`${this.base}/overview`, {
      params: toHttpParams(params),
    });
  }

  getReport(params: LpOverviewParams = {}): Observable<LpEnvelope<LpReport>> {
    return this.http.get<LpEnvelope<LpReport>>(`${this.base}/report`, {
      params: toHttpParams(params),
    });
  }

  exportReport(format: LpExportFormat, params: LpOverviewParams = {}): Observable<Blob> {
    const path = format === 'pdf' ? 'report/pdf' : 'export/xlsx';

    return this.http.get(`${this.base}/${path}`, {
      params: toHttpParams(params),
      responseType: 'blob',
    });
  }

  // --- Scenarios ---

  getPresets(): Observable<LpEnvelope<LpPreset[]>> {
    return this.http.get<LpEnvelope<LpPreset[]>>(`${this.base}/scenarios/presets`);
  }

  listScenarios(): Observable<LpEnvelope<LpScenario[]>> {
    return this.http.get<LpEnvelope<LpScenario[]>>(`${this.base}/scenarios`);
  }

  createScenario(payload: LpScenarioPayload): Observable<LpEnvelope<LpScenario>> {
    return this.http.post<LpEnvelope<LpScenario>>(`${this.base}/scenarios`, payload);
  }

  updateScenario(id: string, payload: LpScenarioPayload): Observable<LpEnvelope<LpScenario>> {
    return this.http.put<LpEnvelope<LpScenario>>(`${this.base}/scenarios/${id}`, payload);
  }

  deleteScenario(id: string): Observable<LpEnvelope<unknown>> {
    return this.http.delete<LpEnvelope<unknown>>(`${this.base}/scenarios/${id}`);
  }

  // --- Manual items ---

  listManualItems(): Observable<LpEnvelope<LpManualItem[]>> {
    return this.http.get<LpEnvelope<LpManualItem[]>>(`${this.base}/manual-items`);
  }

  createManualItem(payload: LpManualItemPayload): Observable<LpEnvelope<LpManualItem>> {
    return this.http.post<LpEnvelope<LpManualItem>>(`${this.base}/manual-items`, payload);
  }

  updateManualItem(id: string, payload: LpManualItemPayload): Observable<LpEnvelope<LpManualItem>> {
    return this.http.put<LpEnvelope<LpManualItem>>(`${this.base}/manual-items/${id}`, payload);
  }

  deleteManualItem(id: string): Observable<LpEnvelope<unknown>> {
    return this.http.delete<LpEnvelope<unknown>>(`${this.base}/manual-items/${id}`);
  }

  // --- Settings ---

  getSettings(): Observable<LpEnvelope<LpSettings>> {
    return this.http.get<LpEnvelope<LpSettings>>(`${this.base}/settings`);
  }

  updateSettings(payload: LpSettings): Observable<LpEnvelope<LpSettings>> {
    return this.http.put<LpEnvelope<LpSettings>>(`${this.base}/settings`, payload);
  }

  // --- Alerts ---

  listAlerts(status?: LpAlertStatus): Observable<LpEnvelope<LpAlert[]>> {
    return this.http.get<LpEnvelope<LpAlert[]>>(`${this.base}/alerts`, {
      params: toHttpParams({ status }),
    });
  }

  evaluateAlerts(): Observable<LpEnvelope<LpAlert[]>> {
    return this.http.post<LpEnvelope<LpAlert[]>>(`${this.base}/alerts/evaluate`, {});
  }

  acknowledgeAlert(id: string): Observable<LpEnvelope<LpAlert>> {
    return this.http.post<LpEnvelope<LpAlert>>(`${this.base}/alerts/${id}/acknowledge`, {});
  }

  resolveAlert(id: string): Observable<LpEnvelope<LpAlert>> {
    return this.http.post<LpEnvelope<LpAlert>>(`${this.base}/alerts/${id}/resolve`, {});
  }
}
