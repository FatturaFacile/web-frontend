import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import {
  AvailabilityFilters,
  BudgetActualVolume,
  BudgetActualVolumeRequest,
  BudgetApprovalRequest,
  BudgetAuditEvent,
  BudgetAvailability,
  BudgetCommitment,
  BudgetDecomposition,
  BudgetDimensionFilters,
  BudgetGrid,
  BudgetGridCellRequest,
  BudgetImport,
  BudgetOverride,
  BudgetOverrideDecisionRequest,
  BudgetOverrideFilters,
  BudgetOverrideRequest,
  BudgetReviseRequest,
  BudgetRollForwardRequest,
  BudgetScenarioRequest,
  BudgetSettings,
  BudgetTransferRequest,
  CommitmentFilters,
  DecompositionGroup,
  ImportMode,
  SpendCheckFilters,
  SpendCheckLog,
  SpendCheckRequest,
  SpendDecision,
  SpendRule,
  SpendRuleRequest,
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

  getVariance(versionId: string, throughPeriod?: number, groupBy?: BudgetVarianceGroup, filters?: BudgetDimensionFilters): Observable<BudgetingResponse<BudgetVariance>> {
    return this.http.get<BudgetingResponse<BudgetVariance>>(`${this.base}/versions/${versionId}/variance`, { params: this.params({ through_period: throughPeriod, group_by: groupBy, ...filters }) });
  }

  /** The variance split into a volume and a price effect. */
  getDecomposition(versionId: string, throughPeriod?: number, groupBy?: DecompositionGroup, filters?: BudgetDimensionFilters): Observable<BudgetingResponse<BudgetDecomposition>> {
    return this.http.get<BudgetingResponse<BudgetDecomposition>>(`${this.base}/versions/${versionId}/variance/decomposition`, { params: this.params({ through_period: throughPeriod, group_by: groupBy, ...filters }) });
  }

  // Grid, revisions, scenarios, transfers, roll forward, audit
  getGrid(versionId: string): Observable<BudgetingResponse<BudgetGrid>> {
    return this.http.get<BudgetingResponse<BudgetGrid>>(`${this.base}/versions/${versionId}/grid`);
  }

  saveGrid(versionId: string, cells: BudgetGridCellRequest[]): Observable<BudgetingResponse<{ saved: number }>> {
    return this.http.put<BudgetingResponse<{ saved: number }>>(`${this.base}/versions/${versionId}/grid`, { cells });
  }

  reviseVersion(versionId: string, payload: BudgetReviseRequest): Observable<BudgetingResponse<BudgetVersion>> {
    return this.http.post<BudgetingResponse<BudgetVersion>>(`${this.base}/versions/${versionId}/revise`, payload);
  }

  createScenario(versionId: string, payload: BudgetScenarioRequest): Observable<BudgetingResponse<BudgetVersion>> {
    return this.http.post<BudgetingResponse<BudgetVersion>>(`${this.base}/versions/${versionId}/scenario`, payload);
  }

  transferBudget(versionId: string, payload: BudgetTransferRequest): Observable<void> {
    return this.http.post<void>(`${this.base}/versions/${versionId}/transfer`, payload);
  }

  rollForward(versionId: string, payload: BudgetRollForwardRequest): Observable<BudgetingResponse<BudgetVersion>> {
    return this.http.post<BudgetingResponse<BudgetVersion>>(`${this.base}/versions/${versionId}/roll-forward`, payload);
  }

  getVersionAudit(versionId: string): Observable<BudgetingResponse<BudgetAuditEvent[]>> {
    return this.http.get<BudgetingResponse<BudgetAuditEvent[]>>(`${this.base}/versions/${versionId}/audit`);
  }

  // Excel import and executive pack
  downloadImportTemplate(versionId: string): Observable<Blob> {
    return this.http.get(`${this.base}/versions/${versionId}/import-template`, { responseType: 'blob' });
  }

  importBudget(versionId: string, file: File, mode: ImportMode, validateOnly: boolean): Observable<BudgetingResponse<BudgetImport>> {
    const body = new FormData();
    body.append('file', file);
    body.append('mode', mode);
    body.append('validate_only', validateOnly ? '1' : '0');
    return this.http.post<BudgetingResponse<BudgetImport>>(`${this.base}/versions/${versionId}/import`, body);
  }

  getImports(versionId: string): Observable<BudgetingResponse<BudgetImport[]>> {
    return this.http.get<BudgetingResponse<BudgetImport[]>>(`${this.base}/versions/${versionId}/imports`);
  }

  downloadExecutivePack(versionId: string, throughPeriod?: number): Observable<Blob> {
    return this.http.get(`${this.base}/versions/${versionId}/executive-pack`, { params: this.params({ through_period: throughPeriod }), responseType: 'blob' });
  }

  // Actual volumes
  getActualVolumes(filters?: BudgetDimensionFilters & { month?: string; per_page?: number }): Observable<BudgetingResponse<BudgetActualVolume[]>> {
    return this.http.get<BudgetingResponse<BudgetActualVolume[]>>(`${this.base}/actual-volumes`, { params: this.params(filters) });
  }

  saveActualVolume(payload: BudgetActualVolumeRequest): Observable<BudgetingResponse<BudgetActualVolume>> {
    return this.http.post<BudgetingResponse<BudgetActualVolume>>(`${this.base}/actual-volumes`, payload);
  }

  deleteActualVolume(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/actual-volumes/${id}`);
  }

  // Spend control
  getAvailability(filters?: AvailabilityFilters): Observable<BudgetingResponse<BudgetAvailability>> {
    return this.http.get<BudgetingResponse<BudgetAvailability>>(`${this.base}/spend-control/availability`, { params: this.params(filters) });
  }

  checkSpend(payload: SpendCheckRequest): Observable<BudgetingResponse<SpendDecision>> {
    return this.http.post<BudgetingResponse<SpendDecision>>(`${this.base}/spend-control/check`, payload);
  }

  getCommitments(filters?: CommitmentFilters): Observable<BudgetingResponse<BudgetCommitment[]>> {
    return this.http.get<BudgetingResponse<BudgetCommitment[]>>(`${this.base}/spend-control/commitments`, { params: this.params(filters) });
  }

  getSpendChecks(filters?: SpendCheckFilters): Observable<BudgetingResponse<SpendCheckLog[]>> {
    return this.http.get<BudgetingResponse<SpendCheckLog[]>>(`${this.base}/spend-control/checks`, { params: this.params(filters) });
  }

  getSettings(): Observable<BudgetingResponse<BudgetSettings>> {
    return this.http.get<BudgetingResponse<BudgetSettings>>(`${this.base}/spend-control/settings`);
  }

  updateSettings(payload: Partial<BudgetSettings>): Observable<BudgetingResponse<BudgetSettings>> {
    return this.http.put<BudgetingResponse<BudgetSettings>>(`${this.base}/spend-control/settings`, payload);
  }

  getRules(): Observable<BudgetingResponse<SpendRule[]>> {
    return this.http.get<BudgetingResponse<SpendRule[]>>(`${this.base}/spend-control/rules`, { params: this.params({ per_page: 100 }) });
  }

  createRule(payload: SpendRuleRequest): Observable<BudgetingResponse<SpendRule>> {
    return this.http.post<BudgetingResponse<SpendRule>>(`${this.base}/spend-control/rules`, payload);
  }

  updateRule(id: string, payload: Partial<SpendRuleRequest>): Observable<BudgetingResponse<SpendRule>> {
    return this.http.put<BudgetingResponse<SpendRule>>(`${this.base}/spend-control/rules/${id}`, payload);
  }

  deleteRule(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/spend-control/rules/${id}`);
  }

  // Overrides (deroga)
  getOverrides(filters?: BudgetOverrideFilters): Observable<BudgetingResponse<BudgetOverride[]>> {
    return this.http.get<BudgetingResponse<BudgetOverride[]>>(`${this.base}/spend-control/overrides`, { params: this.params(filters) });
  }

  requestOverride(payload: BudgetOverrideRequest): Observable<BudgetingResponse<BudgetOverride>> {
    return this.http.post<BudgetingResponse<BudgetOverride>>(`${this.base}/spend-control/overrides`, payload);
  }

  approveOverride(id: string, payload: BudgetOverrideDecisionRequest = {}): Observable<BudgetingResponse<BudgetOverride>> {
    return this.http.post<BudgetingResponse<BudgetOverride>>(`${this.base}/spend-control/overrides/${id}/approve`, payload);
  }

  rejectOverride(id: string, payload: BudgetOverrideDecisionRequest): Observable<BudgetingResponse<BudgetOverride>> {
    return this.http.post<BudgetingResponse<BudgetOverride>>(`${this.base}/spend-control/overrides/${id}/reject`, payload);
  }

  cancelOverride(id: string, payload: BudgetOverrideDecisionRequest = {}): Observable<BudgetingResponse<BudgetOverride>> {
    return this.http.post<BudgetingResponse<BudgetOverride>>(`${this.base}/spend-control/overrides/${id}/cancel`, payload);
  }

  getOverrideHistory(id: string): Observable<BudgetingResponse<BudgetAuditEvent[]>> {
    return this.http.get<BudgetingResponse<BudgetAuditEvent[]>>(`${this.base}/spend-control/overrides/${id}/history`);
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
