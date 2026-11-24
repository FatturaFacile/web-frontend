import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { toHttpParams } from '../../core/http/laravel-http.utils';
import {
  AuditsOverview,
  ClearanceContext,
  DvrPayload,
  MsslAuditPayload,
  RequirementMatrix,
  RequirementMatrixPayload,
  ClearanceResult,
  Envelope,
  IncidentPayload,
  IncidentReport,
  MatrixFilters,
  MatrixMeta,
  MatrixRow,
  PpeDistribution,
  PpeIssuePayload,
} from './hse.models';

/** HTTP access to `/api/v1/hse` (Mod 099: workplace health, safety and mandatory training). */
@Service()
export class HseApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/hse`;

  complianceMatrix(filters: MatrixFilters): Observable<Envelope<MatrixRow[], MatrixMeta>> {
    return this.http.get<Envelope<MatrixRow[], MatrixMeta>>(`${this.base}/compliance-matrix`, {
      params: toHttpParams({
        page: filters.page,
        per_page: filters.perPage,
        department_id: filters.departmentId,
        work_center_id: filters.workCenterId,
        construction_site_id: filters.constructionSiteId,
        status: filters.status,
        jurisdiction: filters.jurisdiction,
      }),
    });
  }

  /** The hard-block verdict that dispatch screens (MES, field service, construction sites) ask before they assign a worker. */
  clearance(query: {
    employeeId: string;
    contextType: ClearanceContext;
    targetId: string;
    scheduledAt: string;
  }): Observable<Envelope<ClearanceResult>> {
    return this.http.get<Envelope<ClearanceResult>>(`${this.base}/clearance`, {
      params: toHttpParams({
        employee_id: query.employeeId,
        target_context_type: query.contextType,
        target_id: query.targetId,
        scheduled_date_time: query.scheduledAt,
      }),
    });
  }

  issuePpe(payload: PpeIssuePayload): Observable<Envelope<PpeDistribution>> {
    return this.http.post<Envelope<PpeDistribution>>(`${this.base}/ppe-distributions`, payload);
  }

  ppeDistributions(employeeId?: string): Observable<Envelope<PpeDistribution[]>> {
    return this.http.get<Envelope<PpeDistribution[]>>(`${this.base}/ppe-distributions`, {
      params: toHttpParams({ employee_id: employeeId }),
    });
  }

  /** The signed hand-over record as a PDF. */
  verbale(distributionId: string): Observable<Blob> {
    return this.http.get(`${this.base}/ppe-distributions/${distributionId}/verbale`, {
      responseType: 'blob',
    });
  }

  incidents(): Observable<Envelope<IncidentReport[]>> {
    return this.http.get<Envelope<IncidentReport[]>>(`${this.base}/incidents`);
  }

  reportIncident(payload: IncidentPayload): Observable<Envelope<IncidentReport>> {
    return this.http.post<Envelope<IncidentReport>>(`${this.base}/incidents`, payload);
  }

  requirementMatrices(): Observable<Envelope<RequirementMatrix[]>> {
    return this.http.get<Envelope<RequirementMatrix[]>>(`${this.base}/requirement-matrices`);
  }

  saveRequirementMatrix(
    payload: RequirementMatrixPayload,
    id?: string,
  ): Observable<Envelope<RequirementMatrix>> {
    return id
      ? this.http.put<Envelope<RequirementMatrix>>(
          `${this.base}/requirement-matrices/${id}`,
          payload,
        )
      : this.http.post<Envelope<RequirementMatrix>>(`${this.base}/requirement-matrices`, payload);
  }

  audits(): Observable<Envelope<AuditsOverview>> {
    return this.http.get<Envelope<AuditsOverview>>(`${this.base}/audits`);
  }

  saveMsslAudit(
    payload: MsslAuditPayload,
  ): Observable<Envelope<{ id: string; score_percent: number; status: string }>> {
    return this.http.post<Envelope<{ id: string; score_percent: number; status: string }>>(
      `${this.base}/audits/mssl`,
      payload,
    );
  }

  registerDvr(
    payload: DvrPayload,
  ): Observable<Envelope<{ id: string; revision_number: number; status: string }>> {
    return this.http.post<Envelope<{ id: string; revision_number: number; status: string }>>(
      `${this.base}/audits/dvr`,
      payload,
    );
  }
}
