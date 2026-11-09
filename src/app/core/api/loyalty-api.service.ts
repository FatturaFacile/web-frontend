import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import {
  ApiResponse,
  CreateLoyaltyCardPayload,
  LoyaltyCard,
  LoyaltyTransaction,
  PaginatedResponse,
  QueryFilterParams,
  RecordLoyaltyTransactionPayload,
  UpdateLoyaltyCardPayload,
} from '../models';
import { toHttpParams } from '../http/laravel-http.utils';

@Service()
export class LoyaltyApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/loyalty-cards`;

  /**
   * List loyalty cards with pagination.
   */
  getCards(params?: QueryFilterParams): Observable<PaginatedResponse<LoyaltyCard>> {
    return this.http.get<PaginatedResponse<LoyaltyCard>>(this.baseUrl, {
      params: params ? toHttpParams(params as Record<string, unknown>) : undefined,
    });
  }

  /**
   * Retrieve single loyalty card details.
   */
  getCard(id: string): Observable<ApiResponse<LoyaltyCard>> {
    return this.http.get<ApiResponse<LoyaltyCard>>(`${this.baseUrl}/${id}`);
  }

  /**
   * Issue a new loyalty card to a customer.
   */
  createCard(payload: CreateLoyaltyCardPayload): Observable<ApiResponse<LoyaltyCard>> {
    return this.http.post<ApiResponse<LoyaltyCard>>(this.baseUrl, payload);
  }

  /**
   * Update loyalty card status or metadata.
   */
  updateCard(id: string, payload: UpdateLoyaltyCardPayload): Observable<ApiResponse<LoyaltyCard>> {
    return this.http.put<ApiResponse<LoyaltyCard>>(`${this.baseUrl}/${id}`, payload);
  }

  /**
   * Delete a loyalty card.
   */
  deleteCard(id: string): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${this.baseUrl}/${id}`);
  }

  /**
   * Get points and credit transaction history for a card.
   */
  getTransactions(cardId: string): Observable<ApiResponse<LoyaltyTransaction[]>> {
    return this.http.get<ApiResponse<LoyaltyTransaction[]>>(`${this.baseUrl}/${cardId}/transactions`);
  }

  /**
   * Record a top-up or spend transaction on a card.
   */
  recordTransaction(
    cardId: string,
    payload: RecordLoyaltyTransactionPayload
  ): Observable<ApiResponse<LoyaltyTransaction>> {
    return this.http.post<ApiResponse<LoyaltyTransaction>>(
      `${this.baseUrl}/${cardId}/transactions`,
      payload
    );
  }
}
