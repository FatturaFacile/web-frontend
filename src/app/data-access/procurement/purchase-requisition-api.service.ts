import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { handleErrorsLocally } from '@core/http/error-handling.context';
import { toHttpParams } from '@core/http/laravel-http.utils';
import {
  ApiResponse,
  CostCenterNode,
  PaginatedResponse,
  ProductItem,
  ProjectResource,
  UserResource,
} from '@core/models';
import {
  BudgetPreviewRequest,
  CatalogItemOption,
  ConvertRequisitionLinesPayload,
  ConvertRequisitionLinesResponse,
  CostCenterOption,
  flattenCostCenterTree,
  OneClickActionPayload,
  OneClickActionResponse,
  PrBudgetCheckSnapshot,
  ProjectOption,
  PurchaseRequisitionDetail,
  PurchaseRequisitionListFilters,
  PurchaseRequisitionSummary,
  RequesterOption,
  SavePurchaseRequisitionPayload,
  SupplierOption,
} from '@domain/procurement/purchase-requisition.models';
import { QualifiedSupplierOption } from '@domain/procurement/rfq.models';
import { environment } from '@env';
import { map, Observable } from 'rxjs';
import {
  mapBudgetCheckSnapshot,
  mapConversionResult,
  mapOneClickActionResponse,
  mapRequisitionDetail,
  mapRequisitionSummary,
} from './purchase-requisition.mapper';

/**
 * Typed HTTP gateway for Mod 044 (Purchase Requisitions, Real-Time Budget Check,
 * Multi-Level Internal Approval, Email 1-Click Actions, and Buyer Conversion Workbench).
 */
@Injectable({ providedIn: 'root' })
export class PurchaseRequisitionApiService {
  private readonly http = inject(HttpClient);
  private readonly apiBase = environment.apiBaseUrl;
  private readonly base = `${environment.apiBaseUrl}/procurement/purchase-requisitions`;

  list(filters?: PurchaseRequisitionListFilters): Observable<PaginatedResponse<PurchaseRequisitionSummary>> {
    return this.http
      .get<PaginatedResponse<unknown>>(this.base, {
        params: filters ? toHttpParams(filters) : undefined,
      })
      .pipe(
        map((res) => ({
          ...res,
          data: (res.data ?? []).map(mapRequisitionSummary),
        })),
      );
  }

  create(payload: SavePurchaseRequisitionPayload): Observable<ApiResponse<PurchaseRequisitionDetail>> {
    return this.http
      .post<ApiResponse<unknown>>(this.base, payload)
      .pipe(map((res) => ({ ...res, data: mapRequisitionDetail(res.data) })));
  }

  getById(id: string): Observable<ApiResponse<PurchaseRequisitionDetail>> {
    return this.http
      .get<ApiResponse<unknown>>(`${this.base}/${id}`)
      .pipe(map((res) => ({ ...res, data: mapRequisitionDetail(res.data) })));
  }

