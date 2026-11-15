import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import {
  PlanningBalance,
  PlanningCapacity,
  PlanningComparison,
  PlanningConstraint,
  PlanningConstraintRequest,
  PlanningCycleRequest,
  PlanningDashboard,
  PlanningImportResult,
  PlanningLine,
  PlanningLineRequest,
  PlanningLineType,
  PlanningPublication,
  PlanningRate,
  PlanningRateRequest,
  PlanningResource,
  PlanningResourceRequest,
  PlanningResponse,
  PlanningScenario,
  PlanningScenarioCopyRequest,
  PlanningScenarioFilters,
  PlanningScenarioRequest,
} from '../models';

@Service()
export class PlanningApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/planning`;

  getDashboard(scenarioId?: string): Observable<PlanningResponse<PlanningDashboard>> {
    return this.http.get<PlanningResponse<PlanningDashboard>>(`${this.base}/dashboard`, { params: this.params({ scenario_id: scenarioId }) });
  }

  // Scenarios
  getScenarios(filters?: PlanningScenarioFilters): Observable<PlanningResponse<PlanningScenario[]>> {
    return this.http.get<PlanningResponse<PlanningScenario[]>>(`${this.base}/scenarios`, { params: this.params(filters) });
  }

  getScenario(id: string): Observable<PlanningResponse<PlanningScenario>> {
    return this.http.get<PlanningResponse<PlanningScenario>>(`${this.base}/scenarios/${id}`);
  }

  createScenario(payload: PlanningScenarioRequest): Observable<PlanningResponse<PlanningScenario>> {
    return this.http.post<PlanningResponse<PlanningScenario>>(`${this.base}/scenarios`, payload);
  }

  updateScenario(id: string, payload: Partial<PlanningScenarioRequest>): Observable<PlanningResponse<PlanningScenario>> {
    return this.http.put<PlanningResponse<PlanningScenario>>(`${this.base}/scenarios/${id}`, payload);
  }

  deleteScenario(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/scenarios/${id}`);
  }

  copyScenario(id: string, payload: PlanningScenarioCopyRequest): Observable<PlanningResponse<PlanningScenario>> {
    return this.http.post<PlanningResponse<PlanningScenario>>(`${this.base}/scenarios/${id}/copy`, payload);
  }

  compareScenarios(baseId: string, otherId: string): Observable<PlanningResponse<PlanningComparison>> {
    return this.http.get<PlanningResponse<PlanningComparison>>(`${this.base}/scenarios/compare`, { params: this.params({ base_id: baseId, other_id: otherId }) });
  }

  // S&OP cycle
  submitScenario(id: string, payload: PlanningCycleRequest = {}): Observable<PlanningResponse<PlanningScenario>> {
    return this.http.post<PlanningResponse<PlanningScenario>>(`${this.base}/scenarios/${id}/submit`, payload);
  }

  approveScenario(id: string, payload: PlanningCycleRequest = {}): Observable<PlanningResponse<PlanningScenario>> {
    return this.http.post<PlanningResponse<PlanningScenario>>(`${this.base}/scenarios/${id}/approve`, payload);
  }

  rejectScenario(id: string, payload: PlanningCycleRequest): Observable<PlanningResponse<PlanningScenario>> {
    return this.http.post<PlanningResponse<PlanningScenario>>(`${this.base}/scenarios/${id}/reject`, payload);
  }

  lockScenario(id: string, payload: PlanningCycleRequest = {}): Observable<PlanningResponse<PlanningScenario>> {
    return this.http.post<PlanningResponse<PlanningScenario>>(`${this.base}/scenarios/${id}/lock`, payload);
  }

  publishScenario(id: string, payload: PlanningCycleRequest = {}): Observable<PlanningResponse<PlanningPublication>> {
    return this.http.post<PlanningResponse<PlanningPublication>>(`${this.base}/scenarios/${id}/publish`, payload);
  }

  getPublications(scenarioId?: string): Observable<PlanningResponse<PlanningPublication[]>> {
    return this.http.get<PlanningResponse<PlanningPublication[]>>(`${this.base}/publications`, { params: this.params({ scenario_id: scenarioId }) });
  }

  // Plan lines
  getLines(scenarioId: string, filters?: { line_type?: PlanningLineType; item_code?: string; per_page?: number }): Observable<PlanningResponse<PlanningLine[]>> {
    return this.http.get<PlanningResponse<PlanningLine[]>>(`${this.base}/scenarios/${scenarioId}/lines`, { params: this.params(filters) });
  }

  saveLine(scenarioId: string, payload: PlanningLineRequest): Observable<PlanningResponse<PlanningLine>> {
    return this.http.post<PlanningResponse<PlanningLine>>(`${this.base}/scenarios/${scenarioId}/lines`, payload);
  }

  updateLine(id: string, payload: Partial<PlanningLineRequest>): Observable<PlanningResponse<PlanningLine>> {
    return this.http.put<PlanningResponse<PlanningLine>>(`${this.base}/lines/${id}`, payload);
  }

  deleteLine(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/lines/${id}`);
  }

  importForecasts(scenarioId: string, overwrite: boolean): Observable<PlanningResponse<PlanningImportResult>> {
    return this.http.post<PlanningResponse<PlanningImportResult>>(`${this.base}/scenarios/${scenarioId}/import-forecasts`, { overwrite });
  }

  // Analysis
  getBalance(scenarioId: string, carryOver = true): Observable<PlanningResponse<PlanningBalance>> {
    return this.http.get<PlanningResponse<PlanningBalance>>(`${this.base}/scenarios/${scenarioId}/balance`, { params: this.params({ carry_over: carryOver ? 1 : 0 }) });
  }

  getCapacity(scenarioId: string): Observable<PlanningResponse<PlanningCapacity>> {
    return this.http.get<PlanningResponse<PlanningCapacity>>(`${this.base}/scenarios/${scenarioId}/capacity`);
  }

  // Capacity constraints
  getConstraints(scenarioId: string): Observable<PlanningResponse<PlanningConstraint[]>> {
    return this.http.get<PlanningResponse<PlanningConstraint[]>>(`${this.base}/scenarios/${scenarioId}/constraints`, { params: this.params({ per_page: 100 }) });
  }

  saveConstraint(scenarioId: string, payload: PlanningConstraintRequest): Observable<PlanningResponse<PlanningConstraint>> {
    return this.http.post<PlanningResponse<PlanningConstraint>>(`${this.base}/scenarios/${scenarioId}/constraints`, payload);
  }

  deleteConstraint(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/constraints/${id}`);
  }

  // Resources
  getResources(): Observable<PlanningResponse<PlanningResource[]>> {
    return this.http.get<PlanningResponse<PlanningResource[]>>(`${this.base}/resources`, { params: this.params({ per_page: 100 }) });
  }

  createResource(payload: PlanningResourceRequest): Observable<PlanningResponse<PlanningResource>> {
    return this.http.post<PlanningResponse<PlanningResource>>(`${this.base}/resources`, payload);
  }

  updateResource(id: string, payload: Partial<PlanningResourceRequest>): Observable<PlanningResponse<PlanningResource>> {
    return this.http.put<PlanningResponse<PlanningResource>>(`${this.base}/resources/${id}`, payload);
  }

  deleteResource(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/resources/${id}`);
  }

  createRate(resourceId: string, payload: PlanningRateRequest): Observable<PlanningResponse<PlanningRate>> {
    return this.http.post<PlanningResponse<PlanningRate>>(`${this.base}/resources/${resourceId}/rates`, payload);
  }

  updateRate(id: string, payload: Partial<PlanningRateRequest>): Observable<PlanningResponse<PlanningRate>> {
    return this.http.put<PlanningResponse<PlanningRate>>(`${this.base}/rates/${id}`, payload);
  }

  deleteRate(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/rates/${id}`);
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
