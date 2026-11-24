import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { toHttpParams } from '../http/laravel-http.utils';
import {
  ApAging,
  ApAgingFilters,
  ApBatch,
  ApBatchCreatePayload,
  ApBatchDecisionPayload,
  ApBatchFilters,
  ApBatchPreview,
  ApBlockPayload,
  ApEnvelope,
  ApExportFormat,
  ApItem,
  ApItemFilters,
  ApItemSummary,
  ApPage,
  ApProposalParams,
  ApReleasePayload,
} from '../models';

/** Accounts payable endpoints of the accounting module (Mod 015): supplier ledger, Skonto, payment batches, aging. */
@Service()
export class PayablesApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/accounting/payables`;

  // --- Open items and due-date schedule ---

  listItems(filters: ApItemFilters): Observable<ApPage<ApItem>> {
    return this.http.get<ApPage<ApItem>>(`${this.base}/items`, {
      params: this.itemParams(filters),
    });
  }

  getItemSummary(currency?: string): Observable<ApEnvelope<ApItemSummary>> {
    return this.http.get<ApEnvelope<ApItemSummary>>(`${this.base}/items/summary`, {
      params: toHttpParams({ currency }),
    });
  }

  getItem(id: string): Observable<ApEnvelope<ApItem>> {
    return this.http.get<ApEnvelope<ApItem>>(`${this.base}/items/${id}`);
  }

  /** Places the item in dispute or under an administrative block (reason required). */
  block(id: string, payload: ApBlockPayload): Observable<ApEnvelope<ApItem>> {
    return this.http.post<ApEnvelope<ApItem>>(`${this.base}/items/${id}/block`, payload);
  }

  /** Releases a disputed or blocked item (the reason goes to the audit trail). */
  release(id: string, payload: ApReleasePayload): Observable<ApEnvelope<ApItem>> {
    return this.http.post<ApEnvelope<ApItem>>(`${this.base}/items/${id}/release`, payload);
  }

  // --- Payment batches ---

  /** Builds the batch the cutoff would produce (with credit-note set-off and IBAN grouping) without saving it. */
  previewBatch(params: ApProposalParams): Observable<ApEnvelope<ApBatchPreview>> {
    return this.http.post<ApEnvelope<ApBatchPreview>>(`${this.base}/batches/preview`, params);
  }

  listBatches(filters: ApBatchFilters = {}): Observable<ApPage<ApBatch>> {
    return this.http.get<ApPage<ApBatch>>(`${this.base}/batches`, {
      params: toHttpParams(filters),
    });
  }

  getBatch(id: string): Observable<ApEnvelope<ApBatch>> {
    return this.http.get<ApEnvelope<ApBatch>>(`${this.base}/batches/${id}`);
  }

  createBatch(payload: ApBatchCreatePayload): Observable<ApEnvelope<ApBatch>> {
    return this.http.post<ApEnvelope<ApBatch>>(`${this.base}/batches`, payload);
  }

  /** Sends the batch to the CFO. */
  submitBatch(id: string): Observable<ApEnvelope<ApBatch>> {
    return this.http.post<ApEnvelope<ApBatch>>(`${this.base}/batches/${id}/submit`, {});
  }

  approveBatch(id: string, payload: ApBatchDecisionPayload = {}): Observable<ApEnvelope<ApBatch>> {
    return this.http.post<ApEnvelope<ApBatch>>(`${this.base}/batches/${id}/approve`, payload);
  }

  rejectBatch(id: string, payload: ApBatchDecisionPayload): Observable<ApEnvelope<ApBatch>> {
    return this.http.post<ApEnvelope<ApBatch>>(`${this.base}/batches/${id}/reject`, payload);
  }

  /** Executes the payment: the items become paid and the Skonto entry is posted. */
  executeBatch(id: string): Observable<ApEnvelope<ApBatch>> {
    return this.http.post<ApEnvelope<ApBatch>>(`${this.base}/batches/${id}/execute`, {});
  }

  cancelBatch(id: string): Observable<ApEnvelope<ApBatch>> {
    return this.http.post<ApEnvelope<ApBatch>>(`${this.base}/batches/${id}/cancel`, {});
  }

  // --- Aging ---

  getAging(filters: ApAgingFilters = {}): Observable<ApEnvelope<ApAging>> {
    return this.http.get<ApEnvelope<ApAging>>(`${this.base}/aging`, {
      params: toHttpParams(filters),
    });
  }

  exportAging(format: ApExportFormat, filters: ApAgingFilters = {}): Observable<Blob> {
    return this.http.get(`${this.base}/aging/export/${format}`, {
      params: toHttpParams(filters),
      responseType: 'blob',
    });
  }

  /** Query string of the items list: the booleans travel as `1` / `0`, empty values are dropped. */
  private itemParams(filters: ApItemFilters): HttpParams {
    const { open_only: openOnly, skonto_only: skontoOnly, ...rest } = filters;
    let params = toHttpParams(rest);
    if (openOnly !== undefined) {
      params = params.set('open_only', openOnly ? '1' : '0');
    }
    if (skontoOnly !== undefined) {
      params = params.set('skonto_only', skontoOnly ? '1' : '0');
    }
    return params;
  }
}
