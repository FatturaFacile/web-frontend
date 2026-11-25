import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { map, Observable } from 'rxjs';
import {
  PlmBomDiffCostRollupResult,
  PlmCadImportRequest,
  PlmCadImportSession,
  PlmChangeOrder,
  PlmChangeOrderFilters,
  PlmChangeOrderRequest,
  PlmDecisionRequest,
  PlmDepartmentSignoffRequest,
  PlmEcoWorkflowStage,
  PlmItemRevision,
  PlmItemRevisionFilters,
  PlmItemRevisionRequest,
  PlmOption,
  PlmRegulatoryComplianceResult,
  PlmResponse,
  PlmViewerManifest,
  PlmWhereUsedImpactResult,
} from '../models';

@Service()
export class PlmApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/plm`;

  getDictionary(locale?: string): Observable<PlmResponse<{ locale: string; translations: Record<string, string>; enums: Record<string, string[]> }>> {
    return this.http.get<PlmResponse<{ locale: string; translations: Record<string, string>; enums: Record<string, string[]> }>>(
      `${this.base}/dictionary`,
      { params: this.params({ locale }) },
    );
  }

  // Change orders (ECR / ECO / ECN)
  getChangeOrders(filters?: PlmChangeOrderFilters): Observable<PlmResponse<PlmChangeOrder[]>> {
    return this.http.get<PlmResponse<PlmChangeOrder[]>>(`${this.base}/change-orders`, { params: this.params(filters) });
  }

  getChangeOrder(id: string): Observable<PlmResponse<PlmChangeOrder>> {
    return this.http.get<PlmResponse<PlmChangeOrder>>(`${this.base}/change-orders/${id}`);
  }

  createChangeOrder(payload: PlmChangeOrderRequest): Observable<PlmResponse<PlmChangeOrder>> {
    return this.http.post<PlmResponse<PlmChangeOrder>>(`${this.base}/change-orders`, payload);
  }

  updateChangeOrder(id: string, payload: Partial<PlmChangeOrderRequest>): Observable<PlmResponse<PlmChangeOrder>> {
    return this.http.put<PlmResponse<PlmChangeOrder>>(`${this.base}/change-orders/${id}`, payload);
  }

  deleteChangeOrder(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/change-orders/${id}`);
  }

  submitChangeOrder(id: string): Observable<PlmResponse<PlmChangeOrder>> {
    return this.http.post<PlmResponse<PlmChangeOrder>>(`${this.base}/change-orders/${id}/submit`, {});
  }

  decideChangeOrder(id: string, payload: PlmDecisionRequest): Observable<PlmResponse<PlmChangeOrder>> {
    return this.http.post<PlmResponse<PlmChangeOrder>>(`${this.base}/change-orders/${id}/decide`, payload);
  }

  cancelChangeOrder(id: string): Observable<PlmResponse<PlmChangeOrder>> {
    return this.http.post<PlmResponse<PlmChangeOrder>>(`${this.base}/change-orders/${id}/cancel`, {});
  }

  implementChangeOrder(id: string): Observable<PlmResponse<PlmChangeOrder>> {
    return this.http.post<PlmResponse<PlmChangeOrder>>(`${this.base}/change-orders/${id}/implement`, {});
  }

  advanceStage(id: string, workflowStage: PlmEcoWorkflowStage): Observable<PlmResponse<PlmChangeOrder>> {
    return this.http.post<PlmResponse<PlmChangeOrder>>(`${this.base}/change-orders/${id}/advance-stage`, { workflow_stage: workflowStage });
  }

  recordDepartmentSignoff(id: string, payload: PlmDepartmentSignoffRequest): Observable<PlmResponse<PlmChangeOrder>> {
    return this.http.post<PlmResponse<PlmChangeOrder>>(`${this.base}/change-orders/${id}/department-signoff`, payload);
  }

  executeCutover(id: string, payload?: { force_immediate_safety_cutover?: boolean; lot_serial_cutover_code?: string | null }): Observable<PlmResponse<PlmChangeOrder>> {
    return this.http.post<PlmResponse<PlmChangeOrder>>(`${this.base}/change-orders/${id}/execute-cutover`, payload ?? {});
  }

  // Item revisions
  getRevisions(filters?: PlmItemRevisionFilters): Observable<PlmResponse<PlmItemRevision[]>> {
    return this.http.get<PlmResponse<PlmItemRevision[]>>(`${this.base}/revisions`, { params: this.params(filters) });
  }

  getRevision(id: string): Observable<PlmResponse<PlmItemRevision>> {
    return this.http.get<PlmResponse<PlmItemRevision>>(`${this.base}/revisions/${id}`);
  }

  createRevision(payload: PlmItemRevisionRequest): Observable<PlmResponse<PlmItemRevision>> {
    return this.http.post<PlmResponse<PlmItemRevision>>(`${this.base}/revisions`, payload);
  }

  updateRevision(id: string, payload: Partial<PlmItemRevisionRequest>): Observable<PlmResponse<PlmItemRevision>> {
    return this.http.put<PlmResponse<PlmItemRevision>>(`${this.base}/revisions/${id}`, payload);
  }

  deleteRevision(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/revisions/${id}`);
  }

  releaseRevision(id: string): Observable<PlmResponse<PlmItemRevision>> {
    return this.http.post<PlmResponse<PlmItemRevision>>(`${this.base}/revisions/${id}/release`, {});
  }

  obsoleteRevision(id: string): Observable<PlmResponse<PlmItemRevision>> {
    return this.http.post<PlmResponse<PlmItemRevision>>(`${this.base}/revisions/${id}/obsolete`, {});
  }

  getRevisionCompliance(id: string, strategy?: string): Observable<PlmResponse<PlmRegulatoryComplianceResult>> {
    return this.http.get<PlmResponse<PlmRegulatoryComplianceResult>>(`${this.base}/revisions/${id}/compliance`, { params: this.params({ strategy }) });
  }

  updateRevisionCompliance(id: string, payload: Record<string, unknown>): Observable<PlmResponse<PlmRegulatoryComplianceResult>> {
    return this.http.post<PlmResponse<PlmRegulatoryComplianceResult>>(`${this.base}/revisions/${id}/compliance`, payload);
  }

  getViewerManifest(id: string): Observable<PlmResponse<PlmViewerManifest>> {
    return this.http.get<PlmResponse<PlmViewerManifest>>(`${this.base}/revisions/${id}/viewer-manifest`);
  }

  // CAD import sessions
  getCadImportSessions(): Observable<PlmResponse<PlmCadImportSession[]>> {
    return this.http.get<PlmResponse<PlmCadImportSession[]>>(`${this.base}/cad-imports`);
  }

  importCadBom(payload: PlmCadImportRequest): Observable<PlmResponse<PlmCadImportSession>> {
    return this.http.post<PlmResponse<PlmCadImportSession>>(`${this.base}/cad-imports`, payload);
  }

  commitCadImport(id: string): Observable<PlmResponse<PlmCadImportSession>> {
    return this.http.post<PlmResponse<PlmCadImportSession>>(`${this.base}/cad-imports/${id}/commit`, {});
  }

  // Where-Used & BOM Diff
  getWhereUsedImpact(itemId: string, date?: string): Observable<PlmResponse<PlmWhereUsedImpactResult>> {
    return this.http.get<PlmResponse<PlmWhereUsedImpactResult>>(`${this.base}/where-used/${itemId}`, { params: this.params({ date }) });
  }

  getBomDiffAndCostRollup(params: {
    from_bom_id?: string;
    to_bom_id?: string;
    from_revision_id?: string;
    to_revision_id?: string;
    revision_id?: string;
  }): Observable<PlmResponse<PlmBomDiffCostRollupResult>> {
    return this.http.get<PlmResponse<PlmBomDiffCostRollupResult>>(`${this.base}/bom-diff`, { params: this.params(params) });
  }

  // Lookups of the manufacturing module the forms pick from
  getItemOptions(): Observable<PlmOption[]> {
    return this.http
      .get<{ data: { id: string; item_code: string; name: string }[] }>(`${environment.apiBaseUrl}/manufacturing/items`, { params: this.params({ per_page: 100 }) })
      .pipe(map((response) => response.data.map((item) => ({ id: item.id, label: `${item.item_code} - ${item.name}` }))));
  }

  getBomOptions(): Observable<PlmOption[]> {
    return this.http
      .get<{ data: { id: string; bom_number: string; name: string; revision: string }[] }>(`${environment.apiBaseUrl}/manufacturing/boms`, { params: this.params({ per_page: 100 }) })
      .pipe(map((response) => response.data.map((bom) => ({ id: bom.id, label: `${bom.bom_number} (${bom.revision}) - ${bom.name}` }))));
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
