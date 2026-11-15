import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import {
  EsgActivityFilters,
  EsgActivityRecord,
  EsgActivityRecordRequest,
  EsgEmissionFactor,
  EsgEmissionFactorRequest,
  EsgEsrsCompleteness,
  EsgEsrsDatapoint,
  EsgEsrsPackage,
  EsgEsrsValue,
  EsgEsrsValueLine,
  EsgFactorVersionRequest,
  EsgInventory,
  EsgKpiDefinition,
  EsgKpiDefinitionRequest,
  EsgKpiValue,
  EsgKpiValueRequest,
  EsgMaterialityAssessment,
  EsgMaterialityAssessmentRequest,
  EsgReductionTarget,
  EsgReductionTargetRequest,
  EsgReportingPeriod,
  EsgReportingPeriodRequest,
  EsgResponse,
  EsgScope3Report,
  EsgSupplierReceivePayload,
  EsgSupplierRequest,
  EsgSupplierRequestPayload,
} from '../models';

@Service()
export class SustainabilityApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/sustainability`;

  // Emission factors
  getFactors(filters?: {
    activity_type?: string;
    region?: string;
    is_active?: boolean;
    search?: string;
    latest_only?: boolean;
    per_page?: number;
  }): Observable<EsgResponse<EsgEmissionFactor[]>> {
    return this.http.get<EsgResponse<EsgEmissionFactor[]>>(`${this.base}/factors`, {
      params: this.params(filters),
    });
  }

  createFactor(payload: EsgEmissionFactorRequest): Observable<EsgResponse<EsgEmissionFactor>> {
    return this.http.post<EsgResponse<EsgEmissionFactor>>(`${this.base}/factors`, payload);
  }

  updateFactor(
    id: string,
    payload: Partial<EsgEmissionFactorRequest>,
  ): Observable<EsgResponse<EsgEmissionFactor>> {
    return this.http.put<EsgResponse<EsgEmissionFactor>>(`${this.base}/factors/${id}`, payload);
  }

  newFactorVersion(
    id: string,
    payload: EsgFactorVersionRequest,
  ): Observable<EsgResponse<EsgEmissionFactor>> {
    return this.http.post<EsgResponse<EsgEmissionFactor>>(`${this.base}/factors/${id}/new-version`, payload);
  }

  deleteFactor(id: string): Observable<EsgResponse<EsgEmissionFactor> | null> {
    return this.http.delete<EsgResponse<EsgEmissionFactor> | null>(`${this.base}/factors/${id}`);
  }

  installExampleFactors(): Observable<{ created: number }> {
    return this.http.post<{ created: number }>(`${this.base}/factors/install-examples`, {});
  }

  // Reporting periods
  getPeriods(): Observable<EsgResponse<EsgReportingPeriod[]>> {
    return this.http.get<EsgResponse<EsgReportingPeriod[]>>(`${this.base}/periods`, {
      params: this.params({ per_page: 100 }),
    });
  }

  createPeriod(payload: EsgReportingPeriodRequest): Observable<EsgResponse<EsgReportingPeriod>> {
    return this.http.post<EsgResponse<EsgReportingPeriod>>(`${this.base}/periods`, payload);
  }

  updatePeriod(
    id: string,
    payload: Partial<EsgReportingPeriodRequest>,
  ): Observable<EsgResponse<EsgReportingPeriod>> {
    return this.http.put<EsgResponse<EsgReportingPeriod>>(`${this.base}/periods/${id}`, payload);
  }

  closePeriod(id: string): Observable<EsgResponse<EsgReportingPeriod>> {
    return this.http.post<EsgResponse<EsgReportingPeriod>>(`${this.base}/periods/${id}/close`, {});
  }

  reopenPeriod(id: string): Observable<EsgResponse<EsgReportingPeriod>> {
    return this.http.post<EsgResponse<EsgReportingPeriod>>(`${this.base}/periods/${id}/reopen`, {});
  }

  // Activity data
  getActivityRecords(filters?: EsgActivityFilters): Observable<EsgResponse<EsgActivityRecord[]>> {
    return this.http.get<EsgResponse<EsgActivityRecord[]>>(`${this.base}/activity-records`, {
      params: this.params(filters),
    });
  }

  createActivityRecord(payload: EsgActivityRecordRequest): Observable<EsgResponse<EsgActivityRecord>> {
    return this.http.post<EsgResponse<EsgActivityRecord>>(`${this.base}/activity-records`, payload);
  }

  bulkCreateActivityRecords(
    lines: EsgActivityRecordRequest[],
  ): Observable<EsgResponse<EsgActivityRecord[]>> {
    return this.http.post<EsgResponse<EsgActivityRecord[]>>(`${this.base}/activity-records/bulk`, { lines });
  }

  updateActivityRecord(
    id: string,
    payload: Partial<EsgActivityRecordRequest>,
  ): Observable<EsgResponse<EsgActivityRecord>> {
    return this.http.put<EsgResponse<EsgActivityRecord>>(`${this.base}/activity-records/${id}`, payload);
  }

  deleteActivityRecord(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/activity-records/${id}`);
  }

  // Inventory
  getInventory(reportingPeriodId?: string): Observable<EsgResponse<EsgInventory | null>> {
    return this.http.get<EsgResponse<EsgInventory | null>>(`${this.base}/inventory`, {
      params: this.params({ reporting_period_id: reportingPeriodId }),
    });
  }

  // Reduction targets
  getTargets(): Observable<EsgResponse<EsgReductionTarget[]>> {
    return this.http.get<EsgResponse<EsgReductionTarget[]>>(`${this.base}/targets`, {
      params: this.params({ per_page: 100 }),
    });
  }

  createTarget(payload: EsgReductionTargetRequest): Observable<EsgResponse<EsgReductionTarget>> {
    return this.http.post<EsgResponse<EsgReductionTarget>>(`${this.base}/targets`, payload);
  }

  updateTarget(
    id: string,
    payload: Partial<EsgReductionTargetRequest>,
  ): Observable<EsgResponse<EsgReductionTarget>> {
    return this.http.put<EsgResponse<EsgReductionTarget>>(`${this.base}/targets/${id}`, payload);
  }

  activateTarget(id: string): Observable<EsgResponse<EsgReductionTarget>> {
    return this.http.post<EsgResponse<EsgReductionTarget>>(`${this.base}/targets/${id}/activate`, {});
  }

  evaluateTarget(id: string): Observable<EsgResponse<EsgReductionTarget>> {
    return this.http.post<EsgResponse<EsgReductionTarget>>(`${this.base}/targets/${id}/evaluate`, {});
  }

  cancelTarget(id: string): Observable<EsgResponse<EsgReductionTarget>> {
    return this.http.post<EsgResponse<EsgReductionTarget>>(`${this.base}/targets/${id}/cancel`, {});
  }

  // ESG KPIs
  getKpiDefinitions(filters?: { pillar?: string; is_active?: boolean }): Observable<EsgResponse<EsgKpiDefinition[]>> {
    return this.http.get<EsgResponse<EsgKpiDefinition[]>>(`${this.base}/kpis`, {
      params: this.params(filters),
    });
  }

  createKpiDefinition(payload: EsgKpiDefinitionRequest): Observable<EsgResponse<EsgKpiDefinition>> {
    return this.http.post<EsgResponse<EsgKpiDefinition>>(`${this.base}/kpis`, payload);
  }

  updateKpiDefinition(
    id: string,
    payload: Partial<EsgKpiDefinitionRequest>,
  ): Observable<EsgResponse<EsgKpiDefinition>> {
    return this.http.put<EsgResponse<EsgKpiDefinition>>(`${this.base}/kpis/${id}`, payload);
  }

  installDefaultKpis(): Observable<{ created: number }> {
    return this.http.post<{ created: number }>(`${this.base}/kpis/install-defaults`, {});
  }

  getKpiValues(reportingPeriodId?: string): Observable<EsgResponse<EsgKpiValue[]>> {
    return this.http.get<EsgResponse<EsgKpiValue[]>>(`${this.base}/kpi-values`, {
      params: this.params({ reporting_period_id: reportingPeriodId }),
    });
  }

  recordKpiValue(payload: EsgKpiValueRequest): Observable<EsgResponse<EsgKpiValue>> {
    return this.http.put<EsgResponse<EsgKpiValue>>(`${this.base}/kpi-values`, payload);
  }

  // Double materiality
  getMaterialityAssessments(): Observable<EsgResponse<EsgMaterialityAssessment[]>> {
    return this.http.get<EsgResponse<EsgMaterialityAssessment[]>>(`${this.base}/materiality-assessments`);
  }

  createMaterialityAssessment(
    payload: EsgMaterialityAssessmentRequest,
  ): Observable<EsgResponse<EsgMaterialityAssessment>> {
    return this.http.post<EsgResponse<EsgMaterialityAssessment>>(`${this.base}/materiality-assessments`, payload);
  }

  updateMaterialityAssessment(
    id: string,
    payload: Partial<EsgMaterialityAssessmentRequest>,
  ): Observable<EsgResponse<EsgMaterialityAssessment>> {
    return this.http.put<EsgResponse<EsgMaterialityAssessment>>(
      `${this.base}/materiality-assessments/${id}`,
      payload,
    );
  }

  approveMaterialityAssessment(id: string): Observable<EsgResponse<EsgMaterialityAssessment>> {
    return this.http.post<EsgResponse<EsgMaterialityAssessment>>(
      `${this.base}/materiality-assessments/${id}/approve`,
      {},
    );
  }

  // ESRS reporting package
  getEsrsDatapoints(filters?: { standard?: string; active?: boolean }): Observable<EsgResponse<EsgEsrsDatapoint[]>> {
    return this.http.get<EsgResponse<EsgEsrsDatapoint[]>>(`${this.base}/esrs/datapoints`, { params: this.params(filters) });
  }

  installEsrsCatalog(): Observable<{ created: number }> {
    return this.http.post<{ created: number }>(`${this.base}/esrs/install-catalog`, {});
  }

  getEsrsPackage(periodId: string, standard?: string): Observable<EsgResponse<EsgEsrsPackage>> {
    return this.http.get<EsgResponse<EsgEsrsPackage>>(`${this.base}/periods/${periodId}/esrs`, {
      params: this.params({ standard }),
    });
  }

  recordEsrsValues(periodId: string, values: EsgEsrsValueLine[]): Observable<EsgResponse<EsgEsrsValue[]>> {
    return this.http.put<EsgResponse<EsgEsrsValue[]>>(`${this.base}/periods/${periodId}/esrs/values`, { values });
  }

  syncEsrsFromInventory(periodId: string): Observable<{ updated: number; skipped_approved: number }> {
    return this.http.post<{ updated: number; skipped_approved: number }>(
      `${this.base}/periods/${periodId}/esrs/sync-inventory`,
      {},
    );
  }

  getEsrsCompleteness(periodId: string): Observable<EsgResponse<EsgEsrsCompleteness>> {
    return this.http.get<EsgResponse<EsgEsrsCompleteness>>(`${this.base}/periods/${periodId}/esrs/completeness`);
  }

  // Scope 3 and supplier-specific data
  getScope3(periodId: string): Observable<EsgResponse<EsgScope3Report>> {
    return this.http.get<EsgResponse<EsgScope3Report>>(`${this.base}/periods/${periodId}/scope3`);
  }

  getSupplierRequests(filters?: {
    reporting_period_id?: string;
    status?: string;
    per_page?: number;
  }): Observable<EsgResponse<EsgSupplierRequest[]>> {
    return this.http.get<EsgResponse<EsgSupplierRequest[]>>(`${this.base}/supplier-requests`, {
      params: this.params(filters),
    });
  }

  createSupplierRequest(payload: EsgSupplierRequestPayload): Observable<EsgResponse<EsgSupplierRequest>> {
    return this.http.post<EsgResponse<EsgSupplierRequest>>(`${this.base}/supplier-requests`, payload);
  }

  receiveSupplierRequest(id: string, payload: EsgSupplierReceivePayload): Observable<EsgResponse<EsgSupplierRequest>> {
    return this.http.post<EsgResponse<EsgSupplierRequest>>(`${this.base}/supplier-requests/${id}/receive`, payload);
  }

  applySupplierRequest(id: string): Observable<EsgResponse<EsgSupplierRequest>> {
    return this.http.post<EsgResponse<EsgSupplierRequest>>(`${this.base}/supplier-requests/${id}/apply`, {});
  }

  declineSupplierRequest(id: string): Observable<EsgResponse<EsgSupplierRequest>> {
    return this.http.post<EsgResponse<EsgSupplierRequest>>(`${this.base}/supplier-requests/${id}/decline`, {});
  }

  cancelSupplierRequest(id: string): Observable<EsgResponse<EsgSupplierRequest>> {
    return this.http.post<EsgResponse<EsgSupplierRequest>>(`${this.base}/supplier-requests/${id}/cancel`, {});
  }

  private params(values?: object): HttpParams {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(values ?? {})) {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, typeof value === 'boolean' ? (value ? '1' : '0') : String(value));
      }
    }
    return params;
  }
}
