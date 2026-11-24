import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { toHttpParams } from '@core/http/laravel-http.utils';
import { ApiResponse, PaginatedResponse } from '@core/models';
import {
  BatchRunPayload,
  InvoiceMatchBatchResult,
  InvoiceMatchFilters,
  InvoiceMatchGrIr,
  InvoiceMatchRun,
  InvoiceMatchSummary,
  InvoiceMatchToleranceRule,
  OverridePayload,
  PartialResolutionPayload,
  RematchPayload,
  RequestCreditNotePayload,
  RunMatchingPayload,
  ToleranceRulePayload,
} from '@domain/procurement/invoice-matching.models';
import { environment } from '@env';
import { map, Observable } from 'rxjs';

/**
 * Typed HTTP gateway for Mod 048 (3-way matching and GR/IR). Every endpoint answers with the
 * `{success, message, data, meta?}` envelope; single resources are unwrapped here.
 */
@Injectable({ providedIn: 'root' })
export class InvoiceMatchingApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/procurement/invoice-matching`;

  summary(): Observable<InvoiceMatchSummary> {
    return this.http
      .get<ApiResponse<InvoiceMatchSummary>>(`${this.base}/summary`)
      .pipe(map((res) => res.data));
  }

  listRuns(filters: InvoiceMatchFilters = {}): Observable<PaginatedResponse<InvoiceMatchRun>> {
    return this.http.get<PaginatedResponse<InvoiceMatchRun>>(`${this.base}/runs`, {
      params: toHttpParams({ ...filters }),
    });
  }

  getRun(id: string): Observable<InvoiceMatchRun> {
    return this.http
      .get<ApiResponse<InvoiceMatchRun>>(`${this.base}/runs/${id}`)
      .pipe(map((res) => res.data));
  }

  getGrIr(id: string): Observable<InvoiceMatchGrIr> {
    return this.http
      .get<ApiResponse<InvoiceMatchGrIr>>(`${this.base}/runs/${id}/gr-ir`)
      .pipe(map((res) => res.data));
  }

  invoiceHistory(passiveInvoiceId: string): Observable<InvoiceMatchRun[]> {
    return this.http
      .get<ApiResponse<InvoiceMatchRun[]>>(`${this.base}/invoices/${passiveInvoiceId}/history`)
      .pipe(map((res) => res.data ?? []));
  }

  run(payload: RunMatchingPayload): Observable<InvoiceMatchRun> {
    return this.http
      .post<ApiResponse<InvoiceMatchRun>>(`${this.base}/run`, payload)
      .pipe(map((res) => res.data));
  }

  batchRun(payload: BatchRunPayload): Observable<InvoiceMatchBatchResult> {
    return this.http
      .post<ApiResponse<InvoiceMatchBatchResult>>(`${this.base}/batch-run`, payload)
      .pipe(map((res) => res.data));
  }

  requestCreditNote(id: string, payload: RequestCreditNotePayload): Observable<InvoiceMatchRun> {
    return this.postRunAction(id, 'request-credit-note', payload);
  }

  rematch(id: string, payload: RematchPayload): Observable<InvoiceMatchRun> {
    return this.postRunAction(id, 'rematch', payload);
  }

  partialResolution(id: string, payload: PartialResolutionPayload): Observable<InvoiceMatchRun> {
    return this.postRunAction(id, 'partial-resolution', payload);
  }

  override(id: string, payload: OverridePayload): Observable<InvoiceMatchRun> {
    return this.postRunAction(id, 'override', payload);
  }

  listRules(): Observable<InvoiceMatchToleranceRule[]> {
    return this.http
      .get<ApiResponse<InvoiceMatchToleranceRule[]>>(`${this.base}/tolerance-rules`)
      .pipe(map((res) => res.data ?? []));
  }

  createRule(payload: ToleranceRulePayload): Observable<InvoiceMatchToleranceRule> {
    return this.http
      .post<ApiResponse<InvoiceMatchToleranceRule>>(`${this.base}/tolerance-rules`, payload)
      .pipe(map((res) => res.data));
  }

  updateRule(id: string, payload: ToleranceRulePayload): Observable<InvoiceMatchToleranceRule> {
    return this.http
      .put<ApiResponse<InvoiceMatchToleranceRule>>(`${this.base}/tolerance-rules/${id}`, payload)
      .pipe(map((res) => res.data));
  }

  deleteRule(id: string): Observable<void> {
    return this.http.delete(`${this.base}/tolerance-rules/${id}`).pipe(map(() => undefined));
  }

  private postRunAction(id: string, action: string, payload: object): Observable<InvoiceMatchRun> {
    return this.http
      .post<ApiResponse<InvoiceMatchRun>>(`${this.base}/runs/${id}/${action}`, payload)
      .pipe(map((res) => res.data));
  }
}
