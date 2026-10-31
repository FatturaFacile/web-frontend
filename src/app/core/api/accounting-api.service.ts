import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import {
  ApiResponse,
  ChartOfAccount,
  CreateLedgerEntryPayload,
  LedgerEntry,
  PaginatedResponse,
  QueryFilterParams,
  VatSettlement,
} from '../models';
import { toHttpParams } from '../http/laravel-http.utils';

@Service()
export class AccountingApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/accounting`;

  getChartOfAccounts(): Observable<ApiResponse<ChartOfAccount[]>> {
    return this.http.get<ApiResponse<ChartOfAccount[]>>(`${this.base}/chart-of-accounts`);
  }

  getLedgerEntries(params?: QueryFilterParams): Observable<PaginatedResponse<LedgerEntry>> {
    return this.http.get<PaginatedResponse<LedgerEntry>>(`${this.base}/ledger-entries`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  createLedgerEntry(payload: CreateLedgerEntryPayload): Observable<ApiResponse<LedgerEntry>> {
    return this.http.post<ApiResponse<LedgerEntry>>(`${this.base}/ledger-entries`, payload);
  }

  getVatSettlements(): Observable<ApiResponse<VatSettlement[]>> {
    return this.http.get<ApiResponse<VatSettlement[]>>(`${this.base}/vat-settlements`);
  }
}
