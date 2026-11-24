import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { toHttpParams } from '../http/laravel-http.utils';
import {
  ApiResponse,
  PaginatedResponse,
  QueryFilterParams,
  TradesLanguage,
  TradesPriceList,
  TradesPriceListRequest,
  TradesSiteDiaryEntry,
  TradesSiteDiaryRequest,
  TradesSubcontract,
  TradesSubcontractor,
  TradesSubcontractorRequest,
} from '../models';
import { ExtraRecord } from './extra-api.types';

export interface TradesPriceItemRequest {
  position_code: string;
  parent_code?: string | null;
  unit: string;
  unit_price: string;
  labour_minutes?: string | null;
  material_cost?: string | null;
  machine_cost?: string | null;
  descriptions: Partial<Record<TradesLanguage, string>>;
}

export interface TradesWorkCycleStepRequest {
  price_item_id?: string | null;
  descriptions: Partial<Record<TradesLanguage, string>>;
  quantity_factor?: string | null;
  unit_price: string;
  labour_minutes?: string | null;
  material_cost?: string | null;
  machine_cost?: string | null;
}

export interface TradesWorkCycleRequest {
  name: string;
  unit: string;
  descriptions: Partial<Record<TradesLanguage, string>>;
  is_active?: boolean;
  steps: TradesWorkCycleStepRequest[];
}

/** Construction trades endpoints not covered by `ConstructionApiService`. */
@Service()
export class ConstructionTradesExtraApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/construction-trades`;

  // --- PRICE LISTS ---
  getPriceList(id: string): Observable<ApiResponse<TradesPriceList>> {
    return this.http.get<ApiResponse<TradesPriceList>>(`${this.base}/price-lists/${id}`);
  }

  updatePriceList(id: string, payload: Partial<TradesPriceListRequest>): Observable<ApiResponse<TradesPriceList>> {
    return this.http.put<ApiResponse<TradesPriceList>>(`${this.base}/price-lists/${id}`, payload);
  }

  addPriceItem(priceListId: string, payload: TradesPriceItemRequest): Observable<ApiResponse<ExtraRecord>> {
    return this.http.post<ApiResponse<ExtraRecord>>(`${this.base}/price-lists/${priceListId}/items`, payload);
  }

  /** Imports price items from a CSV file (multipart `file`). */
  importPriceList(priceListId: string, file: File): Observable<ApiResponse<ExtraRecord>> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<ApiResponse<ExtraRecord>>(`${this.base}/price-lists/${priceListId}/import`, formData);
  }

  // --- WORK CYCLES ---
  getWorkCycles(params?: QueryFilterParams): Observable<PaginatedResponse<ExtraRecord>> {
    return this.http.get<PaginatedResponse<ExtraRecord>>(`${this.base}/work-cycles`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  getWorkCycle(id: string): Observable<ApiResponse<ExtraRecord>> {
    return this.http.get<ApiResponse<ExtraRecord>>(`${this.base}/work-cycles/${id}`);
  }

  createWorkCycle(payload: TradesWorkCycleRequest): Observable<ApiResponse<ExtraRecord>> {
    return this.http.post<ApiResponse<ExtraRecord>>(`${this.base}/work-cycles`, payload);
  }

  // --- BIDS: tender specification and settlement ---
  getTenderSpecification(bidId: string, params?: QueryFilterParams): Observable<ApiResponse<ExtraRecord>> {
    return this.http.get<ApiResponse<ExtraRecord>>(`${this.base}/bids/${bidId}/tender-specification`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  getSettlement(bidId: string): Observable<ApiResponse<ExtraRecord>> {
    return this.http.get<ApiResponse<ExtraRecord>>(`${this.base}/bids/${bidId}/settlement`);
  }

  approveSettlement(bidId: string): Observable<ApiResponse<ExtraRecord>> {
    return this.http.post<ApiResponse<ExtraRecord>>(`${this.base}/bids/${bidId}/settlement/approve`, {});
  }

  // --- SUBCONTRACTORS & SUBCONTRACTS ---
  updateSubcontractor(
    id: string,
    payload: Partial<TradesSubcontractorRequest>,
  ): Observable<ApiResponse<TradesSubcontractor>> {
    return this.http.put<ApiResponse<TradesSubcontractor>>(`${this.base}/subcontractors/${id}`, payload);
  }

  getSubcontract(id: string): Observable<ApiResponse<TradesSubcontract>> {
    return this.http.get<ApiResponse<TradesSubcontract>>(`${this.base}/subcontracts/${id}`);
  }

  setSubcontractStatus(id: string, status: 'completed' | 'cancelled'): Observable<ApiResponse<TradesSubcontract>> {
    return this.http.post<ApiResponse<TradesSubcontract>>(`${this.base}/subcontracts/${id}/status`, { status });
  }

  // --- SITE DIARY & DOCUMENTS ---
  updateDiaryEntry(
    id: string,
    payload: Partial<Omit<TradesSiteDiaryRequest, 'entry_date'>>,
  ): Observable<ApiResponse<TradesSiteDiaryEntry>> {
    return this.http.put<ApiResponse<TradesSiteDiaryEntry>>(`${this.base}/diary/${id}`, payload);
  }

  deleteSiteDocument(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/site-documents/${id}`);
  }
}
