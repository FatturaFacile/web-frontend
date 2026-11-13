import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { toHttpParams } from '../http/laravel-http.utils';
import {
  ApiResponse,
  PaginatedResponse,
  TesseraSanitariaExpense,
  TesseraSanitariaExpenseFilterParams,
  TesseraSanitariaExpenseRequest,
  TesseraSanitariaSettings,
  TesseraSanitariaSettingsRequest,
  TesseraSanitariaSummary,
} from '../models';

@Service()
export class TesseraSanitariaApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/tessera-sanitaria`;

  getSettings(): Observable<ApiResponse<TesseraSanitariaSettings>> {
    return this.http.get<ApiResponse<TesseraSanitariaSettings>>(`${this.base}/settings`);
  }

  updateSettings(
    payload: TesseraSanitariaSettingsRequest,
  ): Observable<ApiResponse<TesseraSanitariaSettings>> {
    return this.http.put<ApiResponse<TesseraSanitariaSettings>>(`${this.base}/settings`, payload);
  }

  getExpenses(params?: TesseraSanitariaExpenseFilterParams): Observable<PaginatedResponse<TesseraSanitariaExpense>> {
    return this.http.get<PaginatedResponse<TesseraSanitariaExpense>>(`${this.base}/expenses`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  getExpense(id: string): Observable<ApiResponse<TesseraSanitariaExpense>> {
    return this.http.get<ApiResponse<TesseraSanitariaExpense>>(`${this.base}/expenses/${id}`);
  }

  flagExpense(payload: TesseraSanitariaExpenseRequest): Observable<ApiResponse<TesseraSanitariaExpense>> {
    return this.http.post<ApiResponse<TesseraSanitariaExpense>>(`${this.base}/expenses`, payload);
  }

  removeExpenseFlag(id: string): Observable<{ message?: string }> {
    return this.http.delete<{ message?: string }>(`${this.base}/expenses/${id}`);
  }

  getSummary(year: number): Observable<ApiResponse<TesseraSanitariaSummary>> {
    const httpParams = new HttpParams().set('year', year.toString());
    return this.http.get<ApiResponse<TesseraSanitariaSummary>>(`${this.base}/summary`, {
      params: httpParams,
    });
  }

  exportExpenses(
    year: number,
    format: 'json' | 'csv' = 'json',
  ): Observable<ApiResponse<TesseraSanitariaExpense[] | string>> {
    const httpParams = new HttpParams()
      .set('year', year.toString())
      .set('format', format);
    return this.http.get<ApiResponse<TesseraSanitariaExpense[] | string>>(`${this.base}/export`, {
      params: httpParams,
    });
  }
}
