import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@env';
import {
  BillingPreviewItem,
  PriceIndexRate,
  RecurringBillingRun,
  RecurringContract,
  RecurringContractsMetrics,
} from '../models/recurring-contracts.model';

@Injectable({
  providedIn: 'root',
})
export class RecurringContractsApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/recurring-contracts`;
  private readonly billingUrl = `${environment.apiBaseUrl}/recurring-billing`;
  private readonly priceIndicesUrl = `${environment.apiBaseUrl}/price-indices`;

  getContracts(params?: {
    page?: number;
    per_page?: number;
    status?: string;
    contract_type?: string;
    customer_id?: string;
    due_before?: string;
    renewing_within_days?: number;
    search?: string;
  }): Observable<{ data: RecurringContract[]; meta: { total: number; current_page: number; per_page: number } }> {
    let httpParams = new HttpParams();
    if (params) {
      Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined && val !== null && val !== '') {
          httpParams = httpParams.set(key, String(val));
        }
      });
    }
    return this.http.get<{ data: RecurringContract[]; meta: { total: number; current_page: number; per_page: number } }>(
      this.baseUrl,
      { params: httpParams }
    );
  }

  getContract(id: string): Observable<{ data: RecurringContract }> {
    return this.http.get<{ data: RecurringContract }>(`${this.baseUrl}/${id}`);
  }

  createContract(payload: Partial<RecurringContract>): Observable<{ data: RecurringContract }> {
    return this.http.post<{ data: RecurringContract }>(this.baseUrl, payload);
  }

  updateContract(id: string, payload: Partial<RecurringContract>): Observable<{ data: RecurringContract }> {
    return this.http.put<{ data: RecurringContract }>(`${this.baseUrl}/${id}`, payload);
  }

  deleteContract(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.baseUrl}/${id}`);
  }

  activateContract(id: string): Observable<{ message: string; data: RecurringContract }> {
    return this.http.post<{ message: string; data: RecurringContract }>(`${this.baseUrl}/${id}/activate`, {});
  }

  suspendContract(id: string): Observable<{ message: string; data: RecurringContract }> {
    return this.http.post<{ message: string; data: RecurringContract }>(`${this.baseUrl}/${id}/suspend`, {});
  }

  cancelContract(id: string, reason: string): Observable<{ message: string; data: RecurringContract }> {
    return this.http.post<{ message: string; data: RecurringContract }>(`${this.baseUrl}/${id}/cancel`, {
      cancellation_reason: reason,
    });
  }

  renewContract(id: string, months?: number): Observable<{ message: string; data: RecurringContract }> {
    return this.http.post<{ message: string; data: RecurringContract }>(`${this.baseUrl}/${id}/renew`, {
      renewal_months: months,
      months,
    });
  }

  applyIndexation(
    id: string,
    priceIndexRateId: string,
    targetPeriod?: string,
  ): Observable<{ message: string; data: RecurringContract; log?: unknown }> {
    return this.http.post<{ message: string; data: RecurringContract; log?: unknown }>(
      `${this.baseUrl}/${id}/apply-indexation`,
      {
        price_index_rate_id: priceIndexRateId,
        ...(targetPeriod ? { target_period: targetPeriod } : {}),
      }
    );
  }

  billNow(id: string): Observable<{ message: string; invoice?: unknown; contract?: RecurringContract; data?: unknown }> {
    return this.http.post<{ message: string; invoice?: unknown; contract?: RecurringContract; data?: unknown }>(
      `${this.baseUrl}/${id}/bill-now`,
      {}
    );
  }

  getMetrics(): Observable<RecurringContractsMetrics> {
    return this.http.get<RecurringContractsMetrics>(`${this.baseUrl}/metrics`);
  }

  getBillingPreview(cutoffDate: string): Observable<{
    cutoff_date: string;
    total_contracts?: number;
    count?: number;
    items?: BillingPreviewItem[];
    preview?: BillingPreviewItem[];
  }> {
    const params = new HttpParams().set('cutoff_date', cutoffDate);
    return this.http.get<{
      cutoff_date: string;
      total_contracts?: number;
      count?: number;
      items?: BillingPreviewItem[];
      preview?: BillingPreviewItem[];
    }>(
      `${this.billingUrl}/preview`,
      { params }
    );
  }

  executeBillingRun(payload: {
    cutoff_date: string;
    run_type?: 'manual' | 'scheduled';
    contract_ids?: string[];
  }): Observable<{ message?: string; data?: RecurringBillingRun; run?: RecurringBillingRun }> {
    return this.http.post<{ message?: string; data?: RecurringBillingRun; run?: RecurringBillingRun }>(
      `${this.billingUrl}/runs`,
      payload
    );
  }

  getBillingRuns(params?: { page?: number; per_page?: number }): Observable<{
    data: RecurringBillingRun[];
    meta: { total: number; current_page: number; per_page: number };
  }> {
    let httpParams = new HttpParams();
    if (params) {
      Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined && val !== null) {
          httpParams = httpParams.set(key, String(val));
        }
      });
    }
    return this.http.get<{
      data: RecurringBillingRun[];
      meta: { total: number; current_page: number; per_page: number };
    }>(`${this.billingUrl}/runs`, { params: httpParams });
  }

  getBillingRun(id: string): Observable<{ data: RecurringBillingRun }> {
    return this.http.get<{ data: RecurringBillingRun }>(`${this.billingUrl}/runs/${id}`);
  }

  getPriceIndices(params?: { index_type?: string; period?: string }): Observable<{ data: PriceIndexRate[] }> {
    let httpParams = new HttpParams();
    if (params) {
      Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined && val !== null && val !== '') {
          httpParams = httpParams.set(key, String(val));
        }
      });
    }
    return this.http.get<{ data: PriceIndexRate[] }>(this.priceIndicesUrl, { params: httpParams });
  }

  storePriceIndexRate(payload: PriceIndexRate): Observable<{ message: string; data: PriceIndexRate }> {
    return this.http.post<{ message: string; data: PriceIndexRate }>(this.priceIndicesUrl, payload);
  }
}
