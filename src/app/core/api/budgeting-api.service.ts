import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import {
  BudgetApprovalRequest,
  BudgetDriver,
  BudgetDriverRequest,
  BudgetingDashboard,
  BudgetingResponse,
  BudgetPlanLine,
  BudgetLineRequest,
  BudgetReforecastRequest,
  BudgetSpreadRequest,
  BudgetScenarioComparison,
  BudgetVariance,
  BudgetVarianceGroup,
  BudgetVersion,
  BudgetVersionCopyRequest,
  BudgetVersionFilters,
  BudgetVersionRequest,
} from '../models';

@Service()
export class BudgetingApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/budgeting`;

  getDashboard(versionId?: string, throughPeriod?: number): Observable<BudgetingResponse<BudgetingDashboard>> {
    return this.http.get<BudgetingResponse<BudgetingDashboard>>(`${this.base}/dashboard`, { params: this.params({ version_id: versionId, through_period: throughPeriod }) });
  }

  // Versions
  getVersions(filters?: BudgetVersionFilters): Observable<BudgetingResponse<BudgetVersion[]>> {
    return this.http.get<BudgetingResponse<BudgetVersion[]>>(`${this.base}/versions`, { params: this.params(filters) });
  }

  getVersion(id: string): Observable<BudgetingResponse<BudgetVersion>> {
    return this.http.get<BudgetingResponse<BudgetVersion>>(`${this.base}/versions/${id}`);
  }

  createVersion(payload: BudgetVersionRequest): Observable<BudgetingResponse<BudgetVersion>> {
    return this.http.post<BudgetingResponse<BudgetVersion>>(`${this.base}/versions`, payload);
  }

  updateVersion(id: string, payload: Partial<BudgetVersionRequest>): Observable<BudgetingResponse<BudgetVersion>> {
    return this.http.put<BudgetingResponse<BudgetVersion>>(`${this.base}/versions/${id}`, payload);
  }

  deleteVersion(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/versions/${id}`);
  }

  copyVersion(id: string, payload: BudgetVersionCopyRequest): Observable<BudgetingResponse<BudgetVersion>> {
    return this.http.post<BudgetingResponse<BudgetVersion>>(`${this.base}/versions/${id}/copy`, payload);
  }

  reforecastVersion(id: string, payload: BudgetReforecastRequest): Observable<BudgetingResponse<BudgetVersion>> {
    return this.http.post<BudgetingResponse<BudgetVersion>>(`${this.base}/versions/${id}/reforecast`, payload);
  }

  // Approval workflow
  submitVersion(id: string, payload: BudgetApprovalRequest = {}): Observable<BudgetingResponse<BudgetVersion>> {
    return this.http.post<BudgetingResponse<BudgetVersion>>(`${this.base}/versions/${id}/submit`, payload);
  }

  approveVersion(id: string, payload: BudgetApprovalRequest = {}): Observable<BudgetingResponse<BudgetVersion>> {
    return this.http.post<BudgetingResponse<BudgetVersion>>(`${this.base}/versions/${id}/approve`, payload);
  }

  rejectVersion(id: string, payload: BudgetApprovalRequest): Observable<BudgetingResponse<BudgetVersion>> {
    return this.http.post<BudgetingResponse<BudgetVersion>>(`${this.base}/versions/${id}/reject`, payload);
  }

  lockVersion(id: string, payload: BudgetApprovalRequest = {}): Observable<BudgetingResponse<BudgetVersion>> {
    return this.http.post<BudgetingResponse<BudgetVersion>>(`${this.base}/versions/${id}/lock`, payload);
  }

  // Lines
  getLines(versionId: string, filters?: { account_id?: string; cost_center_id?: string; project_id?: string; period?: number; per_page?: number }): Observable<BudgetingResponse<BudgetPlanLine[]>> {
    return this.http.get<BudgetingResponse<BudgetPlanLine[]>>(`${this.base}/versions/${versionId}/lines`, { params: this.params(filters) });
  }

  saveLine(versionId: string, payload: BudgetLineRequest): Observable<BudgetingResponse<BudgetPlanLine>> {
    return this.http.post<BudgetingResponse<BudgetPlanLine>>(`${this.base}/versions/${versionId}/lines`, payload);
  }

  updateLine(id: string, payload: Partial<BudgetLineRequest>): Observable<BudgetingResponse<BudgetPlanLine>> {
    return this.http.put<BudgetingResponse<BudgetPlanLine>>(`${this.base}/lines/${id}`, payload);
  }

  deleteLine(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/lines/${id}`);
  }

  spread(versionId: string, payload: BudgetSpreadRequest): Observable<BudgetingResponse<BudgetPlanLine[]>> {
    return this.http.post<BudgetingResponse<BudgetPlanLine[]>>(`${this.base}/versions/${versionId}/spread`, payload);
  }

  // Drivers
  getDrivers(versionId: string): Observable<BudgetingResponse<BudgetDriver[]>> {
    return this.http.get<BudgetingResponse<BudgetDriver[]>>(`${this.base}/versions/${versionId}/drivers`, { params: this.params({ per_page: 100 }) });
  }

  createDriver(versionId: string, payload: BudgetDriverRequest): Observable<BudgetingResponse<BudgetDriver>> {
    return this.http.post<BudgetingResponse<BudgetDriver>>(`${this.base}/versions/${versionId}/drivers`, payload);
  }

  updateDriver(id: string, payload: Partial<BudgetDriverRequest>): Observable<BudgetingResponse<BudgetDriver>> {
    return this.http.put<BudgetingResponse<BudgetDriver>>(`${this.base}/drivers/${id}`, payload);
  }

  deleteDriver(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/drivers/${id}`);
  }

  generateDriver(id: string): Observable<BudgetingResponse<BudgetPlanLine[]>> {
    return this.http.post<BudgetingResponse<BudgetPlanLine[]>>(`${this.base}/drivers/${id}/generate`, {});
  }

  generateDrivers(versionId: string): Observable<BudgetingResponse<{ drivers: number; lines: number }>> {
    return this.http.post<BudgetingResponse<{ drivers: number; lines: number }>>(`${this.base}/versions/${versionId}/generate-drivers`, {});
  }

  // Budget versus actual
  /** Budget of the version against the budget of another version (scenario compare). */
  compareScenarios(versionId: string, withVersionId: string, throughPeriod?: number, groupBy?: BudgetVarianceGroup): Observable<BudgetingResponse<BudgetScenarioComparison>> {
    return this.http.get<BudgetingResponse<BudgetScenarioComparison>>(`${this.base}/versions/${versionId}/compare`, { params: this.params({ with: withVersionId, through_period: throughPeriod, group_by: groupBy }) });
  }

  getVariance(versionId: string, throughPeriod?: number, groupBy?: BudgetVarianceGroup): Observable<BudgetingResponse<BudgetVariance>> {
    return this.http.get<BudgetingResponse<BudgetVariance>>(`${this.base}/versions/${versionId}/variance`, { params: this.params({ through_period: throughPeriod, group_by: groupBy }) });
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
