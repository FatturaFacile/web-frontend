import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import {
  DossierPreviewSummary,
  FiduciaryAccountLedgerReport,
  FiduciaryAuditLogEntry,
  FiduciaryEntryNote,
  FiduciaryExportRun,
  FiduciaryFiscalPeriod,
  FiduciaryJournalEntry,
  FiduciaryOverviewResponse,
  FiduciaryTranscodingMatrix,
  StudioExportFormatCode,
  StudioExportValidationResult,
} from './fiduciary-portal.models';

interface ApiEnvelope<T> {
  success: boolean;
  message?: string;
  data: T;
}

@Injectable({ providedIn: 'root' })
export class FiduciaryPortalApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/fiduciary-portal`;

  getOverview(): Observable<ApiEnvelope<FiduciaryOverviewResponse>> {
    return this.http.get<ApiEnvelope<FiduciaryOverviewResponse>>(`${this.baseUrl}/overview`);
  }

  listJournals(filters: {
    fiscal_year_id?: string | null;
    fiscal_period_id?: string | null;
    fiduciary_verified?: string | null;
    search?: string | null;
    studio_system?: string;
    page?: number;
    per_page?: number;
  }): Observable<ApiEnvelope<{ items: FiduciaryJournalEntry[]; meta: { current_page: number; last_page: number; per_page: number; total: number } }>> {
    let params = new HttpParams();
    if (filters.fiscal_year_id) params = params.set('fiscal_year_id', filters.fiscal_year_id);
    if (filters.fiscal_period_id) params = params.set('fiscal_period_id', filters.fiscal_period_id);
    if (filters.fiduciary_verified) params = params.set('fiduciary_verified', filters.fiduciary_verified);
    if (filters.search) params = params.set('search', filters.search);
    if (filters.studio_system) params = params.set('studio_system', filters.studio_system);
    if (filters.page) params = params.set('page', String(filters.page));
    if (filters.per_page) params = params.set('per_page', String(filters.per_page));
    return this.http.get<ApiEnvelope<{ items: FiduciaryJournalEntry[]; meta: { current_page: number; last_page: number; per_page: number; total: number } }>>(
      `${this.baseUrl}/journals`,
      { params },
    );
  }

  verifyJournals(payload: {
    entry_ids: string[];
    verified: boolean;
    note?: string | null;
  }): Observable<ApiEnvelope<{ updated: number; verified: boolean; entry_ids: string[] }>> {
    return this.http.post<ApiEnvelope<{ updated: number; verified: boolean; entry_ids: string[] }>>(
      `${this.baseUrl}/journals/verify`,
      payload,
    );
  }

  getAccountLedger(paramsObj: {
    account_id: string;
    from: string;
    to: string;
    studio_system?: string;
  }): Observable<ApiEnvelope<FiduciaryAccountLedgerReport>> {
    let params = new HttpParams()
      .set('account_id', paramsObj.account_id)
      .set('from', paramsObj.from)
      .set('to', paramsObj.to);
    if (paramsObj.studio_system) params = params.set('studio_system', paramsObj.studio_system);
    return this.http.get<ApiEnvelope<FiduciaryAccountLedgerReport>>(`${this.baseUrl}/account-ledger`, { params });
  }

  getTranscodings(paramsObj: {
    studio_system: string;
    search?: string;
    unmapped_only?: boolean;
  }): Observable<ApiEnvelope<FiduciaryTranscodingMatrix>> {
    let params = new HttpParams().set('studio_system', paramsObj.studio_system);
    if (paramsObj.search) params = params.set('search', paramsObj.search);
    if (paramsObj.unmapped_only) params = params.set('unmapped_only', '1');
    return this.http.get<ApiEnvelope<FiduciaryTranscodingMatrix>>(`${this.baseUrl}/transcodings`, { params });
  }

  saveTranscoding(payload: {
    studio_system: string;
    source_account_id: string;
    studio_account_code: string;
    studio_account_name?: string | null;
    studio_vat_code?: string | null;
    studio_cost_center_code?: string | null;
  }): Observable<ApiEnvelope<unknown>> {
    return this.http.post<ApiEnvelope<unknown>>(`${this.baseUrl}/transcodings`, payload);
  }

  bulkSaveTranscodings(
    studioSystem: string,
    items: {
      source_account_id: string;
      studio_account_code: string;
      studio_account_name?: string | null;
      studio_vat_code?: string | null;
      studio_cost_center_code?: string | null;
    }[],
  ): Observable<ApiEnvelope<{ saved: number }>> {
    return this.http.post<ApiEnvelope<{ saved: number }>>(`${this.baseUrl}/transcodings/bulk`, {
      studio_system: studioSystem,
      items,
    });
  }

  seedDefaultTranscodings(studioSystem: string): Observable<ApiEnvelope<{ created: number }>> {
    return this.http.post<ApiEnvelope<{ created: number }>>(`${this.baseUrl}/transcodings/seed-defaults`, {
      studio_system: studioSystem,
    });
  }

  deleteTranscoding(id: string): Observable<ApiEnvelope<null>> {
    return this.http.delete<ApiEnvelope<null>>(`${this.baseUrl}/transcodings/${id}`);
  }

  listPeriods(fiscalYearId?: string | null): Observable<ApiEnvelope<FiduciaryFiscalPeriod[]>> {
    let params = new HttpParams();
    if (fiscalYearId) params = params.set('fiscal_year_id', fiscalYearId);
    return this.http.get<ApiEnvelope<FiduciaryFiscalPeriod[]>>(`${this.baseUrl}/periods`, { params });
  }

  lockPeriod(periodId: string, reason: string): Observable<ApiEnvelope<FiduciaryFiscalPeriod>> {
    return this.http.post<ApiEnvelope<FiduciaryFiscalPeriod>>(`${this.baseUrl}/periods/${periodId}/lock`, { reason });
  }

  unlockPeriod(periodId: string, reason: string): Observable<ApiEnvelope<FiduciaryFiscalPeriod>> {
    return this.http.post<ApiEnvelope<FiduciaryFiscalPeriod>>(`${this.baseUrl}/periods/${periodId}/unlock`, { reason });
  }

  listNotes(paramsObj?: {
    journal_entry_id?: string;
    status?: string;
    search?: string;
  }): Observable<ApiEnvelope<{ open_count: number; resolved_count: number; items: FiduciaryEntryNote[] }>> {
    let params = new HttpParams();
    if (paramsObj?.journal_entry_id) params = params.set('journal_entry_id', paramsObj.journal_entry_id);
    if (paramsObj?.status) params = params.set('status', paramsObj.status);
    if (paramsObj?.search) params = params.set('search', paramsObj.search);
    return this.http.get<ApiEnvelope<{ open_count: number; resolved_count: number; items: FiduciaryEntryNote[] }>>(
      `${this.baseUrl}/notes`,
      { params },
    );
  }

  createNote(payload: {
    journal_entry_id: string;
    body: string;
    parent_note_id?: string | null;
  }): Observable<ApiEnvelope<FiduciaryEntryNote>> {
    return this.http.post<ApiEnvelope<FiduciaryEntryNote>>(`${this.baseUrl}/notes`, payload);
  }

  resolveNote(noteId: string, resolved: boolean, resolutionComment?: string | null): Observable<ApiEnvelope<FiduciaryEntryNote>> {
    return this.http.post<ApiEnvelope<FiduciaryEntryNote>>(`${this.baseUrl}/notes/${noteId}/resolve`, {
      resolved,
      resolution_comment: resolutionComment ?? null,
    });
  }

  listExportRuns(): Observable<ApiEnvelope<FiduciaryExportRun[]>> {
    return this.http.get<ApiEnvelope<FiduciaryExportRun[]>>(`${this.baseUrl}/exports`);
  }

  validateExport(payload: {
    format_code: StudioExportFormatCode;
    from_date: string;
    to_date: string;
    fiscal_year_id?: string | null;
    fiscal_period_id?: string | null;
    only_verified?: boolean;
    apply_transcoding?: boolean;
  }): Observable<ApiEnvelope<StudioExportValidationResult>> {
    return this.http.post<ApiEnvelope<StudioExportValidationResult>>(`${this.baseUrl}/exports/validate`, payload);
  }

  generateExport(payload: {
    format_code: StudioExportFormatCode;
    from_date: string;
    to_date: string;
    fiscal_year_id?: string | null;
    fiscal_period_id?: string | null;
    only_verified?: boolean;
    apply_transcoding?: boolean;
    consultant_number?: number;
    client_number?: number;
  }): Observable<ApiEnvelope<FiduciaryExportRun>> {
    return this.http.post<ApiEnvelope<FiduciaryExportRun>>(`${this.baseUrl}/exports`, payload);
  }

  downloadExport(runId: string): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/exports/${runId}/download`, { responseType: 'blob' });
  }

  previewDossier(fiscalYearId?: string | null, fromDate?: string, toDate?: string): Observable<ApiEnvelope<DossierPreviewSummary>> {
    let params = new HttpParams();
    if (fiscalYearId) params = params.set('fiscal_year_id', fiscalYearId);
    if (fromDate) params = params.set('from_date', fromDate);
    if (toDate) params = params.set('to_date', toDate);
    return this.http.get<ApiEnvelope<DossierPreviewSummary>>(`${this.baseUrl}/dossier/preview`, { params });
  }

  downloadDossier(fiscalYearId?: string | null, fromDate?: string, toDate?: string, studioSystem?: string): Observable<Blob> {
    let params = new HttpParams();
    if (fiscalYearId) params = params.set('fiscal_year_id', fiscalYearId);
    if (fromDate) params = params.set('from_date', fromDate);
    if (toDate) params = params.set('to_date', toDate);
    if (studioSystem) params = params.set('studio_system', studioSystem);
    return this.http.get(`${this.baseUrl}/dossier/download`, { params, responseType: 'blob' });
  }

  listAuditLogs(): Observable<ApiEnvelope<{ items: FiduciaryAuditLogEntry[]; meta: { current_page: number; last_page: number; per_page: number; total: number } }>> {
    return this.http.get<ApiEnvelope<{ items: FiduciaryAuditLogEntry[]; meta: { current_page: number; last_page: number; per_page: number; total: number } }>>(
      `${this.baseUrl}/audit-logs`,
    );
  }
}
