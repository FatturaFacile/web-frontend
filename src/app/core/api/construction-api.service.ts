import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import {
  ApiResponse,
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
  getSites(): Observable<ApiResponse<ConstructionSite[]>> {
    return this.http.get<ApiResponse<ConstructionSite[]>>(`${this.base}/sites`);
  }

  createSite(payload: ConstructionSiteRequest): Observable<ApiResponse<ConstructionSite>> {
    return this.http.post<ApiResponse<ConstructionSite>>(`${this.base}/sites`, payload);
  }

  getProgressBillings(): Observable<ApiResponse<ConstructionProgressBilling[]>> {
    return this.http.get<ApiResponse<ConstructionProgressBilling[]>>(`${this.base}/sal`);
  }

  createProgressBilling(
    payload: ConstructionProgressBillingPayload,
  ): Observable<ApiResponse<ConstructionProgressBilling>> {
    return this.http.post<ApiResponse<ConstructionProgressBilling>>(`${this.base}/sal`, payload);
  }

  // --- BIDS & TENDERS (/construction-trades/bids) ---
  getBids(): Observable<ApiResponse<TradesBid[]>> {
    return this.http.get<ApiResponse<TradesBid[]>>(`${this.tradesBase}/bids`);
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
  getSiteDiary(siteId: string): Observable<ApiResponse<TradesSiteDiaryEntry[]>> {
    return this.http.get<ApiResponse<TradesSiteDiaryEntry[]>>(
      `${this.tradesBase}/sites/${siteId}/diary`,
    );
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

  getSiteDocuments(siteId: string): Observable<ApiResponse<TradesSiteDocument[]>> {
    return this.http.get<ApiResponse<TradesSiteDocument[]>>(
      `${this.tradesBase}/sites/${siteId}/documents`,
    );
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

  getExpiringDocuments(): Observable<ApiResponse<TradesSiteDocument[]>> {
    return this.http.get<ApiResponse<TradesSiteDocument[]>>(
      `${this.tradesBase}/site-documents/expiring`,
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

  getSiteSubcontracts(siteId: string): Observable<ApiResponse<TradesSubcontract[]>> {
    return this.http.get<ApiResponse<TradesSubcontract[]>>(
      `${this.tradesBase}/sites/${siteId}/subcontracts`,
    );
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
}
