import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { map, Observable } from 'rxjs';
import { toHttpParams } from '../http/laravel-http.utils';
import type {
  MoveSalesDealPayload,
  MoveSalesDealResult,
  SalesBoard,
  SalesBoardFilters,
  SalesDeal,
  SalesForecastDashboard,
  SalesForecastFilters,
  SalesLossAnalysis,
  SalesLossReason,
  SalesLossReasonPayload,
  SalesPipeline,
  SalesPipelinePayload,
  SalesPipelineStage,
  SalesPipelineStagePayload,
  SalesStageHistoryEntry,
} from '../models/sales-pipeline.model';

interface DataEnvelope<T> {
  data: T;
}

/**
 * Sales pipeline endpoints of the CRM (Module 035): pipelines and stages, Kanban board and moves, quick notes, loss
 * reasons, forecast / quota dashboard and loss analysis. Quotas themselves are CRUD-ed with CrmExtensionApiService.
 */
@Service()
export class SalesPipelineApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/crm`;

  // --- Pipelines and stages ---
  listPipelines(): Observable<SalesPipeline[]> {
    return this.http
      .get<DataEnvelope<SalesPipeline[]>>(`${this.base}/pipelines`)
      .pipe(map((res) => res.data));
  }

  createPipeline(payload: SalesPipelinePayload): Observable<SalesPipeline> {
    return this.http.post<SalesPipeline>(`${this.base}/pipelines`, payload);
  }

  updatePipeline(id: string, payload: SalesPipelinePayload): Observable<SalesPipeline> {
    return this.http.put<SalesPipeline>(`${this.base}/pipelines/${id}`, payload);
  }

  deletePipeline(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/pipelines/${id}`);
  }

  /** Installs the standard pipelines, stages and loss reasons (localized by the API) the tenant lacks. */
  installCatalog(): Observable<{ pipelines: number; stages: number; loss_reasons: number }> {
    return this.http
      .post<{ created: { pipelines: number; stages: number; loss_reasons: number } }>(
        `${this.base}/pipelines/catalog/install`,
        {},
      )
      .pipe(map((res) => res.created));
  }

  createStage(payload: SalesPipelineStagePayload): Observable<SalesPipelineStage> {
    return this.http.post<SalesPipelineStage>(`${this.base}/pipeline-stages`, payload);
  }

  updateStage(id: string, payload: SalesPipelineStagePayload): Observable<SalesPipelineStage> {
    return this.http.put<SalesPipelineStage>(`${this.base}/pipeline-stages/${id}`, payload);
  }

  deleteStage(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/pipeline-stages/${id}`);
  }

  // --- Board ---
  /** `pipelineId` null loads the default pipeline. */
  getBoard(pipelineId: string | null, filters: SalesBoardFilters = {}): Observable<SalesBoard> {
    return this.http.get<SalesBoard>(`${this.base}/pipelines/${pipelineId ?? 'default'}/board`, {
      params: toHttpParams(filters),
    });
  }

  moveDeal(id: string, payload: MoveSalesDealPayload): Observable<MoveSalesDealResult> {
    return this.http.post<MoveSalesDealResult>(`${this.base}/opportunities/${id}/move`, payload);
  }

  updateNotes(id: string, notes: string, append: boolean): Observable<SalesDeal> {
    return this.http.patch<SalesDeal>(`${this.base}/opportunities/${id}/notes`, { notes, append });
  }

  getHistory(id: string): Observable<SalesStageHistoryEntry[]> {
    return this.http
      .get<DataEnvelope<SalesStageHistoryEntry[]>>(`${this.base}/opportunities/${id}/history`)
      .pipe(map((res) => res.data));
  }

  // --- Loss reasons ---
  listLossReasons(): Observable<SalesLossReason[]> {
    return this.http
      .get<DataEnvelope<SalesLossReason[]>>(`${this.base}/loss-reasons`)
      .pipe(map((res) => res.data));
  }

  createLossReason(payload: SalesLossReasonPayload): Observable<SalesLossReason> {
    return this.http.post<SalesLossReason>(`${this.base}/loss-reasons`, payload);
  }

  updateLossReason(id: string, payload: SalesLossReasonPayload): Observable<SalesLossReason> {
    return this.http.put<SalesLossReason>(`${this.base}/loss-reasons/${id}`, payload);
  }

  deleteLossReason(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/loss-reasons/${id}`);
  }

  // --- Forecast and analysis ---
  getForecastDashboard(filters: SalesForecastFilters = {}): Observable<SalesForecastDashboard> {
    return this.http.get<SalesForecastDashboard>(`${this.base}/forecasts/dashboard`, {
      params: toHttpParams(filters),
    });
  }

  getLossAnalysis(
    filters: { pipeline_id?: string | null; from?: string | null; to?: string | null } = {},
  ): Observable<SalesLossAnalysis> {
    return this.http.get<SalesLossAnalysis>(`${this.base}/reports/loss-analysis`, {
      params: toHttpParams(filters),
    });
  }
}
