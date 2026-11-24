import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { toHttpParams } from '../http/laravel-http.utils';
import {
  ApiResponse,
  CustomsOriginEvaluation,
  CustomsTaricCode,
  CustomsTaricCodePage,
  CustomsTaricCodeParams,
  CustomsTaricCodePayload,
  EvaluateCustomsOriginPayload,
  FreeTradeAgreement,
  FreeTradeAgreementPage,
  FreeTradeAgreementParams,
  FreeTradeAgreementPayload,
} from '../models';

/**
 * HS / CN / TARIC code catalog and free trade agreements (`/catalog/*`), plus the preferential-origin evaluation of an
 * invoice (`/sales/invoices/{id}/evaluate-customs-origin`). Writes need the `customs.manage` permission (403 otherwise).
 */
@Service()
export class CustomsCodesApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  // --- TARIC codes ---
  getTaricCodes(params?: CustomsTaricCodeParams): Observable<CustomsTaricCodePage> {
    return this.http.get<CustomsTaricCodePage>(`${this.base}/catalog/customs-taric-codes`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  getTaricCode(id: string): Observable<ApiResponse<CustomsTaricCode>> {
    return this.http.get<ApiResponse<CustomsTaricCode>>(`${this.base}/catalog/customs-taric-codes/${id}`);
  }

  createTaricCode(payload: CustomsTaricCodePayload): Observable<ApiResponse<CustomsTaricCode>> {
    return this.http.post<ApiResponse<CustomsTaricCode>>(`${this.base}/catalog/customs-taric-codes`, payload);
  }

  updateTaricCode(id: string, payload: Partial<CustomsTaricCodePayload>): Observable<ApiResponse<CustomsTaricCode>> {
    return this.http.put<ApiResponse<CustomsTaricCode>>(`${this.base}/catalog/customs-taric-codes/${id}`, payload);
  }

  deleteTaricCode(id: string): Observable<ApiResponse<unknown>> {
    return this.http.delete<ApiResponse<unknown>>(`${this.base}/catalog/customs-taric-codes/${id}`);
  }

  // --- Free trade agreements ---
  getFreeTradeAgreements(params?: FreeTradeAgreementParams): Observable<FreeTradeAgreementPage> {
    return this.http.get<FreeTradeAgreementPage>(`${this.base}/catalog/free-trade-agreements`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  getFreeTradeAgreement(id: string): Observable<ApiResponse<FreeTradeAgreement>> {
    return this.http.get<ApiResponse<FreeTradeAgreement>>(`${this.base}/catalog/free-trade-agreements/${id}`);
  }

  createFreeTradeAgreement(payload: FreeTradeAgreementPayload): Observable<ApiResponse<FreeTradeAgreement>> {
    return this.http.post<ApiResponse<FreeTradeAgreement>>(`${this.base}/catalog/free-trade-agreements`, payload);
  }

  updateFreeTradeAgreement(
    id: string,
    payload: Partial<FreeTradeAgreementPayload>,
  ): Observable<ApiResponse<FreeTradeAgreement>> {
    return this.http.put<ApiResponse<FreeTradeAgreement>>(`${this.base}/catalog/free-trade-agreements/${id}`, payload);
  }

  deleteFreeTradeAgreement(id: string): Observable<ApiResponse<unknown>> {
    return this.http.delete<ApiResponse<unknown>>(`${this.base}/catalog/free-trade-agreements/${id}`);
  }

  // --- Invoice origin declaration ---
  /** `apply: false` (default) previews the declaration; `apply: true` stores it on the invoice. */
  evaluateInvoiceOrigin(
    invoiceId: string,
    payload: EvaluateCustomsOriginPayload = {},
  ): Observable<ApiResponse<CustomsOriginEvaluation>> {
    return this.http.post<ApiResponse<CustomsOriginEvaluation>>(
      `${this.base}/sales/invoices/${invoiceId}/evaluate-customs-origin`,
      payload,
    );
  }
}
