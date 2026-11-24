import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import {
  ApiResponse,
  BomCoProductPayload,
  BomCostAllocation,
  BomDiffResult,
  BomExplosion,
  BomExplosionParams,
  BomImplosion,
  BomImportPayload,
  BomImportReport,
  BomMassReplacePayload,
  BomMassReplaceResult,
  BomPreferentialOrigin,
  BomRevisionPayload,
  BomRevisionResult,
  CancelProductionOrderPayload,
  CreateBomPayload,
  EngineeringChangeResource,
  MfgItemSummary,
  CreateProductionOrderPayload,
  CreateWorkCenterPayload,
  MfgBomResource,
  MfgMrpRunResource,
  MfgOutputLabel,
  OutputLabelFormat,
  ReceiveOutputPayload,
  MfgPlannedOrderResource,
  MfgProductionOrderResource,
  MfgRoutingResource,
  MfgShortageResource,
  MfgWorkCenterResource,
  PaginatedResponse,
  QueryFilterParams,
  RunMrpPayload,
} from '../models';
import { toHttpParams } from '../http/laravel-http.utils';

@Service()
export class ManufacturingApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/manufacturing`;

  // --- Production Orders ---

  getProductionOrders(params?: QueryFilterParams): Observable<PaginatedResponse<MfgProductionOrderResource>> {
    return this.http.get<PaginatedResponse<MfgProductionOrderResource>>(`${this.base}/production-orders`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  getProductionOrder(id: string): Observable<ApiResponse<MfgProductionOrderResource>> {
    return this.http.get<ApiResponse<MfgProductionOrderResource>>(`${this.base}/production-orders/${id}`);
  }

  createProductionOrder(payload: CreateProductionOrderPayload): Observable<ApiResponse<MfgProductionOrderResource>> {
    return this.http.post<ApiResponse<MfgProductionOrderResource>>(`${this.base}/production-orders`, payload);
  }

  releaseProductionOrder(id: string): Observable<ApiResponse<MfgProductionOrderResource>> {
    return this.http.post<ApiResponse<MfgProductionOrderResource>>(`${this.base}/production-orders/${id}/release`, {});
  }

  startProductionOrder(id: string): Observable<ApiResponse<MfgProductionOrderResource>> {
    return this.http.post<ApiResponse<MfgProductionOrderResource>>(`${this.base}/production-orders/${id}/start`, {});
  }

  completeProductionOrder(id: string): Observable<ApiResponse<MfgProductionOrderResource>> {
    return this.http.post<ApiResponse<MfgProductionOrderResource>>(`${this.base}/production-orders/${id}/complete`, {});
  }

  closeProductionOrder(id: string): Observable<ApiResponse<MfgProductionOrderResource>> {
    return this.http.post<ApiResponse<MfgProductionOrderResource>>(`${this.base}/production-orders/${id}/close`, {});
  }

  /** Cancels an order that moved nothing; the reason is mandatory. */
  cancelProductionOrder(id: string, reason: string): Observable<ApiResponse<MfgProductionOrderResource>> {
    const payload: CancelProductionOrderPayload = { reason };
    return this.http.post<ApiResponse<MfgProductionOrderResource>>(
      `${this.base}/production-orders/${id}/cancel`,
      payload,
    );
  }

  /** Receives output into stock; `generate_lot` numbers the lot after the order when no lot number is given. */
  receiveProductionOrderOutput(id: string, payload: ReceiveOutputPayload): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(`${this.base}/production-orders/${id}/receipts`, payload);
  }

  /** GS1-128 label of the latest lot-tracked output receipt, as SVG markup or base64 PNG. */
  getProductionOrderOutputLabel(id: string, format: OutputLabelFormat = 'svg'): Observable<ApiResponse<MfgOutputLabel>> {
    return this.http.get<ApiResponse<MfgOutputLabel>>(`${this.base}/production-orders/${id}/output-label`, {
      params: toHttpParams({ format }),
    });
  }

  // --- Bills of Materials (BOMs) ---

  getBoms(params?: QueryFilterParams): Observable<PaginatedResponse<MfgBomResource>> {
    return this.http.get<PaginatedResponse<MfgBomResource>>(`${this.base}/boms`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  getBom(id: string): Observable<ApiResponse<MfgBomResource>> {
    return this.http.get<ApiResponse<MfgBomResource>>(`${this.base}/boms/${id}`);
  }

  /** Creates a DRAFT revision: it counts for production orders only after `activateBom` (managers only). */
  createBom(payload: CreateBomPayload): Observable<ApiResponse<MfgBomResource>> {
    return this.http.post<ApiResponse<MfgBomResource>>(`${this.base}/boms`, payload);
  }

  /** Releases a draft revision. Manufacturing managers (owner, admin, production) only: 403 otherwise. */
  activateBom(id: string): Observable<ApiResponse<MfgBomResource>> {
    return this.http.post<ApiResponse<MfgBomResource>>(`${this.base}/boms/${id}/activate`, {});
  }

  reviseBom(id: string): Observable<ApiResponse<MfgBomResource>> {
    return this.http.post<ApiResponse<MfgBomResource>>(`${this.base}/boms/${id}/revise`, {});
  }

  explodeBom(id: string): Observable<ApiResponse<unknown>> {
    return this.http.get<ApiResponse<unknown>>(`${this.base}/boms/${id}/explode`);
  }

  // --- Mod 060: multi-level BOM management ---

  /** Opens an engineering change (with `source_bom_id`) or creates a draft; the BOM comes back `pending_eco_approval` for a change. */
  createBomRevision(payload: BomRevisionPayload): Observable<BomRevisionResult> {
    return this.http.post<BomRevisionResult>(`${this.base}/boms/revisions`, payload);
  }

  /** Booleans go out as 1/0: the Laravel `boolean` rule does not accept the strings "true"/"false". */
  getBomExplosion(id: string, params: BomExplosionParams = {}): Observable<ApiResponse<BomExplosion>> {
    const query = {
      quantity: params.quantity,
      date: params.date,
      multi_level: params.multi_level === undefined ? undefined : Number(params.multi_level),
      flatten_phantoms: params.flatten_phantoms === undefined ? undefined : Number(params.flatten_phantoms),
    };
    return this.http.get<ApiResponse<BomExplosion>>(`${this.base}/boms/${id}/explosion`, {
      params: toHttpParams(query),
    });
  }

  getItemImplosion(itemId: string, date?: string): Observable<ApiResponse<BomImplosion>> {
    return this.http.get<ApiResponse<BomImplosion>>(`${this.base}/items/${itemId}/implosion`, {
      params: toHttpParams({ date }),
    });
  }

  /** `dry_run: true` only reports what would be replaced and skipped. */
  massReplaceComponent(payload: BomMassReplacePayload): Observable<ApiResponse<BomMassReplaceResult>> {
    return this.http.post<ApiResponse<BomMassReplaceResult>>(`${this.base}/boms/mass-replace`, payload);
  }

  getBomDiff(id: string, otherId: string): Observable<ApiResponse<BomDiffResult>> {
    return this.http.get<ApiResponse<BomDiffResult>>(`${this.base}/boms/${id}/diff/${otherId}`);
  }

  /** `dry_run: false` creates the draft (201) or answers 422 with the per-row report. */
  importBom(payload: BomImportPayload): Observable<ApiResponse<BomImportReport>> {
    return this.http.post<ApiResponse<BomImportReport>>(`${this.base}/boms/import`, payload);
  }

  updateBomCoProducts(id: string, payload: BomCoProductPayload): Observable<ApiResponse<unknown>> {
    return this.http.put<ApiResponse<unknown>>(`${this.base}/boms/${id}/co-products`, payload);
  }

  getBomCostAllocation(id: string): Observable<ApiResponse<BomCostAllocation>> {
    return this.http.get<ApiResponse<BomCostAllocation>>(`${this.base}/boms/${id}/cost-allocation`);
  }

  getBomPreferentialOrigin(id: string, thresholdPercentage?: number): Observable<ApiResponse<BomPreferentialOrigin>> {
    return this.http.get<ApiResponse<BomPreferentialOrigin>>(`${this.base}/boms/${id}/preferential-origin`, {
      params: toHttpParams({ threshold_percentage: thresholdPercentage }),
    });
  }

  getMfgItems(params?: QueryFilterParams): Observable<PaginatedResponse<MfgItemSummary>> {
    return this.http.get<PaginatedResponse<MfgItemSummary>>(`${this.base}/items`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  getEngineeringChange(id: string): Observable<ApiResponse<EngineeringChangeResource>> {
    return this.http.get<ApiResponse<EngineeringChangeResource>>(`${this.base}/engineering-changes/${id}`);
  }

  // --- MRP (Material Requirements Planning) ---

  getMrpRuns(params?: QueryFilterParams): Observable<PaginatedResponse<MfgMrpRunResource>> {
    return this.http.get<PaginatedResponse<MfgMrpRunResource>>(`${this.base}/mrp/runs`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  getMrpRun(id: string): Observable<ApiResponse<MfgMrpRunResource>> {
    return this.http.get<ApiResponse<MfgMrpRunResource>>(`${this.base}/mrp/runs/${id}`);
  }

  runMrp(payload: RunMrpPayload): Observable<ApiResponse<MfgMrpRunResource>> {
    return this.http.post<ApiResponse<MfgMrpRunResource>>(`${this.base}/mrp/runs`, payload);
  }

  getPlannedOrders(params?: QueryFilterParams): Observable<PaginatedResponse<MfgPlannedOrderResource>> {
    return this.http.get<PaginatedResponse<MfgPlannedOrderResource>>(`${this.base}/mrp/planned-orders`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  convertPlannedOrder(id: string): Observable<ApiResponse<MfgProductionOrderResource>> {
    return this.http.post<ApiResponse<MfgProductionOrderResource>>(`${this.base}/mrp/planned-orders/${id}/convert`, {});
  }

  getShortages(params?: QueryFilterParams): Observable<PaginatedResponse<MfgShortageResource>> {
    return this.http.get<PaginatedResponse<MfgShortageResource>>(`${this.base}/mrp/shortages`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  // --- Work Centers & Routings ---

  getWorkCenters(params?: QueryFilterParams): Observable<PaginatedResponse<MfgWorkCenterResource>> {
    return this.http.get<PaginatedResponse<MfgWorkCenterResource>>(`${this.base}/work-centers`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  createWorkCenter(payload: CreateWorkCenterPayload): Observable<ApiResponse<MfgWorkCenterResource>> {
    return this.http.post<ApiResponse<MfgWorkCenterResource>>(`${this.base}/work-centers`, payload);
  }

  getRoutings(params?: QueryFilterParams): Observable<PaginatedResponse<MfgRoutingResource>> {
    return this.http.get<PaginatedResponse<MfgRoutingResource>>(`${this.base}/routings`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  createRouting(payload: unknown): Observable<ApiResponse<MfgRoutingResource>> {
    return this.http.post<ApiResponse<MfgRoutingResource>>(`${this.base}/routings`, payload);
  }
}
