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

/** Additional endpoints of the procurement API not covered by the dedicated typed services. */
@Service()
export class ProcurementExtraApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  /** POST /procurement/suppliers */
  createSupplier(payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/procurement/suppliers`, payload);
  }

  /** GET /procurement/suppliers/{} */
  getSupplier(supplierId: string, filters?: Filters): Observable<ApiResponse<Row>> {
    return this.http.get<ApiResponse<Row>>(`${this.base}/procurement/suppliers/${supplierId}`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** PUT /procurement/suppliers/{} */
  updateSupplier(supplierId: string, payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.put<ApiResponse<Row>>(`${this.base}/procurement/suppliers/${supplierId}`, payload);
  }

  /** DELETE /procurement/suppliers/{} */
  deleteSupplier(supplierId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/procurement/suppliers/${supplierId}`);
  }

  /** GET /procurement/evaluations */
  listEvaluations(filters?: Filters): Observable<ListResponse<Row>> {
    return this.http.get<ListResponse<Row>>(`${this.base}/procurement/evaluations`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** POST /procurement/suppliers/{}/evaluations */
  createSupplierEvaluation(supplierId: string, payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/procurement/suppliers/${supplierId}/evaluations`, payload);
  }

  /** GET /procurement/suppliers/{}/scorecard */
  getSupplierScorecard(supplierId: string, filters?: Filters): Observable<ApiResponse<Row>> {
    return this.http.get<ApiResponse<Row>>(`${this.base}/procurement/suppliers/${supplierId}/scorecard`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** GET /procurement/contracts */
  listContracts(filters?: Filters): Observable<ListResponse<Row>> {
    return this.http.get<ListResponse<Row>>(`${this.base}/procurement/contracts`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** POST /procurement/contracts */
  createContract(payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/procurement/contracts`, payload);
  }

  /** GET /procurement/contracts/{} */
  getContract(contractId: string, filters?: Filters): Observable<ApiResponse<Row>> {
    return this.http.get<ApiResponse<Row>>(`${this.base}/procurement/contracts/${contractId}`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** PUT /procurement/contracts/{} */
  updateContract(contractId: string, payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.put<ApiResponse<Row>>(`${this.base}/procurement/contracts/${contractId}`, payload);
  }

  /** DELETE /procurement/contracts/{} */
  deleteContract(contractId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/procurement/contracts/${contractId}`);
  }

  /** GET /procurement/requisitions/{} */
  getRequisition(requisitionId: string, filters?: Filters): Observable<ApiResponse<Row>> {
    return this.http.get<ApiResponse<Row>>(`${this.base}/procurement/requisitions/${requisitionId}`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** PUT /procurement/requisitions/{} */
  updateRequisition(requisitionId: string, payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.put<ApiResponse<Row>>(`${this.base}/procurement/requisitions/${requisitionId}`, payload);
  }

  /** DELETE /procurement/requisitions/{} */
  deleteRequisition(requisitionId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/procurement/requisitions/${requisitionId}`);
  }

  /** POST /procurement/requisitions/{}/cancel */
  cancelRequisition(requisitionId: string, payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/procurement/requisitions/${requisitionId}/cancel`, payload);
  }

  /** PUT /procurement/purchase-orders/{} */
  updatePurchaseOrder(purchaseOrderId: string, payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.put<ApiResponse<Row>>(`${this.base}/procurement/purchase-orders/${purchaseOrderId}`, payload);
  }

  /** DELETE /procurement/purchase-orders/{} */
  deletePurchaseOrder(purchaseOrderId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/procurement/purchase-orders/${purchaseOrderId}`);
  }

  /** GET /procurement/returns */
  listReturns(filters?: Filters): Observable<ListResponse<Row>> {
    return this.http.get<ListResponse<Row>>(`${this.base}/procurement/returns`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** POST /procurement/purchase-orders/{}/returns */
  createPurchaseOrderReturn(purchaseOrderId: string, payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/procurement/purchase-orders/${purchaseOrderId}/returns`, payload);
  }

  /** GET /procurement/returns/{} */
  getReturn(returnId: string, filters?: Filters): Observable<ApiResponse<Row>> {
    return this.http.get<ApiResponse<Row>>(`${this.base}/procurement/returns/${returnId}`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** POST /procurement/price-checks */
  createPriceCheck(payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/procurement/price-checks`, payload);
  }

  /** GET /procurement/settings */
  getSettings(filters?: Filters): Observable<ApiResponse<Row>> {
    return this.http.get<ApiResponse<Row>>(`${this.base}/procurement/settings`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** PUT /procurement/settings */
  saveSettings(payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.put<ApiResponse<Row>>(`${this.base}/procurement/settings`, payload);
  }

  /** GET /procurement/approval-matrices */
  listApprovalMatrices(filters?: Filters): Observable<ListResponse<Row>> {
    return this.http.get<ListResponse<Row>>(`${this.base}/procurement/approval-matrices`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** POST /procurement/approval-matrices */
  createApprovalMatrice(payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/procurement/approval-matrices`, payload);
  }

  /** DELETE /procurement/approval-matrices/{} */
  deleteApprovalMatrice(approvalMatriceId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/procurement/approval-matrices/${approvalMatriceId}`);
  }

  /** GET /procurement/catalogs */
  listCatalogs(filters?: Filters): Observable<ListResponse<Row>> {
    return this.http.get<ListResponse<Row>>(`${this.base}/procurement/catalogs`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** POST /procurement/catalogs */
  createCatalog(payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/procurement/catalogs`, payload);
  }

  /** GET /procurement/catalogs/{} */
  getCatalog(catalogId: string, filters?: Filters): Observable<ApiResponse<Row>> {
    return this.http.get<ApiResponse<Row>>(`${this.base}/procurement/catalogs/${catalogId}`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** PUT /procurement/catalogs/{} */
  updateCatalog(catalogId: string, payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.put<ApiResponse<Row>>(`${this.base}/procurement/catalogs/${catalogId}`, payload);
  }

  /** POST /procurement/catalogs/{}/prices */
  createCatalogPrice(catalogId: string, payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/procurement/catalogs/${catalogId}/prices`, payload);
  }

  /** GET /procurement/catalogs/{}/price */
  getCatalogPrice(catalogId: string, filters?: Filters): Observable<ApiResponse<Row>> {
    return this.http.get<ApiResponse<Row>>(`${this.base}/procurement/catalogs/${catalogId}/price`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** GET /procurement/offers */
  listOffers(filters?: Filters): Observable<ListResponse<Row>> {
    return this.http.get<ListResponse<Row>>(`${this.base}/procurement/offers`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** PUT /procurement/suppliers/{}/qualification */
  updateSupplierQualification(supplierId: string, payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.put<ApiResponse<Row>>(`${this.base}/procurement/suppliers/${supplierId}/qualification`, payload);
  }

  /** GET /procurement/suppliers/{}/documents */
  listSupplierDocuments(supplierId: string, filters?: Filters): Observable<ListResponse<Row>> {
    return this.http.get<ListResponse<Row>>(`${this.base}/procurement/suppliers/${supplierId}/documents`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** POST /procurement/suppliers/{}/documents */
  createSupplierDocument(supplierId: string, payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/procurement/suppliers/${supplierId}/documents`, payload);
  }

  /** GET /procurement/supplier-documents/expiring */
  getSupplierDocumentExpiring(filters?: Filters): Observable<ApiResponse<Row>> {
    return this.http.get<ApiResponse<Row>>(`${this.base}/procurement/supplier-documents/expiring`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** DELETE /procurement/supplier-documents/{} */
  deleteSupplierDocument(supplierDocumentId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/procurement/supplier-documents/${supplierDocumentId}`);
  }

  /** POST /procurement/supplier-qualifications/expire */
  expireSupplierQualification(payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/procurement/supplier-qualifications/expire`, payload);
  }

  /** GET /procurement/suppliers/{}/performance */
  getSupplierPerformance(supplierId: string, filters?: Filters): Observable<ApiResponse<Row>> {
    return this.http.get<ApiResponse<Row>>(`${this.base}/procurement/suppliers/${supplierId}/performance`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** POST /procurement/suppliers/{}/evaluations/compute */
  computeSupplierEvaluation(supplierId: string, payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/procurement/suppliers/${supplierId}/evaluations/compute`, payload);
  }

  /** GET /procurement/rfqs */
  listRfqs(filters?: Filters): Observable<ListResponse<Row>> {
    return this.http.get<ListResponse<Row>>(`${this.base}/procurement/rfqs`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** POST /procurement/rfqs */
  createRfq(payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/procurement/rfqs`, payload);
  }

  /** GET /procurement/rfqs/{} */
  getRfq(rfqId: string, filters?: Filters): Observable<ApiResponse<Row>> {
    return this.http.get<ApiResponse<Row>>(`${this.base}/procurement/rfqs/${rfqId}`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** POST /procurement/rfqs/{}/issue */
  issueRfq(rfqId: string, payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/procurement/rfqs/${rfqId}/issue`, payload);
  }

  /** POST /procurement/rfqs/{}/quotes */
  createRfqQuote(rfqId: string, payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/procurement/rfqs/${rfqId}/quotes`, payload);
  }

  /** GET /procurement/rfqs/{}/comparison */
  getRfqComparison(rfqId: string, filters?: Filters): Observable<ApiResponse<Row>> {
    return this.http.get<ApiResponse<Row>>(`${this.base}/procurement/rfqs/${rfqId}/comparison`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** POST /procurement/rfqs/{}/award */
  awardRfq(rfqId: string, payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/procurement/rfqs/${rfqId}/award`, payload);
  }

  /** POST /procurement/rfqs/{}/cancel */
  cancelRfq(rfqId: string, payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/procurement/rfqs/${rfqId}/cancel`, payload);
  }

  /** GET /procurement/contracts/{}/lines */
  listContractLines(contractId: string, filters?: Filters): Observable<ListResponse<Row>> {
    return this.http.get<ListResponse<Row>>(`${this.base}/procurement/contracts/${contractId}/lines`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** POST /procurement/contracts/{}/lines */
  createContractLine(contractId: string, payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/procurement/contracts/${contractId}/lines`, payload);
  }

  /** POST /procurement/contracts/{}/call-offs */
  createContractCallOff(contractId: string, payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/procurement/contracts/${contractId}/call-offs`, payload);
  }

  /** POST /procurement/returns/{}/credit-note */
  createReturnCreditNote(returnId: string, payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/procurement/returns/${returnId}/credit-note`, payload);
  }

  /** GET /procurement/landed-costs */
  listLandedCosts(filters?: Filters): Observable<ListResponse<Row>> {
    return this.http.get<ListResponse<Row>>(`${this.base}/procurement/landed-costs`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** POST /procurement/landed-costs */
  createLandedCost(payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/procurement/landed-costs`, payload);
  }

  /** GET /procurement/landed-costs/{} */
  getLandedCost(landedCostId: string, filters?: Filters): Observable<ApiResponse<Row>> {
    return this.http.get<ApiResponse<Row>>(`${this.base}/procurement/landed-costs/${landedCostId}`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** POST /procurement/landed-costs/{}/post */
  postLandedCost(landedCostId: string, payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/procurement/landed-costs/${landedCostId}/post`, payload);
  }

  /** POST /procurement/landed-costs/{}/cancel */
  cancelLandedCost(landedCostId: string, payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/procurement/landed-costs/${landedCostId}/cancel`, payload);
  }

  /** GET /procurement/analytics/spend */
  getAnalyticsSpend(filters?: Filters): Observable<ApiResponse<Row>> {
    return this.http.get<ApiResponse<Row>>(`${this.base}/procurement/analytics/spend`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** GET /procurement/analytics/open-orders */
  listAnalyticsOpenOrders(filters?: Filters): Observable<ListResponse<Row>> {
    return this.http.get<ListResponse<Row>>(`${this.base}/procurement/analytics/open-orders`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** GET /procurement/analytics/price-variance */
  getAnalyticsPriceVariance(filters?: Filters): Observable<ApiResponse<Row>> {
    return this.http.get<ApiResponse<Row>>(`${this.base}/procurement/analytics/price-variance`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** GET /procurement/purchase-suggestions */
  listPurchaseSuggestions(filters?: Filters): Observable<ListResponse<Row>> {
    return this.http.get<ListResponse<Row>>(`${this.base}/procurement/purchase-suggestions`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** POST /procurement/purchase-suggestions/generate */
  generatePurchaseSuggestion(payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/procurement/purchase-suggestions/generate`, payload);
  }

  /** POST /procurement/purchase-suggestions/convert */
  convertPurchaseSuggestion(payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/procurement/purchase-suggestions/convert`, payload);
  }

  /** POST /procurement/purchase-suggestions/{}/dismiss */
  dismissPurchaseSuggestion(purchaseSuggestionId: string, payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/procurement/purchase-suggestions/${purchaseSuggestionId}/dismiss`, payload);
  }
}