  update(
    id: string,
    payload: SavePurchaseRequisitionPayload,
  ): Observable<ApiResponse<PurchaseRequisitionDetail>> {
    return this.http
      .put<ApiResponse<unknown>>(`${this.base}/${id}`, payload)
      .pipe(map((res) => ({ ...res, data: mapRequisitionDetail(res.data) })));
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  budgetPreview(payload: BudgetPreviewRequest): Observable<ApiResponse<PrBudgetCheckSnapshot>> {
    return this.http
      .post<ApiResponse<unknown>>(`${this.base}/budget-preview`, payload, {
        context: handleErrorsLocally(404, 422),
      })
      .pipe(map((res) => ({ ...res, data: mapBudgetCheckSnapshot(res.data) })));
  }

  submit(id: string): Observable<ApiResponse<PurchaseRequisitionDetail>> {
    return this.http
      .post<ApiResponse<unknown>>(`${this.base}/${id}/submit`, {})
      .pipe(map((res) => ({ ...res, data: mapRequisitionDetail(res.data) })));
  }

  approve(id: string, comment?: string | null): Observable<ApiResponse<PurchaseRequisitionDetail>> {
    return this.http
      .post<ApiResponse<unknown>>(`${this.base}/${id}/approve`, {
        comment: comment ?? null,
        channel: 'web',
      })
      .pipe(map((res) => ({ ...res, data: mapRequisitionDetail(res.data) })));
  }

  reject(id: string, comment: string): Observable<ApiResponse<PurchaseRequisitionDetail>> {
    return this.http
      .post<ApiResponse<unknown>>(`${this.base}/${id}/reject`, {
        comment,
        channel: 'web',
      })
      .pipe(map((res) => ({ ...res, data: mapRequisitionDetail(res.data) })));
  }

  oneClickAction(payload: OneClickActionPayload): Observable<ApiResponse<OneClickActionResponse>> {
    return this.http
      .post<ApiResponse<unknown>>(`${this.base}/one-click-action`, payload, {
        context: handleErrorsLocally(400, 401, 403, 404, 409, 410, 422),
      })
      .pipe(
        map((res) => ({
          ...res,
          data: mapOneClickActionResponse(res.data, payload.action, res.message ?? null),
        })),
      );
  }

  listPendingApprovals(
    filters?: PurchaseRequisitionListFilters,
  ): Observable<PaginatedResponse<PurchaseRequisitionSummary>> {
    return this.http
      .get<PaginatedResponse<unknown>>(`${this.base}/pending-approvals`, {
        params: filters ? toHttpParams(filters) : undefined,
      })
      .pipe(
        map((res) => ({
          ...res,
          data: (res.data ?? []).map(mapRequisitionSummary),
        })),
      );
  }

  convert(
    payload: ConvertRequisitionLinesPayload,
  ): Observable<ApiResponse<ConvertRequisitionLinesResponse>> {
    return this.http
      .post<ApiResponse<unknown>>(`${this.base}/convert`, payload)
      .pipe(map((res) => ({ ...res, data: mapConversionResult(res.data) })));
  }

  // --- Supporting ERP Lookups (Cost Centers, Projects, Catalog Items, Users, Suppliers) ---

  listCostCenters(fiscalYear = new Date().getFullYear()): Observable<CostCenterOption[]> {
    return this.http
      .get<ApiResponse<CostCenterNode[]>>(`${this.apiBase}/controlling/cost-centers`, {
        params: toHttpParams({
          view: 'tree',
          fiscal_year: fiscalYear,
          from_month: 1,
          to_month: 12,
        }),
      })
      .pipe(map((res) => flattenCostCenterTree(res.data ?? [])));
  }

  listProjects(search?: string): Observable<ProjectOption[]> {
    return this.http
      .get<PaginatedResponse<ProjectResource>>(`${this.apiBase}/projects`, {
        params: toHttpParams({ per_page: 100, search }),
      })
      .pipe(
        map((res) =>
          (res.data ?? []).map((proj) => ({
            id: proj.id,
            project_number: proj.project_number,
            name: proj.name,
            status: proj.status,
            label: `${proj.project_number} — ${proj.name}`,
          })),
        ),
      );
  }

  listCatalogItems(search?: string): Observable<CatalogItemOption[]> {
    return this.http
      .get<PaginatedResponse<ProductItem>>(`${this.apiBase}/inventory/products`, {
        params: toHttpParams({ per_page: 50, search }),
      })
      .pipe(
        map((res) =>
          (res.data ?? []).map((item) => ({
            id: item.id,
            sku: item.sku,
            name: item.name,
            description: item.description ?? null,
            unit_measure: item.unit_measure || 'PCS',
            cost_price: Number(item.cost_price ?? 0) || 0,
            label: `${item.sku} — ${item.name}`,
          })),
        ),
      );
  }

  listRequesters(): Observable<RequesterOption[]> {
    return this.http
      .get<ApiResponse<UserResource[]>>(`${this.apiBase}/settings/users`)
      .pipe(
        map((res) =>
          (res.data ?? []).map((u) => ({
            id: u.id,
            name: u.name,
            email: u.email,
            role: u.role,
          })),
        ),
      );
  }

  listQualifiedSuppliers(search?: string): Observable<SupplierOption[]> {
    return this.http
      .get<PaginatedResponse<QualifiedSupplierOption>>(`${this.apiBase}/procurement/suppliers`, {
        params: toHttpParams({
          avl_only: true,
          per_page: 100,
          search,
        }),
      })
      .pipe(
        map((res) =>
          (res.data ?? []).map((s) => ({
            id: s.id,
            supplier_code: s.supplier_code,
            company_name: s.company_name,
            vat_number: s.vat_number ?? null,
            currency: s.currency ?? null,
            label: `${s.supplier_code} — ${s.company_name}`,
          })),
        ),
      );
  }
}
