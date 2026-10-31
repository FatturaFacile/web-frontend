import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import {
  ApiResponse,
  BankStatement,
  BankStatementLine,
  CategorizePayload,
  ManualMatchPayload,
  PaginatedResponse,
} from '../models';
import { toHttpParams } from '../http/laravel-http.utils';

export interface BankStatementFilterParams {
  status?: string;
  source_format?: string;
  iban?: string;
}

@Service()
export class BankingApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/banking`;

  getBankStatements(filters?: BankStatementFilterParams): Observable<PaginatedResponse<BankStatement>> {
    return this.http.get<PaginatedResponse<BankStatement>>(`${this.base}/statements`, {
      params: filters ? toHttpParams(filters) : undefined,
    });
  }

  getBankStatementById(id: string): Observable<ApiResponse<BankStatement & { lines?: BankStatementLine[] }>> {
    return this.http.get<ApiResponse<BankStatement & { lines?: BankStatementLine[] }>>(`${this.base}/statements/${id}`);
  }

  importStatement(formData: FormData, autoReconcile = false): Observable<ApiResponse<BankStatement>> {
    return this.http.post<ApiResponse<BankStatement>>(`${this.base}/statements/import`, formData, {
      params: toHttpParams({ auto_reconcile: autoReconcile }),
    });
  }

  reconcileStatement(id: string): Observable<ApiResponse<{ reconciled_count: number }>> {
    return this.http.post<ApiResponse<{ reconciled_count: number }>>(`${this.base}/statements/${id}/reconcile`, {});
  }

  manualMatchLine(lineId: string, payload: ManualMatchPayload): Observable<ApiResponse<BankStatementLine>> {
    return this.http.post<ApiResponse<BankStatementLine>>(
      `${this.base}/statements/lines/${lineId}/manual-match`,
      payload
    );
  }

  categorizeLine(lineId: string, payload: CategorizePayload): Observable<ApiResponse<BankStatementLine>> {
    return this.http.post<ApiResponse<BankStatementLine>>(
      `${this.base}/statements/lines/${lineId}/categorize`,
      payload
    );
  }

  unmatchLine(lineId: string): Observable<ApiResponse<BankStatementLine>> {
    return this.http.post<ApiResponse<BankStatementLine>>(
      `${this.base}/statements/lines/${lineId}/unmatch`,
      {}
    );
  }
}
