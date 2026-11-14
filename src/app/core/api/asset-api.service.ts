import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import {
  ApiResponse,
  AssetBookResource,
  AssetCategoryResource,
  AssetTagData,
  DepreciationRunResource,
  DepreciationScheduleResource,
  FixedAssetResource,
  MaintenanceWorkOrderResource,
  PaginatedResponse,
  QueryFilterParams,
  DisposeAssetPayload,
  RunDepreciationPayload,
  StoreFixedAssetPayload,
  UpdateFixedAssetPayload,
} from '../models';
import { toHttpParams } from '../http/laravel-http.utils';

export interface AssetFilterParams extends QueryFilterParams {
  category_id?: string;
  status?: string;
  condition?: string;
  search?: string;
}

@Service()
export class AssetApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/eam`;

  // --- Fixed Assets CRUD & Lifecycle ---
  getAssets(params?: AssetFilterParams): Observable<PaginatedResponse<FixedAssetResource>> {
    return this.http.get<PaginatedResponse<FixedAssetResource>>(`${this.base}/assets`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  getAssetById(id: string): Observable<ApiResponse<FixedAssetResource>> {
    return this.http.get<ApiResponse<FixedAssetResource>>(`${this.base}/assets/${id}`);
  }

  createAsset(payload: StoreFixedAssetPayload): Observable<ApiResponse<FixedAssetResource>> {
    return this.http.post<ApiResponse<FixedAssetResource>>(`${this.base}/assets`, payload);
  }

  updateAsset(id: string, payload: UpdateFixedAssetPayload): Observable<ApiResponse<FixedAssetResource>> {
    return this.http.put<ApiResponse<FixedAssetResource>>(`${this.base}/assets/${id}`, payload);
  }

  deleteAsset(id: string): Observable<ApiResponse<unknown>> {
    return this.http.delete<ApiResponse<unknown>>(`${this.base}/assets/${id}`);
  }

  capitalizeAsset(id: string): Observable<ApiResponse<FixedAssetResource>> {
    return this.http.post<ApiResponse<FixedAssetResource>>(`${this.base}/assets/${id}/capitalize`, {});
  }

  commissionAsset(id: string): Observable<ApiResponse<FixedAssetResource>> {
    return this.http.post<ApiResponse<FixedAssetResource>>(`${this.base}/assets/${id}/commission`, {});
  }

  disposeAsset(
    id: string,
    payload: DisposeAssetPayload,
  ): Observable<ApiResponse<FixedAssetResource>> {
    return this.http.post<ApiResponse<FixedAssetResource>>(`${this.base}/assets/${id}/dispose`, payload);
  }

  // --- Parallel Books & Tag / QR ---
  getAssetBooks(id: string): Observable<ApiResponse<AssetBookResource[]>> {
    return this.http.get<ApiResponse<AssetBookResource[]>>(`${this.base}/assets/${id}/books`);
  }

  getAssetTag(id: string): Observable<ApiResponse<AssetTagData>> {
    return this.http.get<ApiResponse<AssetTagData>>(`${this.base}/assets/${id}/tag`);
  }

  getDepreciationSchedules(id: string, params?: QueryFilterParams): Observable<PaginatedResponse<DepreciationScheduleResource>> {
    return this.http.get<PaginatedResponse<DepreciationScheduleResource>>(`${this.base}/assets/${id}/depreciation-schedules`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  simulateDepreciation(payload: RunDepreciationPayload): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(`${this.base}/depreciation/simulate`, payload);
  }

  createDepreciationRun(payload: RunDepreciationPayload): Observable<ApiResponse<DepreciationRunResource>> {
    return this.http.post<ApiResponse<DepreciationRunResource>>(`${this.base}/depreciation/runs`, payload);
  }

  // --- Categories & Maintenance ---
  getCategories(): Observable<ApiResponse<AssetCategoryResource[]>> {
    return this.http.get<ApiResponse<AssetCategoryResource[]>>(`${this.base}/categories`);
  }

  getMaintenanceWorkOrders(params?: QueryFilterParams): Observable<PaginatedResponse<MaintenanceWorkOrderResource>> {
    return this.http.get<PaginatedResponse<MaintenanceWorkOrderResource>>(`${this.base}/maintenance/work-orders`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }
}
