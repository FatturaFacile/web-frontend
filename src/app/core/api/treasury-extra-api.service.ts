import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { ApiResponse, CashForecastResource, PagoPaNotice } from '../models';

export interface ExecutePaymentBatchResult {
  message: string;
  execution_id: string;
  status: string;
}

/** Treasury endpoints not covered by the main services. */
@Service()
export class TreasuryExtraApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/treasury`;

  getPagoPaNotice(id: string): Observable<ApiResponse<PagoPaNotice>> {
    return this.http.get<ApiResponse<PagoPaNotice>>(`${this.base}/pagopa-notices/${id}`);
  }

  /** Generates the bank file of an approved batch; the outcome is then confirmed with the confirm endpoint. */
  executePaymentBatch(id: string, protocol = 'sepa_pain001'): Observable<ExecutePaymentBatchResult> {
    return this.http.post<ExecutePaymentBatchResult>(`${this.base}/payment-batches/${id}/execute`, { protocol });
  }

  getCashForecast(id: string): Observable<ApiResponse<CashForecastResource>> {
    return this.http.get<ApiResponse<CashForecastResource>>(`${this.base}/cash-forecasts/${id}`);
  }
}
