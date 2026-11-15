import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { toHttpParams } from '../http/laravel-http.utils';
import { ApiResponse } from '../models';

export type ExportDataset = 'invoices' | 'purchases' | 'payments' | 'contacts';
export type ExportJobDataset = ExportDataset | 'accountant_archive';
export type ExportJobStatus = 'queued' | 'running' | 'completed' | 'failed';
export type ExportScheduleFrequency = 'daily' | 'weekly' | 'monthly';
export type ExportSchedulePeriod = 'all' | 'previous_month' | 'year_to_date';

/** One export of the history (`ExportJobResource`). */
export interface ExportJob {
  id: string;
  dataset: ExportJobDataset;
  status: ExportJobStatus;
  period_from: string | null;
  period_to: string | null;
  file_name: string | null;
  size_bytes: number | null;
  row_count: number | null;
  error: string | null;
  schedule_id: string | null;
  is_downloadable: boolean;
  started_at: string | null;
  completed_at: string | null;
  expires_at: string | null;
  created_at: string;
}

/** Payload of `POST /exports/jobs` (`StoreExportJobRequest`): the period is required for the accountant archive. */
export interface ExportJobPayload {
  dataset: ExportJobDataset;
  from?: string | null;
  to?: string | null;
}

/** One recurring export (`ExportScheduleResource`). */
export interface ExportSchedule {
  id: string;
  dataset: ExportJobDataset;
  frequency: ExportScheduleFrequency;
  period: ExportSchedulePeriod;
  is_active: boolean;
  next_run_on: string | null;
  last_run_at: string | null;
}

/** `POST /exports/imports/preview`: headers, first rows and the mapping suggested from the header names. */
export interface SpreadsheetImportPreview {
  headers: string[];
  sample: Record<string, string>[];
  row_count: number;
  fields: string[];
  suggested_mapping: Record<string, string>;
}

/** `POST /exports/imports`: `skipped` are duplicates, `failed` rows carry their line (the header is line 1). */
export interface SpreadsheetImportResult {
  dry_run: boolean;
  total: number;
  created: number;
  skipped: number;
  failed: number;
  duplicates: number[];
  errors: { line: number; messages: string[] }[];
}

/** Payload of `POST /exports/schedules` (`StoreExportScheduleRequest`). */
export interface ExportSchedulePayload {
  dataset: ExportJobDataset;
  frequency: ExportScheduleFrequency;
  period: ExportSchedulePeriod;
  is_active?: boolean;
}

/** Accountant exports under `/exports/*`: the files are produced by the server (CSV with semicolons, ZIP archive). */
@Service()
export class ExportsApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/exports`;

  /** The archive for the accountant of a period (`from` and `to` are required). */
  downloadAccountantArchive(from: string, to: string): Observable<Blob> {
    return this.http.get(`${this.base}/accountant-archive`, {
      params: toHttpParams({ from, to }),
      responseType: 'blob',
    });
  }

  /** Excel-compatible CSV of a dataset, optionally for a period. */
  downloadDatasetCsv(dataset: ExportDataset, period?: { from?: string | null; to?: string | null }): Observable<Blob> {
    return this.http.get(`${this.base}/csv/${dataset}`, {
      params: period ? toHttpParams(period) : undefined,
      responseType: 'blob',
    });
  }

  /** The export history, newest first (at most 100). */
  listJobs(filters?: { status?: ExportJobStatus; dataset?: ExportJobDataset }): Observable<ApiResponse<ExportJob[]>> {
    return this.http.get<ApiResponse<ExportJob[]>>(`${this.base}/jobs`, {
      params: filters ? toHttpParams(filters) : undefined,
    });
  }

  /** Queues an export; the answer is the job in `queued` status. */
  createJob(payload: ExportJobPayload): Observable<ApiResponse<ExportJob>> {
    return this.http.post<ApiResponse<ExportJob>>(`${this.base}/jobs`, payload);
  }

  /** Queues a failed export again. */
  retryJob(id: string): Observable<ApiResponse<ExportJob>> {
    return this.http.post<ApiResponse<ExportJob>>(`${this.base}/jobs/${id}/retry`, {});
  }

  /** The signed, expiring link of a completed export (open it without a token). */
  getJobLink(id: string): Observable<ApiResponse<{ url: string; expires_in_minutes: number }>> {
    return this.http.get<ApiResponse<{ url: string; expires_in_minutes: number }>>(`${this.base}/jobs/${id}/link`);
  }

  listSchedules(): Observable<ApiResponse<ExportSchedule[]>> {
    return this.http.get<ApiResponse<ExportSchedule[]>>(`${this.base}/schedules`);
  }

  createSchedule(payload: ExportSchedulePayload): Observable<ApiResponse<ExportSchedule>> {
    return this.http.post<ApiResponse<ExportSchedule>>(`${this.base}/schedules`, payload);
  }

  updateSchedule(id: string, payload: ExportSchedulePayload): Observable<ApiResponse<ExportSchedule>> {
    return this.http.put<ApiResponse<ExportSchedule>>(`${this.base}/schedules/${id}`, payload);
  }

  deleteSchedule(id: string): Observable<ApiResponse<null>> {
    return this.http.delete<ApiResponse<null>>(`${this.base}/schedules/${id}`);
  }

  /** Reads the headers of a CSV or XLSX file and suggests the column mapping; nothing is stored. */
  previewImport(dataset: 'contacts', file: File): Observable<ApiResponse<SpreadsheetImportPreview>> {
    const body = new FormData();
    body.append('dataset', dataset);
    body.append('file', file);
    return this.http.post<ApiResponse<SpreadsheetImportPreview>>(`${this.base}/imports/preview`, body);
  }

  /** Imports the file with the mapping (target field to file header); `dryRun` validates only. */
  importFile(dataset: 'contacts', file: File, mapping: Record<string, string>, dryRun: boolean): Observable<ApiResponse<SpreadsheetImportResult>> {
    const body = new FormData();
    body.append('dataset', dataset);
    body.append('file', file);
    body.append('dry_run', dryRun ? '1' : '0');
    for (const [field, header] of Object.entries(mapping)) {
      body.append(`mapping[${field}]`, header);
    }
    return this.http.post<ApiResponse<SpreadsheetImportResult>>(`${this.base}/imports`, body);
  }
}
