import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { toHttpParams } from '../http/laravel-http.utils';

export type ExportDataset = 'invoices' | 'purchases' | 'payments' | 'contacts';

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
}
