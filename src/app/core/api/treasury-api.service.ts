import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import {
  ApiResponse,
  BankAccountResource,
  BankTransactionResource,
  CashForecastResource,
  CreateBankAccountPayload,
  CreatePaymentBatchPayload,
  PaginatedResponse,
  PaymentBatchResource,
  QueryFilterParams,
} from '../models';
import { toHttpParams } from '../http/laravel-http.utils';

@Service()
export class TreasuryApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/treasury`;

  // --- Bank Accounts ---

  getBankAccounts(): Observable<ApiResponse<BankAccountResource[]>> {
    return this.http.get<ApiResponse<BankAccountResource[]>>(`${this.base}/bank-accounts`);
  }

  getBankAccount(id: string): Observable<ApiResponse<BankAccountResource>> {
    return this.http.get<ApiResponse<BankAccountResource>>(`${this.base}/bank-accounts/${id}`);
  }

  createBankAccount(payload: CreateBankAccountPayload): Observable<ApiResponse<BankAccountResource>> {
    return this.http.post<ApiResponse<BankAccountResource>>(`${this.base}/bank-accounts`, payload);
  }

  updateBankAccount(id: string, payload: Partial<CreateBankAccountPayload>): Observable<ApiResponse<BankAccountResource>> {
    return this.http.put<ApiResponse<BankAccountResource>>(`${this.base}/bank-accounts/${id}`, payload);
  }

  deleteBankAccount(id: string): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${this.base}/bank-accounts/${id}`);
  }

  // --- Transactions & Auto-reconcile ---

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

  // --- Payment Batches (SEPA / pain.001 / RiBa) ---

  getPaymentBatches(params?: QueryFilterParams): Observable<PaginatedResponse<PaymentBatchResource>> {
    return this.http.get<PaginatedResponse<PaymentBatchResource>>(`${this.base}/payment-batches`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  getPaymentBatch(id: string): Observable<ApiResponse<PaymentBatchResource>> {
    return this.http.get<ApiResponse<PaymentBatchResource>>(`${this.base}/payment-batches/${id}`);
  }

  createPaymentBatch(payload: CreatePaymentBatchPayload): Observable<ApiResponse<PaymentBatchResource>> {
    return this.http.post<ApiResponse<PaymentBatchResource>>(`${this.base}/payment-batches`, payload);
  }

  submitPaymentBatchApproval(id: string): Observable<ApiResponse<PaymentBatchResource>> {
    return this.http.post<ApiResponse<PaymentBatchResource>>(`${this.base}/payment-batches/${id}/submit-approval`, {});
  }

  approvePaymentBatch(id: string): Observable<ApiResponse<PaymentBatchResource>> {
    return this.http.post<ApiResponse<PaymentBatchResource>>(`${this.base}/payment-batches/${id}/approve`, {});
  }

  exportPaymentBatch(id: string): Observable<ApiResponse<{ download_url?: string; file_content?: string }>> {
    return this.http.post<ApiResponse<{ download_url?: string; file_content?: string }>>(`${this.base}/payment-batches/${id}/export`, {});
  }

  downloadPaymentBatchXml(id: string): Observable<Blob> {
    return this.http.get(`${this.base}/payment-batches/${id}/download-xml`, {
      responseType: 'blob',
    });
  }

  cancelPaymentBatch(id: string): Observable<ApiResponse<PaymentBatchResource>> {
    return this.http.post<ApiResponse<PaymentBatchResource>>(`${this.base}/payment-batches/${id}/cancel`, {});
  }

  // --- Cash Forecasts & Liquidity ---

  getCashForecasts(): Observable<ApiResponse<CashForecastResource[]>> {
    return this.http.get<ApiResponse<CashForecastResource[]>>(`${this.base}/cash-forecasts`);
  }

  generateCashForecast(horizonDays = 30): Observable<ApiResponse<CashForecastResource>> {
    return this.http.post<ApiResponse<CashForecastResource>>(`${this.base}/cash-forecasts/generate`, {
      horizon_days: horizonDays,
    });
  }
}
