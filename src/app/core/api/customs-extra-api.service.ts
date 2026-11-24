import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { toHttpParams } from '../http/laravel-http.utils';
import { ApiResponse, LaravelPaginationMeta } from '../models';

type Filters = Record<string, string | number | boolean | null | undefined | string[]>;
/** Request body: field names mirror the Laravel FormRequest of the route. */
type Payload = Record<string, unknown>;
/** Generic resource returned by the API. */
type Row = Record<string, unknown>;
type ListResponse<T> = ApiResponse<T[]> & { meta?: LaravelPaginationMeta };

/** Additional endpoints of the customs API not covered by the dedicated typed services. */
@Service()
export class CustomsExtraApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  /** GET /customs/settings */
  getSettings(filters?: Filters): Observable<ApiResponse<Row>> {
    return this.http.get<ApiResponse<Row>>(`${this.base}/customs/settings`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** PUT /customs/settings */
  saveSettings(payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.put<ApiResponse<Row>>(`${this.base}/customs/settings`, payload);
  }

  /** GET /customs/master-data/{} */
  getMasterData(type: string, filters?: Filters): Observable<ApiResponse<Row>> {
    return this.http.get<ApiResponse<Row>>(`${this.base}/customs/master-data/${type}`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** POST /customs/master-data/{} */
  createMasterData(type: string, payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/customs/master-data/${type}`, payload);
  }

  /** PUT /customs/master-data/{}/{} */
  updateMasterData(type: string, id: string, payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.put<ApiResponse<Row>>(`${this.base}/customs/master-data/${type}/${id}`, payload);
  }

  /** DELETE /customs/master-data/{}/{} */
  deleteMasterData(type: string, id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/customs/master-data/${type}/${id}`);
  }

  /** GET /customs/tariff-history */
  getTariffHistory(filters?: Filters): Observable<ApiResponse<Row>> {
    return this.http.get<ApiResponse<Row>>(`${this.base}/customs/tariff-history`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** POST /customs/declarations/from-delivery-note */
  fromDeliveryNoteDeclaration(payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/customs/declarations/from-delivery-note`, payload);
  }

  /** POST /customs/declarations/{}/items/reuse/{} */
  reuseDeclarationItem(declarationId: string, reuseId: string, payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/customs/declarations/${declarationId}/items/reuse/${reuseId}`, payload);
  }

  /** GET /customs/declarations/{}/message */
  getDeclarationMessage(declarationId: string, filters?: Filters): Observable<Blob> {
    return this.http.get(`${this.base}/customs/declarations/${declarationId}/message`, { params: filters ? toHttpParams(filters) : undefined, responseType: 'blob' });
  }

  /** GET /customs/assessment-decisions/control-list */
  getAssessmentDecisionControlList(filters?: Filters): Observable<ApiResponse<Row>> {
    return this.http.get<ApiResponse<Row>>(`${this.base}/customs/assessment-decisions/control-list`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** GET /customs/assessment-decisions/statistics */
  getAssessmentDecisionStatistics(filters?: Filters): Observable<ApiResponse<Row>> {
    return this.http.get<ApiResponse<Row>>(`${this.base}/customs/assessment-decisions/statistics`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** GET /customs/assessment-decisions/retrieval-runs */
  listAssessmentDecisionRetrievalRuns(filters?: Filters): Observable<ListResponse<Row>> {
    return this.http.get<ListResponse<Row>>(`${this.base}/customs/assessment-decisions/retrieval-runs`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** GET /customs/assessment-decisions/{}/xml */
  getAssessmentDecisionXml(assessmentDecisionId: string, filters?: Filters): Observable<Blob> {
    return this.http.get(`${this.base}/customs/assessment-decisions/${assessmentDecisionId}/xml`, { params: filters ? toHttpParams(filters) : undefined, responseType: 'blob' });
  }

  /** GET /customs/assessment-decisions/{}/integrity */
  getAssessmentDecisionIntegrity(assessmentDecisionId: string, filters?: Filters): Observable<ApiResponse<Row>> {
    return this.http.get<ApiResponse<Row>>(`${this.base}/customs/assessment-decisions/${assessmentDecisionId}/integrity`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** POST /customs/assessment-decisions/{}/post */
  postAssessmentDecision(assessmentDecisionId: string, payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/customs/assessment-decisions/${assessmentDecisionId}/post`, payload);
  }

  /** GET /customs/ledger/reconciliation */
  getLedgerReconciliation(filters?: Filters): Observable<ApiResponse<Row>> {
    return this.http.get<ApiResponse<Row>>(`${this.base}/customs/ledger/reconciliation`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** GET /customs/tariff-grids/{} */
  getTariffGrid(tariffGridId: string, filters?: Filters): Observable<ApiResponse<Row>> {
    return this.http.get<ApiResponse<Row>>(`${this.base}/customs/tariff-grids/${tariffGridId}`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** PUT /customs/tariff-grids/{} */
  updateTariffGrid(tariffGridId: string, payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.put<ApiResponse<Row>>(`${this.base}/customs/tariff-grids/${tariffGridId}`, payload);
  }

  /** POST /customs/tariff-grids/{}/rates */
  createTariffGridRate(tariffGridId: string, payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/customs/tariff-grids/${tariffGridId}/rates`, payload);
  }

  /** DELETE /customs/tariff-grids/{}/rates/{} */
  deleteTariffGridRate(tariffGridId: string, rateId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/customs/tariff-grids/${tariffGridId}/rates/${rateId}`);
  }

  /** GET /customs/service-discounts */
  getServiceDiscounts(filters?: Filters): Observable<ApiResponse<Row>> {
    return this.http.get<ApiResponse<Row>>(`${this.base}/customs/service-discounts`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** PUT /customs/service-discounts */
  saveServiceDiscounts(payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.put<ApiResponse<Row>>(`${this.base}/customs/service-discounts`, payload);
  }

  /** GET /customs/dossiers/monthly-summary */
  getDossierMonthlySummary(filters?: Filters): Observable<ApiResponse<Row>> {
    return this.http.get<ApiResponse<Row>>(`${this.base}/customs/dossiers/monthly-summary`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** POST /customs/dossiers/{}/charges */
  createDossierCharge(dossierId: string, payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/customs/dossiers/${dossierId}/charges`, payload);
  }

  /** POST /customs/dossiers/{}/import-assessments */
  importAssessmentsDossier(dossierId: string, payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/customs/dossiers/${dossierId}/import-assessments`, payload);
  }

  /** GET /customs/dossiers/{}/assessment-check */
  getDossierAssessmentCheck(dossierId: string, filters?: Filters): Observable<ApiResponse<Row>> {
    return this.http.get<ApiResponse<Row>>(`${this.base}/customs/dossiers/${dossierId}/assessment-check`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** POST /customs/dossiers/{}/documents */
  createDossierDocument(dossierId: string, payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/customs/dossiers/${dossierId}/documents`, payload);
  }

  /** POST /customs/dossiers/{}/deliveries */
  createDossierDelivery(dossierId: string, payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/customs/dossiers/${dossierId}/deliveries`, payload);
  }

  /** GET /customs/dossiers/{}/quotes */
  listDossierQuotes(dossierId: string, filters?: Filters): Observable<ListResponse<Row>> {
    return this.http.get<ListResponse<Row>>(`${this.base}/customs/dossiers/${dossierId}/quotes`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** POST /customs/dossiers/{}/quotes/from-grid */
  createDossierQuoteFromGrid(dossierId: string, payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/customs/dossiers/${dossierId}/quotes/from-grid`, payload);
  }

  /** POST /customs/dossiers/{}/quotes/spot */
  createDossierSpotQuote(dossierId: string, payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/customs/dossiers/${dossierId}/quotes/spot`, payload);
  }

  /** POST /customs/quotes/{}/status */
  setQuoteStatus(quoteId: string, payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/customs/quotes/${quoteId}/status`, payload);
  }

  /** GET /customs/consolidations */
  listConsolidations(filters?: Filters): Observable<ListResponse<Row>> {
    return this.http.get<ListResponse<Row>>(`${this.base}/customs/consolidations`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** POST /customs/consolidations */
  createConsolidation(payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/customs/consolidations`, payload);
  }

  /** POST /customs/consolidations/{}/dossiers/{} */
  createConsolidationDossier(consolidationId: string, dossierId: string, payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/customs/consolidations/${consolidationId}/dossiers/${dossierId}`, payload);
  }

  /** POST /customs/consolidations/{}/allocate */
  allocateConsolidation(consolidationId: string, payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/customs/consolidations/${consolidationId}/allocate`, payload);
  }
}
