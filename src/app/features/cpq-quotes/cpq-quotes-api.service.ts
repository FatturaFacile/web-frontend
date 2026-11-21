import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { ApiResponse } from '@core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { IssueResult, QuoteDetail, RevisionDiff } from './cpq-quotes.models';

export interface QuotePage {
  items: QuoteDetail[];
  total: number;
  per_page: number;
  current_page: number;
}

export interface QuoteListFilter {
  status?: string;
  root_quote_id?: string;
  per_page?: number;
}

/** Back-office endpoints of the interactive quotes (Mod 036). The public portal has its own service in `@core`. */
@Service()
export class CpqQuotesApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/cpq/quotes`;

  list(filter: QuoteListFilter = {}): Observable<ApiResponse<QuotePage>> {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(filter)) {
      if (value !== undefined) {
        params = params.set(key, String(value));
      }
    }
    return this.http.get<ApiResponse<QuotePage>>(this.base, { params });
  }

  get(id: string): Observable<ApiResponse<QuoteDetail>> {
    return this.http.get<ApiResponse<QuoteDetail>>(`${this.base}/${id}`);
  }

  create(payload: Record<string, unknown>): Observable<ApiResponse<QuoteDetail>> {
    return this.http.post<ApiResponse<QuoteDetail>>(this.base, payload);
  }

  update(id: string, payload: Record<string, unknown>): Observable<ApiResponse<QuoteDetail>> {
    return this.http.put<ApiResponse<QuoteDetail>>(`${this.base}/${id}`, payload);
  }

  issue(
    id: string,
    options: { use_pin?: boolean; validity_days?: number } = {},
  ): Observable<ApiResponse<IssueResult>> {
    return this.http.post<ApiResponse<IssueResult>>(`${this.base}/${id}/issue`, options);
  }

  /** Manager override of the margin guardrail. */
  approveAndIssue(
    id: string,
    options: { use_pin?: boolean; validity_days?: number } = {},
  ): Observable<ApiResponse<IssueResult>> {
    return this.http.post<ApiResponse<IssueResult>>(
      `${this.base}/${id}/approve-and-issue`,
      options,
    );
  }

  createRevision(id: string): Observable<ApiResponse<QuoteDetail>> {
    return this.http.post<ApiResponse<QuoteDetail>>(`${this.base}/${id}/revisions`, {});
  }

  compare(fromId: string, toId: string): Observable<ApiResponse<RevisionDiff>> {
    return this.http.get<ApiResponse<RevisionDiff>>(`${this.base}/${fromId}/compare/${toId}`);
  }

  convertToOrder(id: string): Observable<ApiResponse<{ sales_order_id: string }>> {
    return this.http.post<ApiResponse<{ sales_order_id: string }>>(
      `${this.base}/${id}/convert-to-order`,
      {},
    );
  }

  convertToInvoice(
    id: string,
    downPaymentPercent?: number,
  ): Observable<ApiResponse<{ invoice_id: string; is_deposit: boolean }>> {
    return this.http.post<ApiResponse<{ invoice_id: string; is_deposit: boolean }>>(
      `${this.base}/${id}/convert-to-invoice`,
      downPaymentPercent === undefined ? {} : { down_payment_percent: downPaymentPercent },
    );
  }
}
