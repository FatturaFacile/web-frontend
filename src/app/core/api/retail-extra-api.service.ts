import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { toHttpParams } from '../http/laravel-http.utils';
import {
  ApiResponse,
  CommercialDocumentResource,
  DailyCorrispettivoResource,
  PaginatedResponse,
  RetailReturn,
} from '../models';

export type RetailPromotionType = 'percentage' | 'fixed' | 'buy_x_get_y' | string;

export interface RetailPromotion {
  id: string;
  code: string;
  name: string;
  type: RetailPromotionType;
  value: string | number | null;
  product_id: string | null;
  buy_quantity: number | null;
  get_quantity: number | null;
  min_subtotal: string | number | null;
  starts_at: string | null;
  ends_at: string | null;
  weekdays: number[] | null;
  time_from: string | null;
  time_to: string | null;
  priority: number;
  is_stackable: boolean;
  is_active: boolean;
}

export interface RetailPromotionPayload {
  code?: string;
  name?: string;
  type?: RetailPromotionType;
  value?: number | null;
  product_id?: string | null;
  buy_quantity?: number | null;
  get_quantity?: number | null;
  min_subtotal?: number | null;
  starts_at?: string | null;
  ends_at?: string | null;
  weekdays?: number[] | null;
  time_from?: string | null;
  time_to?: string | null;
  priority?: number | null;
  is_stackable?: boolean;
  is_active?: boolean;
}

export type RetailCashMovementType = 'pay_in' | 'pay_out' | string;

export interface RetailCashMovement {
  id: string;
  type: RetailCashMovementType;
  amount: string | number;
  reason: string | null;
  created_at?: string;
}

export interface RetailCashMovementPayload {
  type: RetailCashMovementType;
  amount: number;
  reason?: string | null;
}

/** Free-form X/Z report totals of a POS session. */
export type RetailSessionReport = Record<string, string | number | boolean | null | object>;

export type RetailCorrispettiviRegisterRow = Record<string, string | number | null>;

export interface RetailCorrispettiviRegister {
  year: number;
  month: number;
  timezone: string;
  rows: RetailCorrispettiviRegisterRow[];
  [key: string]: unknown;
}

export interface RetailDocumentReturnLine {
  line_id: string;
  quantity: number;
}

/** Retail promotions, cash movements, X/Z reports, returns list and commercial-document actions of fiscal retail. */
@Service()
export class RetailExtraApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/fiscal-retail`;

  // Commercial documents
  retransmitDocument(id: string): Observable<ApiResponse<CommercialDocumentResource>> {
    return this.http.post<ApiResponse<CommercialDocumentResource>>(`${this.base}/commercial-documents/${id}/retransmit`, {});
  }

  /** Issues a return document; with no lines the whole document is returned. */
  returnDocument(id: string, lines: RetailDocumentReturnLine[] = []): Observable<ApiResponse<CommercialDocumentResource>> {
    return this.http.post<ApiResponse<CommercialDocumentResource>>(`${this.base}/commercial-documents/${id}/return`, { lines });
  }

  // Corrispettivi
  closeCorrispettiviDay(date: string): Observable<ApiResponse<DailyCorrispettivoResource>> {
    return this.http.post<ApiResponse<DailyCorrispettivoResource>>(`${this.base}/corrispettivi/daily/${date}/close`, {});
  }

  getCorrispettiviRegister(year: number, month: number): Observable<{ data: RetailCorrispettiviRegister }> {
    return this.http.get<{ data: RetailCorrispettiviRegister }>(`${this.base}/corrispettivi/register`, {
      params: toHttpParams({ year, month }),
    });
  }

  // Promotions
  getPromotions(filters?: { page?: number; per_page?: number; is_active?: boolean }): Observable<PaginatedResponse<RetailPromotion>> {
    return this.http.get<PaginatedResponse<RetailPromotion>>(`${this.base}/pos/promotions`, { params: filters ? toHttpParams(filters) : undefined });
  }

  getPromotion(id: string): Observable<{ data: RetailPromotion }> {
    return this.http.get<{ data: RetailPromotion }>(`${this.base}/pos/promotions/${id}`);
  }

  createPromotion(payload: RetailPromotionPayload): Observable<{ data: RetailPromotion }> {
    return this.http.post<{ data: RetailPromotion }>(`${this.base}/pos/promotions`, payload);
  }

  updatePromotion(id: string, payload: RetailPromotionPayload): Observable<{ data: RetailPromotion }> {
    return this.http.put<{ data: RetailPromotion }>(`${this.base}/pos/promotions/${id}`, payload);
  }

  deletePromotion(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/pos/promotions/${id}`);
  }

  // POS session cash and reports
  getCashMovements(sessionId: string): Observable<{ data: RetailCashMovement[] }> {
    return this.http.get<{ data: RetailCashMovement[] }>(`${this.base}/pos/sessions/${sessionId}/cash-movements`);
  }

  addCashMovement(sessionId: string, payload: RetailCashMovementPayload): Observable<{ data: RetailCashMovement }> {
    return this.http.post<{ data: RetailCashMovement }>(`${this.base}/pos/sessions/${sessionId}/cash-movements`, payload);
  }

  getXReport(sessionId: string): Observable<{ data: RetailSessionReport }> {
    return this.http.get<{ data: RetailSessionReport }>(`${this.base}/pos/sessions/${sessionId}/x-report`);
  }

  getZReport(sessionId: string): Observable<{ data: RetailSessionReport }> {
    return this.http.get<{ data: RetailSessionReport }>(`${this.base}/pos/sessions/${sessionId}/z-report`);
  }

  getZReports(range?: { from?: string; to?: string }): Observable<{ data: RetailSessionReport[] }> {
    return this.http.get<{ data: RetailSessionReport[] }>(`${this.base}/pos/z-reports`, { params: range ? toHttpParams(range) : undefined });
  }

  // Returns
  getReturns(filters?: { page?: number; per_page?: number }): Observable<PaginatedResponse<RetailReturn>> {
    return this.http.get<PaginatedResponse<RetailReturn>>(`${this.base}/pos/returns`, { params: filters ? toHttpParams(filters) : undefined });
  }

  getReturn(id: string): Observable<{ data: RetailReturn }> {
    return this.http.get<{ data: RetailReturn }>(`${this.base}/pos/returns/${id}`);
  }
}
