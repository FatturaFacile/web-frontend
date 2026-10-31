import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { ApiResponse, CashFlowForecastPoint, KpiSummary, TaxDeadline } from '../models';

@Service()
export class DashboardApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/dashboard`;

  getKpiSummary(): Observable<ApiResponse<KpiSummary>> {
    return this.http.get<ApiResponse<KpiSummary>>(`${this.base}/kpi-summary`);
  }

  getCashFlowForecast(): Observable<ApiResponse<CashFlowForecastPoint[]>> {
    return this.http.get<ApiResponse<CashFlowForecastPoint[]>>(`${this.base}/cash-flow-forecast`);
  }

  getTaxDeadlines(): Observable<ApiResponse<TaxDeadline[]>> {
    return this.http.get<ApiResponse<TaxDeadline[]>>(`${this.base}/tax-deadlines`);
  }
}
