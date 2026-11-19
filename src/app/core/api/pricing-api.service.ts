import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import {
  CustomerSpecialPrice,
  CustomerSpecialPriceRequest,
  MarginDocumentCheck,
  MarginDocumentType,
  MarginOverrideApproval,
  MarginPolicy,
  MarginPolicyRequest,
  PricingPriceHistory,
  PricingPriceListItem,
  PricingPriceListItemRequest,
  PricingPromotion,
  PricingPromotionRequest,
  PricingResolveRequest,
  PricingResolveResult,
  PricingResponse,
} from '../models';

/** Advanced pricing endpoints (price list items, special prices, promotions, margin policies, history, overrides). */
@Service()
export class PricingApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/pricing`;

  resolve(payload: PricingResolveRequest): Observable<PricingResponse<PricingResolveResult>> {
    return this.http.post<PricingResponse<PricingResolveResult>>(`${this.base}/resolve`, payload);
  }

  // Price list items
  getItems(listId: string): Observable<PricingResponse<PricingPriceListItem[]>> {
    return this.http.get<PricingResponse<PricingPriceListItem[]>>(
      `${this.base}/price-lists/${listId}/items`,
      { params: this.params({ per_page: 200 }) },
    );
  }

  createItem(
    listId: string,
    payload: PricingPriceListItemRequest,
  ): Observable<PricingResponse<PricingPriceListItem>> {
    return this.http.post<PricingResponse<PricingPriceListItem>>(
      `${this.base}/price-lists/${listId}/items`,
      payload,
    );
  }

  updateItem(
    listId: string,
    id: string,
    payload: Partial<PricingPriceListItemRequest>,
  ): Observable<PricingResponse<PricingPriceListItem>> {
    return this.http.put<PricingResponse<PricingPriceListItem>>(
      `${this.base}/price-lists/${listId}/items/${id}`,
      payload,
    );
  }

  deleteItem(listId: string, id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/price-lists/${listId}/items/${id}`);
  }

  bulkItems(
    listId: string,
    items: PricingPriceListItemRequest[],
    reason?: string,
  ): Observable<PricingResponse<{ created: number; updated: number }>> {
    return this.http.post<PricingResponse<{ created: number; updated: number }>>(
      `${this.base}/price-lists/${listId}/items/bulk`,
      { items, reason },
    );
  }

  getHistory(filters: {
    price_list_id?: string;
    product_id?: string;
    per_page?: number;
  }): Observable<PricingResponse<PricingPriceHistory[]>> {
    return this.http.get<PricingResponse<PricingPriceHistory[]>>(`${this.base}/price-history`, {
      params: this.params(filters),
    });
  }

  // Special prices
  getSpecialPrices(filters?: {
    customer_id?: string;
    product_id?: string;
    per_page?: number;
  }): Observable<PricingResponse<CustomerSpecialPrice[]>> {
    return this.http.get<PricingResponse<CustomerSpecialPrice[]>>(`${this.base}/special-prices`, {
      params: this.params(filters),
    });
  }

  createSpecialPrice(
    payload: CustomerSpecialPriceRequest,
  ): Observable<PricingResponse<CustomerSpecialPrice>> {
    return this.http.post<PricingResponse<CustomerSpecialPrice>>(
      `${this.base}/special-prices`,
      payload,
    );
  }

  updateSpecialPrice(
    id: string,
    payload: Partial<CustomerSpecialPriceRequest>,
  ): Observable<PricingResponse<CustomerSpecialPrice>> {
    return this.http.put<PricingResponse<CustomerSpecialPrice>>(
      `${this.base}/special-prices/${id}`,
      payload,
    );
  }

  deleteSpecialPrice(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/special-prices/${id}`);
  }

  // Promotions
  getPromotions(filters?: {
    type?: string;
    per_page?: number;
  }): Observable<PricingResponse<PricingPromotion[]>> {
    return this.http.get<PricingResponse<PricingPromotion[]>>(`${this.base}/promotions`, {
      params: this.params(filters),
    });
  }

  createPromotion(payload: PricingPromotionRequest): Observable<PricingResponse<PricingPromotion>> {
    return this.http.post<PricingResponse<PricingPromotion>>(`${this.base}/promotions`, payload);
  }

  updatePromotion(
    id: string,
    payload: Partial<PricingPromotionRequest>,
  ): Observable<PricingResponse<PricingPromotion>> {
    return this.http.put<PricingResponse<PricingPromotion>>(
      `${this.base}/promotions/${id}`,
      payload,
    );
  }

  deletePromotion(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/promotions/${id}`);
  }

  // Margin policies and overrides
  getMarginPolicies(): Observable<PricingResponse<MarginPolicy[]>> {
    return this.http.get<PricingResponse<MarginPolicy[]>>(`${this.base}/margin-policies`, {
      params: this.params({ per_page: 100 }),
    });
  }

  createMarginPolicy(payload: MarginPolicyRequest): Observable<PricingResponse<MarginPolicy>> {
    return this.http.post<PricingResponse<MarginPolicy>>(`${this.base}/margin-policies`, payload);
  }

  updateMarginPolicy(
    id: string,
    payload: Partial<MarginPolicyRequest>,
  ): Observable<PricingResponse<MarginPolicy>> {
    return this.http.put<PricingResponse<MarginPolicy>>(
      `${this.base}/margin-policies/${id}`,
      payload,
    );
  }

  deleteMarginPolicy(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/margin-policies/${id}`);
  }

  checkDocumentMargin(
    documentType: MarginDocumentType,
    documentId: string,
  ): Observable<PricingResponse<MarginDocumentCheck>> {
    return this.http.get<PricingResponse<MarginDocumentCheck>>(
      `${this.base}/margin-overrides/check/${documentType}/${documentId}`,
    );
  }

  approveMarginOverride(
    documentType: MarginDocumentType,
    documentId: string,
    notes?: string,
  ): Observable<PricingResponse<MarginOverrideApproval>> {
    return this.http.post<PricingResponse<MarginOverrideApproval>>(
      `${this.base}/margin-overrides/approve`,
      {
        document_type: documentType,
        document_id: documentId,
        notes: notes || null,
      },
    );
  }

  private params(values?: object): HttpParams {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(values ?? {})) {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, String(value));
      }
    }
    return params;
  }
}
