import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import {
  ApiResponse,
  CreateExpensePayload,
  ExpenseResource,
  ExpenseStatus,
  ExpenseSummaryReport,
  PaginatedResponse,
  QueryFilterParams,
  UpdateExpensePayload,
} from '../models';
import { toHttpParams } from '../http/laravel-http.utils';

export interface ExpenseFilterParams extends QueryFilterParams {
  date_from?: string;
  date_to?: string;
  category_id?: string;
  project_id?: string;
  ticket_id?: string;
  service_report_id?: string;
  contact_id?: string;
  user_id?: string;
  status?: ExpenseStatus | string;
}

@Service()
export class ExpensesApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/expenses`;

  listExpenses(params?: ExpenseFilterParams): Observable<PaginatedResponse<ExpenseResource>> {
    return this.http.get<PaginatedResponse<ExpenseResource>>(this.base, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  getExpense(id: string): Observable<ApiResponse<ExpenseResource>> {
    return this.http.get<ApiResponse<ExpenseResource>>(`${this.base}/${id}`);
  }

  createExpense(payload: CreateExpensePayload | FormData): Observable<ApiResponse<ExpenseResource>> {
    return this.http.post<ApiResponse<ExpenseResource>>(this.base, payload);
  }

  updateExpense(id: string, payload: UpdateExpensePayload): Observable<ApiResponse<ExpenseResource>> {
    return this.http.put<ApiResponse<ExpenseResource>>(`${this.base}/${id}`, payload);
  }

  deleteExpense(id: string): Observable<ApiResponse<unknown>> {
    return this.http.delete<ApiResponse<unknown>>(`${this.base}/${id}`);
  }

  uploadExpenseAttachment(id: string, formData: FormData): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(`${this.base}/${id}/attachments`, formData);
  }

  downloadExpenseAttachment(id: string, attachmentId: string, inline = false): Observable<Blob> {
    return this.http.get(`${this.base}/${id}/attachments/${attachmentId}/download`, {
      params: toHttpParams({ inline }),
      responseType: 'blob',
    });
  }

  exportExpenses(params?: Partial<ExpenseFilterParams> & { format?: 'csv' | 'xlsx'; mark_as_exported?: boolean }): Observable<Blob> {
    return this.http.get(`${this.base}/export`, {
      params: params ? toHttpParams(params) : undefined,
      responseType: 'blob',
    });
  }

  getExpenseSummaryReport(params?: { year?: number; date_from?: string; date_to?: string }): Observable<ApiResponse<ExpenseSummaryReport>> {
    return this.http.get<ApiResponse<ExpenseSummaryReport>>(`${this.base}/reports/summary`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }
}
