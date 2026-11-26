import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { toHttpParams } from '../http/laravel-http.utils';
import {
  AuditEntriesMeta,
  AuditEntry,
  AuditEntryFilters,
  AuditLedgerEnvelope,
  AuditExport,
  AuditExportRequest,
  AuditHistoryItem,
  AuditIntegrity,
  AuditIntegrityRun,
} from '../models';

/**
 * Probative audit ledger (Mod 005). Read and verify only: the API has no endpoint that edits or deletes an entry (405).
 * Distinct from `AuditTrailApiService`, which reads the legacy `audit_logs` trail.
 */
@Service()
export class AuditLedgerApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/settings/audit-logs`;

  search(
    filters: AuditEntryFilters,
    cursor: string | null,
    limit = 50,
  ): Observable<AuditLedgerEnvelope<AuditEntry[], AuditEntriesMeta>> {
    return this.http.get<AuditLedgerEnvelope<AuditEntry[], AuditEntriesMeta>>(this.base, {
      params: toHttpParams({ ...filters, cursor, limit }),
    });
  }

  history(resourceType: string, resourceId: string): Observable<AuditLedgerEnvelope<AuditHistoryItem[]>> {
    return this.http.get<AuditLedgerEnvelope<AuditHistoryItem[]>>(
      `${environment.apiBaseUrl}/audit/history/${encodeURIComponent(resourceType)}/${encodeURIComponent(resourceId)}`,
    );
  }

  integrity(): Observable<AuditLedgerEnvelope<AuditIntegrity>> {
    return this.http.get<AuditLedgerEnvelope<AuditIntegrity>>(`${this.base}/integrity`);
  }

  /** Queues a verification of the whole chain: 202 on success, 409 when one is already running. */
  verify(): Observable<AuditLedgerEnvelope<AuditIntegrityRun>> {
    return this.http.post<AuditLedgerEnvelope<AuditIntegrityRun>>(`${this.base}/integrity/verify`, {});
  }

  /** The idempotency key makes a double click or a retry return the same export instead of queueing a second one. */
  requestExport(
    request: AuditExportRequest,
    idempotencyKey: string,
  ): Observable<AuditLedgerEnvelope<AuditExport>> {
    return this.http.post<AuditLedgerEnvelope<AuditExport>>(`${this.base}/exports`, request, {
      headers: new HttpHeaders({ 'Idempotency-Key': idempotencyKey }),
    });
  }

  getExport(id: string): Observable<AuditLedgerEnvelope<AuditExport>> {
    return this.http.get<AuditLedgerEnvelope<AuditExport>>(`${this.base}/exports/${encodeURIComponent(id)}`);
  }

  downloadExport(id: string): Observable<Blob> {
    return this.http.get(`${this.base}/exports/${encodeURIComponent(id)}/download`, {
      responseType: 'blob',
    });
  }
}
