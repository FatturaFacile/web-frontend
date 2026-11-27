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
  QueryFilterParams,
} from '../models';
import {
  Iso20022ImportSummary,
  IsoUploadOptions,
  IsoUploadResult,
  LineInvoiceMatchPayload,
  ReconciliationExceptionFilters,
  ReconciliationExceptionPage,
  ManualTransactionMatchPayload,
  Pain001ExportPayload,
  Pain001ExportResult,
  ReconciliationTransaction,
  ReconciliationTransactionFilters,
} from '../models/iso20022.model';
import { toHttpParams } from '../http/laravel-http.utils';

export interface BankStatementFilterParams extends QueryFilterParams {
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

  /** Imports a camt.053 statement or camt.054 notification and reconciles it, answering with the summary. */
  importIso20022(file: File, autoReconcile = true): Observable<ApiResponse<Iso20022ImportSummary>> {
    const body = new FormData();
    body.append('file', file, file.name);
    body.append('auto_reconcile', autoReconcile ? '1' : '0');
    return this.http.post<ApiResponse<Iso20022ImportSummary>>(`${this.base}/iso20022/import`, body);
  }

  /** Uploads one camt.053, camt.054 or pain.002 file: the API detects the message type from the XML. */
  uploadIso20022(file: File, options: IsoUploadOptions = {}): Observable<ApiResponse<IsoUploadResult>> {
    const body = new FormData();
    body.append('file', file, file.name);
    body.append('auto_reconcile', options.autoReconcile === false ? '0' : '1');
    if (options.paymentBatchId) {
      body.append('payment_batch_id', options.paymentBatchId);
    }
    return this.http.post<ApiResponse<IsoUploadResult>>(`${this.base}/iso20022/upload`, body);
  }

  /** Bank lines the automatic reconciliation left open, with the count of every exception code. */
  getReconciliationExceptions(filters: ReconciliationExceptionFilters = {}): Observable<ReconciliationExceptionPage> {
    return this.http.get<ReconciliationExceptionPage>(`${this.base}/reconciliation/exceptions`, {
      params: toHttpParams({ ...filters }),
    });
  }

  /** Settles a line against an open customer or supplier invoice, optionally writing off or keeping the difference. */
  assignLineToInvoice(lineId: string, payload: LineInvoiceMatchPayload): Observable<ApiResponse<BankStatementLine>> {
    return this.http.post<ApiResponse<BankStatementLine>>(
      `${this.base}/statements/lines/${lineId}/manual-match`,
      payload,
    );
  }

  getReconciliationTransactions(
    filters: ReconciliationTransactionFilters,
  ): Observable<PaginatedResponse<ReconciliationTransaction>> {
    return this.http.get<PaginatedResponse<ReconciliationTransaction>>(`${this.base}/reconciliation/transactions`, {
      params: toHttpParams({ ...filters }),
    });
  }

  matchTransaction(lineId: string, payload: ManualTransactionMatchPayload): Observable<ApiResponse<ReconciliationTransaction>> {
    return this.http.post<ApiResponse<ReconciliationTransaction>>(
      `${this.base}/reconciliation/transactions/${lineId}/match`,
      payload,
    );
  }

  /** The XSD-validated pain.001 file of the selected supplier invoices. */
  exportPain001(payload: Pain001ExportPayload): Observable<ApiResponse<Pain001ExportResult>> {
    return this.http.post<ApiResponse<Pain001ExportResult>>(`${this.base}/iso20022/pain001/export`, payload);
  }

  unmatchLine(lineId: string): Observable<ApiResponse<BankStatementLine>> {
    return this.http.post<ApiResponse<BankStatementLine>>(
      `${this.base}/statements/lines/${lineId}/unmatch`,
      {}
    );
  }
}
