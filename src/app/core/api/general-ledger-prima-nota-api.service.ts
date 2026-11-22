import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { toHttpParams } from '../http/laravel-http.utils';
import {
  AccountingTemplate,
  AccountingTemplatePostPayload,
  AccountingTemplatePreview,
  AccountingTemplatePreviewPayload,
  ApiResponse,
  ClosingStageRun,
  ClosingWorkflow,
  GlJournalEntry,
  LedgerBookCode,
  PrimaNotaJournalPayload,
} from '../models';

/** Prima Nota engine endpoints of `/general-ledger`: accounting templates, multi-book posting and the year-end closing. */
@Service()
export class GeneralLedgerPrimaNotaApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/general-ledger`;

  // --- Accounting templates (causali) ---

  getTemplates(category?: string): Observable<ApiResponse<AccountingTemplate[]>> {
    return this.http.get<ApiResponse<AccountingTemplate[]>>(`${this.base}/accounting-templates`, {
      params: category ? toHttpParams({ category }) : undefined,
    });
  }

  getTemplate(id: string): Observable<ApiResponse<AccountingTemplate>> {
    return this.http.get<ApiResponse<AccountingTemplate>>(
      `${this.base}/accounting-templates/${id}`,
    );
  }

  createTemplate(
    payload: Partial<AccountingTemplate> & { code: string },
  ): Observable<ApiResponse<AccountingTemplate>> {
    return this.http.post<ApiResponse<AccountingTemplate>>(
      `${this.base}/accounting-templates`,
      payload,
    );
  }

  updateTemplate(
    id: string,
    payload: Partial<AccountingTemplate>,
  ): Observable<ApiResponse<AccountingTemplate>> {
    return this.http.put<ApiResponse<AccountingTemplate>>(
      `${this.base}/accounting-templates/${id}`,
      payload,
    );
  }

  deleteTemplate(id: string): Observable<ApiResponse<unknown>> {
    return this.http.delete<ApiResponse<unknown>>(`${this.base}/accounting-templates/${id}`);
  }

  previewTemplate(
    id: string,
    payload: AccountingTemplatePreviewPayload,
  ): Observable<ApiResponse<AccountingTemplatePreview>> {
    return this.http.post<ApiResponse<AccountingTemplatePreview>>(
      `${this.base}/accounting-templates/${id}/preview`,
      payload,
    );
  }

  postTemplate(
    id: string,
    payload: AccountingTemplatePostPayload,
  ): Observable<ApiResponse<GlJournalEntry>> {
    return this.http.post<ApiResponse<GlJournalEntry>>(
      `${this.base}/accounting-templates/${id}/post`,
      payload,
    );
  }

  // --- Prima Nota journal ---

  /** Creates a balanced journal; `post_to_ledgers` also posts it, as its own entry, to the other books. */
  createJournal(payload: PrimaNotaJournalPayload): Observable<ApiResponse<GlJournalEntry>> {
    return this.http.post<ApiResponse<GlJournalEntry>>(`${this.base}/journals`, payload);
  }

  // --- Year-end closing workflow ---

  getClosingWorkflow(
    fiscalYearId: string,
    ledger: LedgerBookCode,
  ): Observable<ApiResponse<ClosingWorkflow>> {
    return this.http.get<ApiResponse<ClosingWorkflow>>(
      `${this.base}/fiscal-years/${fiscalYearId}/closing-workflow`,
      {
        params: toHttpParams({ ledger }),
      },
    );
  }

  runClosingStage(
    fiscalYearId: string,
    stage: number,
    ledger: LedgerBookCode,
  ): Observable<ApiResponse<ClosingStageRun>> {
    return this.http.post<ApiResponse<ClosingStageRun>>(
      `${this.base}/fiscal-years/${fiscalYearId}/closing-workflow/stages/${stage}`,
      { ledger },
    );
  }
}
