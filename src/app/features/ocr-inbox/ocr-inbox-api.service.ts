import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { toHttpParams } from '../../core/http/laravel-http.utils';
import {
  ExtractionJob,
  InboxPage,
  InboxStatus,
  ReviewedPayload,
  Workbench,
} from './ocr-inbox.models';

export interface Envelope<T> {
  success: boolean;
  message: string;
  data: T;
}

/** HTTP access to `/api/v1/ocr-inbox` (Mod 092: AI Inbox and document review workbench). */
@Service()
export class OcrInboxApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/ocr-inbox`;

  /** The queue with its counters; with `jobId` the response also carries the workbench of that job. */
  inbox(filters: {
    status?: InboxStatus | null;
    jobId?: string | null;
    page?: number;
    perPage?: number;
  }): Observable<Envelope<InboxPage>> {
    return this.http.get<Envelope<InboxPage>>(this.base, {
      params: toHttpParams({
        status: filters.status,
        job_id: filters.jobId,
        page: filters.page,
        per_page: filters.perPage,
      }),
    });
  }

  workbench(jobId: string): Observable<Envelope<Workbench>> {
    return this.http.get<Envelope<Workbench>>(`${this.base}/${jobId}`);
  }

  saveDraft(jobId: string, draft: ReviewedPayload): Observable<Envelope<ExtractionJob>> {
    return this.http.put<Envelope<ExtractionJob>>(`${this.base}/${jobId}/draft`, draft);
  }

  confirm(jobId: string, reviewed: ReviewedPayload): Observable<Envelope<ExtractionJob>> {
    return this.http.post<Envelope<ExtractionJob>>(`${this.base}/${jobId}/confirm`, reviewed);
  }

  reject(jobId: string, reason: string): Observable<Envelope<ExtractionJob>> {
    return this.http.post<Envelope<ExtractionJob>>(`${this.base}/${jobId}/reject`, { reason });
  }

  rerun(jobId: string): Observable<Envelope<ExtractionJob>> {
    return this.http.post<Envelope<ExtractionJob>>(`${this.base}/${jobId}/rerun`, {});
  }
}
