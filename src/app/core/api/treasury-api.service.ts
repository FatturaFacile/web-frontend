import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import {
  ApiResponse,
  BankAccountResource,
  BankTransactionResource,
  PaginatedResponse,
  QueryFilterParams,
} from '../models';
import { toHttpParams } from '../http/laravel-http.utils';

@Service()
export class TreasuryApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/treasury`;

  getBankAccounts(): Observable<ApiResponse<BankAccountResource[]>> {
    return this.http.get<ApiResponse<BankAccountResource[]>>(`${this.base}/bank-accounts`);
  }

  getBankTransactions(params?: QueryFilterParams): Observable<PaginatedResponse<BankTransactionResource>> {
    return this.http.get<PaginatedResponse<BankTransactionResource>>(`${this.base}/transactions`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  reconcileTransactionsAutoMatch(): Observable<ApiResponse<{ matched_count: number }>> {
    return this.http.post<ApiResponse<{ matched_count: number }>>(`${this.base}/reconciliation/auto-match`, {});
  }

  importCamtFile(formData: FormData): Observable<ApiResponse<{ imported_count: number }>> {
    return this.http.post<ApiResponse<{ imported_count: number }>>(`${this.base}/import-camt`, formData);
  }

  importCbiFile(formData: FormData): Observable<ApiResponse<{ imported_count: number }>> {
    return this.http.post<ApiResponse<{ imported_count: number }>>(`${this.base}/import-cbi`, formData);
  }
}
