import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import {
  ApiResponse,
  CancelProductionOrderPayload,
  CreateBomPayload,
  CreateProductionOrderPayload,
  CreateWorkCenterPayload,
  MfgBomResource,
  MfgMrpRunResource,
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
