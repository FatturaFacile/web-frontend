import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { map, Observable } from 'rxjs';
import {
  AuditEnvelope,
  AuditExportBundle,
  AuditLogDetail,
  AuditLogEntry,
  AuditLogFilters,
  AuditLogPage,
  AuditVerificationCertificate,
  AuditWormBatch,
} from '../models';

/** Immutable audit trail: read, verify, export and WORM archive. The API has no endpoint that edits or deletes a record. */
@Service()
export class AuditTrailApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/audit-logs`;

  list(filters: AuditLogFilters, page = 1, perPage = 50): Observable<AuditLogPage> {
    return this.http.get<AuditLogPage>(this.base, {
      params: this.params(filters, { page, per_page: perPage }),
    });
  }

  get(id: string): Observable<AuditEnvelope<AuditLogDetail>> {
    return this.http.get<AuditEnvelope<AuditLogDetail>>(`${this.base}/${encodeURIComponent(id)}`);
  }

  entityTimeline(type: string, id: string): Observable<AuditEnvelope<AuditLogEntry[]>> {
    return this.http.get<AuditEnvelope<AuditLogEntry[]>>(
      `${this.base}/entity/${encodeURIComponent(type)}/${encodeURIComponent(id)}`,
    );
  }

  verifyIntegrity(
    range: { from_sequence?: number; to_sequence?: number } = {},
  ): Observable<AuditEnvelope<AuditVerificationCertificate>> {
    return this.http.post<AuditEnvelope<AuditVerificationCertificate>>(
      `${this.base}/verify-integrity`,
      range,
    );
  }

  wormBatches(): Observable<AuditEnvelope<AuditWormBatch[]>> {
    return this.http.get<AuditEnvelope<AuditWormBatch[]>>(`${this.base}/worm-batches`);
  }

  sealWormBatches(): Observable<AuditEnvelope<AuditWormBatch[]>> {
    return this.http.post<AuditEnvelope<AuditWormBatch[]>>(`${this.base}/worm-batches/seal`, {});
  }

  exportBundle(filters: AuditLogFilters): Observable<AuditExportBundle> {
    return this.http
      .get(`${this.base}/export`, {
        params: this.params(filters),
        responseType: 'blob',
        observe: 'response',
      })
      .pipe(
        map((response) => ({
          blob: response.body as Blob,
          filename:
            /filename="?([^";]+)"?/.exec(response.headers.get('Content-Disposition') ?? '')?.[1] ??
            'audit-bundle.jsonl',
          sha256: response.headers.get('X-Audit-Bundle-SHA256'),
          signature: response.headers.get('X-Audit-Bundle-Signature'),
        })),
      );
  }

  private params(filters: AuditLogFilters, extra: Record<string, number> = {}): HttpParams {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(filters)) {
      if (Array.isArray(value)) {
        value.forEach((item) => (params = params.append(`${key}[]`, item)));
      } else if (typeof value === 'string' && value !== '') {
        params = params.set(key, value);
      }
    }
    for (const [key, value] of Object.entries(extra)) {
      params = params.set(key, String(value));
    }
    return params;
  }
}
