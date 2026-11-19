import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { toHttpParams } from '../../core/http/laravel-http.utils';
import {
  AuditFilters,
  BatchFilters,
  BatchVerification,
  CreateBatchPayload,
  ItemFilters,
  ItemVerification,
  PageMeta,
  PreservationAuditLog,
  PreservationBatch,
  PreservationBatchDetail,
  PreservationConfiguration,
  PreservationConfigurationUpdate,
  PreservationDashboard,
  PreservationItem,
  TestConnectionResult,
} from './digital-preservation.models';

export interface Envelope<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface Page<T> extends Envelope<T[]> {
  meta: PageMeta;
}

/** HTTP access to `/api/v1/preservation` (Issue #212: digital preservation, PdV/PdA/PdD, WORM vault). */
@Service()
export class DigitalPreservationApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/preservation`;

  dashboard(): Observable<Envelope<PreservationDashboard>> {
    return this.http.get<Envelope<PreservationDashboard>>(`${this.base}/dashboard`);
  }

  configuration(): Observable<Envelope<PreservationConfiguration>> {
    return this.http.get<Envelope<PreservationConfiguration>>(`${this.base}/configuration`);
  }

  saveConfiguration(
    payload: PreservationConfigurationUpdate,
  ): Observable<Envelope<PreservationConfiguration>> {
    return this.http.put<Envelope<PreservationConfiguration>>(
      `${this.base}/configuration`,
      payload,
    );
  }

  testConnection(): Observable<Envelope<TestConnectionResult>> {
    return this.http.post<Envelope<TestConnectionResult>>(
      `${this.base}/configuration/test-connection`,
      {},
    );
  }

  batches(filters: BatchFilters): Observable<Page<PreservationBatch>> {
    return this.http.get<Page<PreservationBatch>>(`${this.base}/batches`, {
      params: toHttpParams(filters),
    });
  }

  batch(id: string): Observable<Envelope<PreservationBatchDetail>> {
    return this.http.get<Envelope<PreservationBatchDetail>>(`${this.base}/batches/${id}`);
  }

  createBatch(payload: CreateBatchPayload): Observable<Envelope<PreservationBatch>> {
    return this.http.post<Envelope<PreservationBatch>>(`${this.base}/batches`, payload);
  }

  seal(id: string): Observable<Envelope<PreservationBatch>> {
    return this.http.post<Envelope<PreservationBatch>>(`${this.base}/batches/${id}/seal`, {});
  }

  dispatch(id: string): Observable<Envelope<PreservationBatch>> {
    return this.http.post<Envelope<PreservationBatch>>(`${this.base}/batches/${id}/dispatch`, {});
  }

  verifyBatch(id: string): Observable<Envelope<BatchVerification>> {
    return this.http.post<Envelope<BatchVerification>>(`${this.base}/batches/${id}/verify`, {});
  }

  exportBatchPdd(id: string): Observable<Blob> {
    return this.http.get(`${this.base}/batches/${id}/export-pdd`, { responseType: 'blob' });
  }

  items(filters: ItemFilters): Observable<Page<PreservationItem>> {
    return this.http.get<Page<PreservationItem>>(`${this.base}/items`, {
      params: toHttpParams(filters),
    });
  }

  exportItemPdd(id: string): Observable<Blob> {
    return this.http.get(`${this.base}/items/${id}/export-pdd`, { responseType: 'blob' });
  }

  verifyItem(id: string): Observable<Envelope<ItemVerification>> {
    return this.http.post<Envelope<ItemVerification>>(`${this.base}/items/${id}/verify`, {});
  }

  auditLogs(filters: AuditFilters): Observable<Page<PreservationAuditLog>> {
    return this.http.get<Page<PreservationAuditLog>>(`${this.base}/audit-logs`, {
      params: toHttpParams(filters),
    });
  }
}
