import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { toHttpParams } from '../http/laravel-http.utils';
import {
  ApiResponse,
  AssetAcquirePayload,
  AssetAssignmentPayload,
  AssetCategoryPayload,
  AssetCategoryResource,
  AssetClass,
  AssetClassPayload,
  AssetComponent,
  AssetComponentPayload,
  AssetHistory,
  AssetLedgerType,
  AssetLocation,
  AssetLocationPayload,
  AssetMeterReading,
  AssetProjectAllocationPayload,
  AssetRegisterRow,
  AssetTagData,
  AssetTransfer,
  AssetTransferPayload,
  AssetValuation,
  AssetValuationPayload,
  CompleteWorkOrderPayload,
  DepreciationPreviewRow,
  DepreciationRunResource,
  ExpiringAsset,
  FixedAssetResource,
  MaintenancePlan,
  MaintenancePlanPayload,
  PaginatedResponse,
  WorkOrder,
  WorkOrderDetail,
  WorkOrderPart,
} from '../models';

/** Asset management endpoints beyond `AssetApiService`: maintenance, locations, classes, components, valuations, reports. */
@Service()
export class EamOpsApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/eam`;

  // --- Maintenance plans ---

  getMaintenancePlans(params?: { page?: number; per_page?: number }): Observable<PaginatedResponse<MaintenancePlan>> {
    return this.http.get<PaginatedResponse<MaintenancePlan>>(`${this.base}/maintenance/plans`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  getMaintenancePlan(id: string): Observable<ApiResponse<MaintenancePlan>> {
    return this.http.get<ApiResponse<MaintenancePlan>>(`${this.base}/maintenance/plans/${id}`);
  }

  getDueMaintenancePlans(asOf?: string | null): Observable<ApiResponse<MaintenancePlan[]>> {
    return this.http.get<ApiResponse<MaintenancePlan[]>>(`${this.base}/maintenance/plans/due`, {
      params: asOf ? toHttpParams({ as_of: asOf }) : undefined,
    });
  }

  createMaintenancePlan(payload: MaintenancePlanPayload): Observable<ApiResponse<MaintenancePlan>> {
    return this.http.post<ApiResponse<MaintenancePlan>>(`${this.base}/maintenance/plans`, payload);
  }

  updateMaintenancePlan(id: string, payload: MaintenancePlanPayload): Observable<ApiResponse<MaintenancePlan>> {
    return this.http.put<ApiResponse<MaintenancePlan>>(`${this.base}/maintenance/plans/${id}`, payload);
  }

  openPlanWorkOrder(planId: string, scheduledDate?: string | null): Observable<ApiResponse<WorkOrder>> {
    return this.http.post<ApiResponse<WorkOrder>>(`${this.base}/maintenance/plans/${planId}/work-orders`, {
      scheduled_date: scheduledDate ?? null,
    });
  }

  // --- Work orders ---

  getWorkOrder(id: string): Observable<WorkOrderDetail> {
    return this.http.get<WorkOrderDetail>(`${this.base}/maintenance/work-orders/${id}`);
  }

  startWorkOrder(id: string, stopsAsset = false): Observable<ApiResponse<WorkOrder>> {
    return this.http.post<ApiResponse<WorkOrder>>(`${this.base}/maintenance/work-orders/${id}/start`, {
      stops_asset: stopsAsset,
    });
  }

  issueWorkOrderPart(
    id: string,
    payload: { product_id: string; warehouse_id?: string | null; quantity: number },
  ): Observable<ApiResponse<WorkOrderPart>> {
    return this.http.post<ApiResponse<WorkOrderPart>>(`${this.base}/maintenance/work-orders/${id}/parts`, payload);
  }

  completeWorkOrder(id: string, payload: CompleteWorkOrderPayload): Observable<ApiResponse<WorkOrder>> {
    return this.http.post<ApiResponse<WorkOrder>>(`${this.base}/maintenance/work-orders/${id}/complete`, payload);
  }

  cancelWorkOrder(id: string, reason?: string | null): Observable<ApiResponse<WorkOrder>> {
    return this.http.post<ApiResponse<WorkOrder>>(`${this.base}/maintenance/work-orders/${id}/cancel`, {
      reason: reason ?? null,
    });
  }

  // --- Locations, classes, categories ---

  getLocations(): Observable<ApiResponse<AssetLocation[]>> {
    return this.http.get<ApiResponse<AssetLocation[]>>(`${this.base}/locations`);
  }

  createLocation(payload: AssetLocationPayload): Observable<ApiResponse<AssetLocation>> {
    return this.http.post<ApiResponse<AssetLocation>>(`${this.base}/locations`, payload);
  }

  updateLocation(id: string, payload: AssetLocationPayload): Observable<ApiResponse<AssetLocation>> {
    return this.http.put<ApiResponse<AssetLocation>>(`${this.base}/locations/${id}`, payload);
  }

  getAssetClasses(): Observable<ApiResponse<AssetClass[]>> {
    return this.http.get<ApiResponse<AssetClass[]>>(`${this.base}/classes`);
  }

  createAssetClass(payload: AssetClassPayload): Observable<ApiResponse<AssetClass>> {
    return this.http.post<ApiResponse<AssetClass>>(`${this.base}/classes`, payload);
  }

  getCategory(id: string): Observable<ApiResponse<AssetCategoryResource>> {
    return this.http.get<ApiResponse<AssetCategoryResource>>(`${this.base}/categories/${id}`);
  }

  updateCategory(id: string, payload: AssetCategoryPayload): Observable<ApiResponse<AssetCategoryResource>> {
    return this.http.put<ApiResponse<AssetCategoryResource>>(`${this.base}/categories/${id}`, payload);
  }

  // --- Asset components, custody, assignments, allocations ---

  getAssetComponents(assetId: string): Observable<ApiResponse<AssetComponent[]>> {
    return this.http.get<ApiResponse<AssetComponent[]>>(`${this.base}/assets/${assetId}/components`);
  }

  addAssetComponent(assetId: string, payload: AssetComponentPayload): Observable<ApiResponse<AssetComponent>> {
    return this.http.post<ApiResponse<AssetComponent>>(`${this.base}/assets/${assetId}/components`, payload);
  }

  retireAssetComponent(
    assetId: string,
    componentId: string,
    status: 'replaced' | 'detached' | 'failed' | null = null,
  ): Observable<ApiResponse<AssetComponent>> {
    return this.http.post<ApiResponse<AssetComponent>>(
      `${this.base}/assets/${assetId}/components/${componentId}/retire`,
      { status },
    );
  }

  assignCustodian(assetId: string, payload: { custodian_user_id: string; department?: string | null }): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(`${this.base}/assets/${assetId}/custodians`, payload);
  }

  assignAsset(assetId: string, payload: AssetAssignmentPayload): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(`${this.base}/assets/${assetId}/assignments`, payload);
  }

  allocateAssetToProject(assetId: string, payload: AssetProjectAllocationPayload): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(`${this.base}/assets/${assetId}/project-allocations`, payload);
  }

  getMeterReadings(assetId: string, params?: { page?: number }): Observable<PaginatedResponse<AssetMeterReading>> {
    return this.http.get<PaginatedResponse<AssetMeterReading>>(`${this.base}/assets/${assetId}/meter-readings`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  recordMeterReading(
    assetId: string,
    payload: { meter_code: string; reading_value: number; read_at?: string | null; notes?: string | null },
  ): Observable<ApiResponse<AssetMeterReading>> {
    return this.http.post<ApiResponse<AssetMeterReading>>(`${this.base}/assets/${assetId}/meter-readings`, payload);
  }

  getMaintenanceSummary(assetId: string): Observable<ApiResponse<Record<string, unknown>>> {
    return this.http.get<ApiResponse<Record<string, unknown>>>(`${this.base}/assets/${assetId}/maintenance-summary`);
  }

  getAssetTags(assetIds: string[]): Observable<ApiResponse<AssetTagData[]>> {
    let params = new HttpParams();
    for (const id of assetIds) {
      params = params.append('asset_ids[]', id);
    }
    return this.http.get<ApiResponse<AssetTagData[]>>(`${this.base}/assets/tags`, { params });
  }

  // --- Acquisition, transfer, valuation ---

  acquireAsset(payload: AssetAcquirePayload): Observable<ApiResponse<FixedAssetResource>> {
    return this.http.post<ApiResponse<FixedAssetResource>>(`${this.base}/assets/acquire`, payload);
  }

  transferAsset(assetId: string, payload: AssetTransferPayload): Observable<ApiResponse<AssetTransfer>> {
    return this.http.post<ApiResponse<AssetTransfer>>(`${this.base}/assets/${assetId}/transfer`, payload);
  }

  valuateAsset(assetId: string, payload: AssetValuationPayload): Observable<ApiResponse<AssetValuation>> {
    return this.http.post<ApiResponse<AssetValuation>>(`${this.base}/assets/${assetId}/valuate`, payload);
  }

  reverseImpairment(
    assetId: string,
    payload: { recoverable_amount: number; reason?: string | null },
  ): Observable<ApiResponse<AssetValuation>> {
    return this.http.post<ApiResponse<AssetValuation>>(`${this.base}/assets/${assetId}/reverse-impairment`, payload);
  }

  getAssetHistory(assetId: string): Observable<ApiResponse<AssetHistory>> {
    return this.http.get<ApiResponse<AssetHistory>>(`${this.base}/assets/${assetId}/history`);
  }

  // --- Depreciation and reports ---

  getDepreciationPreview(
    assetId: string,
    params?: { ledger_type?: AssetLedgerType; period_type?: 'monthly' | 'quarterly' | 'yearly'; periods?: number; units_per_period?: number },
  ): Observable<ApiResponse<DepreciationPreviewRow[]>> {
    return this.http.get<ApiResponse<DepreciationPreviewRow[]>>(`${this.base}/assets/${assetId}/depreciation-preview`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  getDepreciationRun(id: string): Observable<ApiResponse<DepreciationRunResource>> {
    return this.http.get<ApiResponse<DepreciationRunResource>>(`${this.base}/depreciation/runs/${id}`);
  }

  getAssetRegister(params: {
    year: number;
    ledger_type?: AssetLedgerType;
    per_page?: number;
    page?: number;
  }): Observable<PaginatedResponse<AssetRegisterRow>> {
    return this.http.get<PaginatedResponse<AssetRegisterRow>>(`${this.base}/reports/asset-register`, {
      params: toHttpParams({ ...params, format: 'json' }),
    });
  }

  exportAssetRegister(params: { year: number; ledger_type?: AssetLedgerType }): Observable<Blob> {
    return this.http.get(`${this.base}/reports/asset-register`, {
      params: toHttpParams({ ...params, format: 'csv' }),
      responseType: 'blob',
    });
  }

  getExpiringAssets(expired?: boolean): Observable<ApiResponse<ExpiringAsset[]>> {
    return this.http.get<ApiResponse<ExpiringAsset[]>>(`${this.base}/alerts/expiring`, {
      params: expired === undefined ? undefined : toHttpParams({ expired }),
    });
  }
}
