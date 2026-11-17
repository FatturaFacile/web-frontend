import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { ApiResponse, FiscalPeriodResource, TaxSettlementResource } from '../models';

export interface StoreFiscalPeriodPayload {
  fiscal_year_id: string;
  period_number: number;
  period_name: string;
  start_date: string;
  end_date: string;
}

/** General-ledger endpoints not covered by the main services: creating a fiscal period, single reads. */
@Service()
export class GeneralLedgerExtraApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/general-ledger`;

  createFiscalPeriod(payload: StoreFiscalPeriodPayload): Observable<ApiResponse<FiscalPeriodResource>> {
    return this.http.post<ApiResponse<FiscalPeriodResource>>(`${this.base}/fiscal-periods`, payload);
  }

  getFiscalPeriod(id: string): Observable<ApiResponse<FiscalPeriodResource>> {
    return this.http.get<ApiResponse<FiscalPeriodResource>>(`${this.base}/fiscal-periods/${id}`);
  }

  getTaxSettlement(id: string): Observable<ApiResponse<TaxSettlementResource>> {
    return this.http.get<ApiResponse<TaxSettlementResource>>(`${this.base}/tax-settlements/${id}`);
  }
}
