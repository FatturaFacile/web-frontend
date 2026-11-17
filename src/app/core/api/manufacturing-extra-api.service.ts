import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { ApiResponse, PaginatedResponse, QueryFilterParams } from '../models';
import { toHttpParams } from '../http/laravel-http.utils';

/** Generic record used for manufacturing extension resources and payloads. */
export type MfgRecord = Record<string, unknown>;

/** Manufacturing endpoints not covered by ManufacturingApiService (ECO, quality, shop floor, subcontracting, MRP extras). */
@Service()
export class ManufacturingExtraApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/manufacturing`;

  private list(path: string, params?: QueryFilterParams): Observable<PaginatedResponse<MfgRecord>> {
    return this.http.get<PaginatedResponse<MfgRecord>>(`${this.base}/${path}`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  private one(path: string): Observable<ApiResponse<MfgRecord>> {
    return this.http.get<ApiResponse<MfgRecord>>(`${this.base}/${path}`);
  }

  private post(path: string, payload: MfgRecord = {}): Observable<ApiResponse<MfgRecord>> {
    return this.http.post<ApiResponse<MfgRecord>>(`${this.base}/${path}`, payload);
  }

  private put(path: string, payload: MfgRecord): Observable<ApiResponse<MfgRecord>> {
    return this.http.put<ApiResponse<MfgRecord>>(`${this.base}/${path}`, payload);
  }

  // --- BOM / items / routings ---
  getBomList(params?: QueryFilterParams) { return this.list('bom', params); }
  updateBom(id: string, payload: MfgRecord) { return this.put(`boms/${id}`, payload); }
  createItem(payload: MfgRecord) { return this.post('items', payload); }
  getItem(id: string) { return this.one(`items/${id}`); }
  updateItem(id: string, payload: MfgRecord) { return this.put(`items/${id}`, payload); }
  rollupItemCost(id: string, payload: MfgRecord = {}) { return this.post(`items/${id}/cost-rollup`, payload); }
  getItemWhereUsed(id: string) { return this.one(`items/${id}/where-used`); }
  getRouting(id: string) { return this.one(`routings/${id}`); }
  getKpis(params?: QueryFilterParams) { return this.list('kpis', params); }

  // --- Engineering changes ---
  getEngineeringChanges(params?: QueryFilterParams) { return this.list('engineering-changes', params); }
  createEngineeringChange(payload: MfgRecord) { return this.post('engineering-changes', payload); }
  getEngineeringChange(id: string) { return this.one(`engineering-changes/${id}`); }
  submitEngineeringChange(id: string) { return this.post(`engineering-changes/${id}/submit`); }
  approveEngineeringChange(id: string, payload: MfgRecord = {}) { return this.post(`engineering-changes/${id}/approve`, payload); }
  rejectEngineeringChange(id: string, payload: MfgRecord = {}) { return this.post(`engineering-changes/${id}/reject`, payload); }
  implementEngineeringChange(id: string, payload: MfgRecord = {}) { return this.post(`engineering-changes/${id}/implement`, payload); }

  // --- MRP ---
  getMrpForecasts(params?: QueryFilterParams) { return this.list('mrp/forecasts', params); }
  createMrpForecast(payload: MfgRecord) { return this.post('mrp/forecasts', payload); }
  deleteMrpForecast(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/mrp/forecasts/${id}`);
  }
  linkPlannedOrderProcurement(id: string, payload: MfgRecord = {}) { return this.post(`mrp/planned-orders/${id}/procurement-link`, payload); }
  getMrpPurchaseSuggestions(params?: QueryFilterParams) { return this.list('mrp/purchase-suggestions', params); }

  // --- Production order extras ---
  getProductionOrderCostRollup(id: string) { return this.one(`production-orders/${id}/cost-rollup`); }
  getProductionOrderTransactions(id: string, params?: QueryFilterParams) { return this.list(`production-orders/${id}/transactions`, params); }
  issueMaterials(id: string, payload: MfgRecord) { return this.post(`production-orders/${id}/issues`, payload); }
  confirmOperation(id: string, operationId: string, payload: MfgRecord) {
    return this.post(`production-orders/${id}/operations/${operationId}/confirmations`, payload);
  }
  receiveProduction(id: string, payload: MfgRecord) { return this.post(`production-orders/${id}/receipts`, payload); }
  rescheduleProductionOrder(id: string, payload: MfgRecord) { return this.post(`production-orders/${id}/reschedule`, payload); }
  createSubcontractOrder(productionOrderId: string, payload: MfgRecord) {
    return this.post(`production-orders/${productionOrderId}/subcontract-orders`, payload);
  }
  trackStage(stageId: string, payload: MfgRecord = {}) { return this.post(`stages/${stageId}/track`, payload); }

  // --- Quality ---
  getQualityInspections(params?: QueryFilterParams) { return this.list('quality/inspections', params); }
  createQualityInspection(payload: MfgRecord) { return this.post('quality/inspections', payload); }
  getNonConformances(params?: QueryFilterParams) { return this.list('quality/non-conformances', params); }
  createNonConformance(payload: MfgRecord) { return this.post('quality/non-conformances', payload); }
  resolveNonConformance(id: string, payload: MfgRecord = {}) { return this.post(`quality/non-conformances/${id}/resolve`, payload); }
  getQualityPlans(params?: QueryFilterParams) { return this.list('quality/plans', params); }
  createQualityPlan(payload: MfgRecord) { return this.post('quality/plans', payload); }

  // --- Accounting settings ---
  getAccountingSettings() { return this.one('settings/accounting'); }
  updateAccountingSettings(payload: MfgRecord) { return this.put('settings/accounting', payload); }

  // --- Shop floor ---
  getShopFloorExecutions(params?: QueryFilterParams) { return this.list('shop-floor/executions', params); }
  startShopFloorExecution(payload: MfgRecord) { return this.post('shop-floor/executions', payload); }
  completeShopFloorExecution(id: string, payload: MfgRecord = {}) { return this.post(`shop-floor/executions/${id}/complete`, payload); }
  recordShopFloorDowntime(id: string, payload: MfgRecord) { return this.post(`shop-floor/executions/${id}/downtime`, payload); }

  // --- Subcontracting ---
  getSubcontractOrders(params?: QueryFilterParams) { return this.list('subcontract-orders', params); }
  getSubcontractOrder(id: string) { return this.one(`subcontract-orders/${id}`); }
  cancelSubcontractOrder(id: string, payload: MfgRecord = {}) { return this.post(`subcontract-orders/${id}/cancel`, payload); }
  receiveSubcontractOrder(id: string, payload: MfgRecord) { return this.post(`subcontract-orders/${id}/receive`, payload); }

  // --- Work centers ---
  getWorkCenter(id: string) { return this.one(`work-centers/${id}`); }
  updateWorkCenter(id: string, payload: MfgRecord) { return this.put(`work-centers/${id}`, payload); }
  updateWorkCenterCalendar(id: string, payload: MfgRecord) { return this.put(`work-centers/${id}/calendar`, payload); }
  addWorkCenterCalendarException(id: string, payload: MfgRecord) { return this.post(`work-centers/${id}/calendar-exceptions`, payload); }
  getWorkCenterCapacity(id: string, params?: QueryFilterParams) { return this.list(`work-centers/${id}/capacity`, params); }
}
