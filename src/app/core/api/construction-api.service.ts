import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { map, Observable } from 'rxjs';
import { toHttpParams } from '../http/laravel-http.utils';
import {
  ApiResponse,
  LaravelPaginationMeta,
  PaginatedResponse,
  QueryFilterParams,
  ConstructionProgressBilling,
  ConstructionProgressBillingPayload,
  ConstructionSite,
  ConstructionSiteRequest,
  TradesBid,
  TradesBidResponse,
  TradesBidPosition,
  TradesBidPositionRequest,
  TradesBidRequest,
  TradesBidStatus,
  TradesBilling,
  TradesBillingRequest,
  TradesBudgetControl,
  TradesMeasurement,
  TradesMeasurementRequest,
  TradesPriceList,
  TradesPriceListRequest,
  TradesSiteCost,
  TradesSiteCostRequest,
  TradesSiteDiaryEntry,
  TradesSiteDiaryRequest,
  TradesSiteDocument,
  TradesSiteDocumentRequest,
  TradesSubcontract,
  TradesSubcontractCertificationRequest,
  TradesSubcontractor,
  TradesSubcontractorRequest,
  TradesSubcontractRequest,
} from '../models';

@Service()
export class ConstructionApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/construction`;
  private readonly tradesBase = `${environment.apiBaseUrl}/construction-trades`;

  // --- SITES & SAL (BASE) ---
  getSites(params: QueryFilterParams = {}): Observable<PaginatedResponse<ConstructionSite>> {
    return this.listPage<ConstructionSite>(`${this.base}/sites`, params);
  }

  createSite(payload: ConstructionSiteRequest): Observable<ApiResponse<ConstructionSite>> {
    return this.http.post<ApiResponse<ConstructionSite>>(`${this.base}/sites`, payload);
  }

  getProgressBillings(params: QueryFilterParams = {}): Observable<PaginatedResponse<ConstructionProgressBilling>> {
    return this.listPage<ConstructionProgressBilling>(`${this.base}/sal`, params);
  }

  createProgressBilling(
    payload: ConstructionProgressBillingPayload,
  ): Observable<ApiResponse<ConstructionProgressBilling>> {
    return this.http.post<ApiResponse<ConstructionProgressBilling>>(`${this.base}/sal`, payload);
  }

  // --- BIDS & TENDERS (/construction-trades/bids) ---
  getBids(params: QueryFilterParams & { status?: string } = {}): Observable<PaginatedResponse<TradesBid>> {
    return this.listPage<TradesBid>(`${this.tradesBase}/bids`, params);
  }

  getBid(id: string): Observable<TradesBidResponse> {
    return this.http.get<TradesBidResponse>(`${this.tradesBase}/bids/${id}`);
  }

  createBid(payload: TradesBidRequest): Observable<ApiResponse<TradesBid>> {
    return this.http.post<ApiResponse<TradesBid>>(`${this.tradesBase}/bids`, payload);
  }

  updateBid(id: string, payload: Partial<TradesBidRequest>): Observable<ApiResponse<TradesBid>> {
    return this.http.put<ApiResponse<TradesBid>>(`${this.tradesBase}/bids/${id}`, payload);
  }

  changeBidStatus(
    id: string,
    payload: { status: TradesBidStatus },
  ): Observable<ApiResponse<TradesBid>> {
    return this.http.post<ApiResponse<TradesBid>>(`${this.tradesBase}/bids/${id}/status`, payload);
  }

  addBidPosition(
    bidId: string,
    payload: TradesBidPositionRequest,
  ): Observable<ApiResponse<TradesBidPosition>> {
    return this.http.post<ApiResponse<TradesBidPosition>>(
      `${this.tradesBase}/bids/${bidId}/positions`,
      payload,
    );
  }

  removeBidPosition(bidId: string, positionId: string): Observable<void> {
    return this.http.delete<void>(`${this.tradesBase}/bids/${bidId}/positions/${positionId}`);
  }

  recordMeasurement(
    bidId: string,
    payload: TradesMeasurementRequest,
  ): Observable<ApiResponse<TradesMeasurement>> {
    return this.http.post<ApiResponse<TradesMeasurement>>(
      `${this.tradesBase}/bids/${bidId}/measurements`,
      payload,
    );
  }

  getBidBillings(bidId: string): Observable<ApiResponse<TradesBilling[]>> {
    return this.http.get<ApiResponse<TradesBilling[]>>(
      `${this.tradesBase}/bids/${bidId}/billings`,
    );
  }

  issueBidBilling(
    bidId: string,
    payload: TradesBillingRequest,
  ): Observable<ApiResponse<TradesBilling>> {
    return this.http.post<ApiResponse<TradesBilling>>(
      `${this.tradesBase}/bids/${bidId}/billings`,
      payload,
    );
  }

  getSiteCosts(bidId: string): Observable<ApiResponse<TradesSiteCost[]>> {
    return this.http.get<ApiResponse<TradesSiteCost[]>>(
      `${this.tradesBase}/bids/${bidId}/site-costs`,
    );
  }

  recordSiteCost(
    bidId: string,
    payload: TradesSiteCostRequest,
  ): Observable<ApiResponse<TradesSiteCost>> {
    return this.http.post<ApiResponse<TradesSiteCost>>(
      `${this.tradesBase}/bids/${bidId}/site-costs`,
      payload,
    );
  }

  getBudgetControl(bidId: string): Observable<ApiResponse<TradesBudgetControl>> {
    return this.http.get<ApiResponse<TradesBudgetControl>>(
      `${this.tradesBase}/bids/${bidId}/budget-control`,
    );
  }

  // --- PRICE LISTS (/construction-trades/price-lists) ---
  getPriceLists(): Observable<ApiResponse<TradesPriceList[]>> {
    return this.http.get<ApiResponse<TradesPriceList[]>>(`${this.tradesBase}/price-lists`);
  }

  createPriceList(payload: TradesPriceListRequest): Observable<ApiResponse<TradesPriceList>> {
    return this.http.post<ApiResponse<TradesPriceList>>(`${this.tradesBase}/price-lists`, payload);
  }

  // --- SITE DIARY & DOCUMENTS (/construction-trades/sites/...) ---
  getSiteDiary(siteId: string, params: QueryFilterParams = {}): Observable<PaginatedResponse<TradesSiteDiaryEntry>> {
    return this.listPage<TradesSiteDiaryEntry>(`${this.tradesBase}/sites/${siteId}/diary`, params);
  }

  writeSiteDiary(
    siteId: string,
    payload: TradesSiteDiaryRequest,
  ): Observable<ApiResponse<TradesSiteDiaryEntry>> {
    return this.http.post<ApiResponse<TradesSiteDiaryEntry>>(
      `${this.tradesBase}/sites/${siteId}/diary`,
      payload,
    );
  }

  getSiteDocuments(siteId: string, params: QueryFilterParams = {}): Observable<PaginatedResponse<TradesSiteDocument>> {
    return this.listPage<TradesSiteDocument>(`${this.tradesBase}/sites/${siteId}/documents`, params);
  }

  addSiteDocument(
    siteId: string,
    payload: TradesSiteDocumentRequest,
  ): Observable<ApiResponse<TradesSiteDocument>> {
    return this.http.post<ApiResponse<TradesSiteDocument>>(
      `${this.tradesBase}/sites/${siteId}/documents`,
      payload,
    );
  }

  getExpiringDocuments(withinDays = 30): Observable<ApiResponse<TradesSiteDocument[]>> {
    return this.http.get<ApiResponse<TradesSiteDocument[]>>(
      `${this.tradesBase}/site-documents/expiring`,
      { params: { within_days: withinDays } },
    );
  }

  // --- SUBCONTRACTORS (/construction-trades/subcontractors) ---
  getSubcontractors(): Observable<ApiResponse<TradesSubcontractor[]>> {
    return this.http.get<ApiResponse<TradesSubcontractor[]>>(
      `${this.tradesBase}/subcontractors`,
    );
  }

  createSubcontractor(
    payload: TradesSubcontractorRequest,
  ): Observable<ApiResponse<TradesSubcontractor>> {
    return this.http.post<ApiResponse<TradesSubcontractor>>(
      `${this.tradesBase}/subcontractors`,
      payload,
    );
  }

  getSiteSubcontracts(siteId: string, params: QueryFilterParams = {}): Observable<PaginatedResponse<TradesSubcontract>> {
    return this.listPage<TradesSubcontract>(`${this.tradesBase}/sites/${siteId}/subcontracts`, params);
  }

  createSiteSubcontract(
    siteId: string,
    payload: TradesSubcontractRequest,
  ): Observable<ApiResponse<TradesSubcontract>> {
    return this.http.post<ApiResponse<TradesSubcontract>>(
      `${this.tradesBase}/sites/${siteId}/subcontracts`,
      payload,
    );
  }

  certifySubcontractWork(
    subcontractId: string,
    payload: TradesSubcontractCertificationRequest,
  ): Observable<ApiResponse<TradesSubcontract>> {
    return this.http.post<ApiResponse<TradesSubcontract>>(
      `${this.tradesBase}/subcontracts/${subcontractId}/certifications`,
      payload,
    );
  }

  /** A list endpoint: the rows may sit in `data` or in a Laravel paginator wrapped in `data`. */
  private listPage<T>(url: string, params: object): Observable<PaginatedResponse<T>> {
    type PaginatorBody = LaravelPaginationMeta & { data: T[] };
    return this.http
      .get<ApiResponse<T[] | PaginatorBody> & { meta?: LaravelPaginationMeta }>(url, { params: toHttpParams(params) })
      .pipe(
        map((res) => {
          const body = res.data;
          const items = Array.isArray(body) ? body : (body?.data ?? []);
          const meta: LaravelPaginationMeta =
            res.meta ??
            (Array.isArray(body) || !body
              ? { current_page: 1, from: null, to: null, last_page: 1, per_page: items.length, total: items.length }
              : {
                  current_page: body.current_page,
                  from: body.from,
                  to: body.to,
                  last_page: body.last_page,
                  per_page: body.per_page,
                  total: body.total,
                });
          return { ...res, data: items, meta };
        }),
      );
  }
}
