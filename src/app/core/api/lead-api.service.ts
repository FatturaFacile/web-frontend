import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { map, Observable } from 'rxjs';
import {
  Lead,
  LeadActivityEvent,
  LeadActivityEventPayload,
  LeadConvertPayload,
  LeadConvertResult,
  LeadDuplicateCandidate,
  LeadDuplicateFilterParams,
  LeadFilterParams,
  LeadMergePayload,
  LeadRoutingRule,
  LeadRoutingRulePayload,
  LeadScorePreview,
  LeadScorePreviewPayload,
  LeadScoringRule,
  LeadScoringRulePayload,
  LeadSetting,
  LeadSource,
  LeadSourcePayload,
  PaginatedResponse,
  QueryFilterParams,
} from '../models';
import { toHttpParams } from '../http/laravel-http.utils';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * The lead endpoints document `{data, meta}` while most of the API wraps
 * payloads in `{success, message, data}`, and some resources are returned raw.
 * Accept all three shapes.
 */
export function unwrapApiData<T>(res: unknown): T {
  if (isRecord(res) && 'data' in res) {
    const keys = Object.keys(res);
    const envelopeKeys = ['data', 'meta', 'success', 'message', 'links'];
    if (keys.every((k) => envelopeKeys.includes(k))) {
      return res['data'] as T;
    }
  }
  return res as T;
}

/** Normalizes any list response to the app's `PaginatedResponse`, defaulting missing meta. */
export function toPaginated<T>(res: unknown, params?: QueryFilterParams): PaginatedResponse<T> {
  const data = unwrapApiData<unknown>(res);
  const items = Array.isArray(data) ? (data as T[]) : [];
  const meta = isRecord(res) && isRecord(res['meta']) ? res['meta'] : {};
  const num = (v: unknown, fallback: number): number =>
    typeof v === 'number' && Number.isFinite(v) ? v : fallback;
  const perPage = num(meta['per_page'], params?.per_page ?? items.length);
  const total = num(meta['total'], items.length);
  return {
    success: isRecord(res) && typeof res['success'] === 'boolean' ? (res['success'] as boolean) : true,
    message: isRecord(res) && typeof res['message'] === 'string' ? (res['message'] as string) : '',
    data: items,
    meta: {
      current_page: num(meta['current_page'], params?.page ?? 1),
      from: typeof meta['from'] === 'number' ? (meta['from'] as number) : null,
      to: typeof meta['to'] === 'number' ? (meta['to'] as number) : null,
      per_page: perPage,
      last_page: num(meta['last_page'], perPage > 0 ? Math.max(1, Math.ceil(total / perPage)) : 1),
      total,
    },
  };
}

@Service()
export class LeadApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/crm`;

  // --- Leads ---------------------------------------------------------------

  listLeads(filters: LeadFilterParams = {}): Observable<PaginatedResponse<Lead>> {
    return this.http
      .get<unknown>(`${this.base}/leads`, { params: toHttpParams(filters) })
      .pipe(map((res) => toPaginated<Lead>(res, filters)));
  }

  getLead(id: string): Observable<Lead> {
    return this.http.get<unknown>(`${this.base}/leads/${id}`).pipe(map((r) => unwrapApiData<Lead>(r)));
  }

  listEvents(leadId: string): Observable<LeadActivityEvent[]> {
    return this.http
      .get<unknown>(`${this.base}/leads/${leadId}/events`)
      .pipe(map((r) => toPaginated<LeadActivityEvent>(r).data));
  }

  addEvent(leadId: string, payload: LeadActivityEventPayload): Observable<LeadActivityEvent> {
    return this.http
      .post<unknown>(`${this.base}/leads/${leadId}/events`, payload)
      .pipe(map((r) => unwrapApiData<LeadActivityEvent>(r)));
  }

  rescore(leadId: string): Observable<Lead> {
    return this.http
      .post<unknown>(`${this.base}/leads/${leadId}/rescore`, {})
      .pipe(map((r) => unwrapApiData<Lead>(r)));
  }

  route(leadId: string): Observable<Lead> {
    return this.http
      .post<unknown>(`${this.base}/leads/${leadId}/route`, {})
      .pipe(map((r) => unwrapApiData<Lead>(r)));
  }

  convert(leadId: string, payload: LeadConvertPayload): Observable<LeadConvertResult> {
    return this.http
      .post<unknown>(`${this.base}/leads/${leadId}/convert`, payload)
      .pipe(map((r) => unwrapApiData<LeadConvertResult>(r)));
  }

  // --- Duplicates ----------------------------------------------------------

  listDuplicates(
    filters: LeadDuplicateFilterParams = { status: 'pending' },
  ): Observable<PaginatedResponse<LeadDuplicateCandidate>> {
    return this.http
      .get<unknown>(`${this.base}/duplicates`, { params: toHttpParams(filters) })
      .pipe(map((res) => toPaginated<LeadDuplicateCandidate>(res, filters)));
  }

  mergeDuplicate(id: string, payload: LeadMergePayload): Observable<unknown> {
    return this.http
      .post<unknown>(`${this.base}/duplicates/${id}/merge`, payload)
      .pipe(map((r) => unwrapApiData<unknown>(r)));
  }

  dismissDuplicate(id: string): Observable<unknown> {
    return this.http
      .post<unknown>(`${this.base}/duplicates/${id}/dismiss`, {})
      .pipe(map((r) => unwrapApiData<unknown>(r)));
  }

  // --- Scoring rules and settings -----------------------------------------

  listScoringRules(): Observable<LeadScoringRule[]> {
    return this.http
      .get<unknown>(`${this.base}/scoring-rules`)
      .pipe(map((r) => toPaginated<LeadScoringRule>(r).data));
  }

  getScoringRule(id: string): Observable<LeadScoringRule> {
    return this.http
      .get<unknown>(`${this.base}/scoring-rules/${id}`)
      .pipe(map((r) => unwrapApiData<LeadScoringRule>(r)));
  }

  createScoringRule(payload: LeadScoringRulePayload): Observable<LeadScoringRule> {
    return this.http
      .post<unknown>(`${this.base}/scoring-rules`, payload)
      .pipe(map((r) => unwrapApiData<LeadScoringRule>(r)));
  }

  updateScoringRule(id: string, payload: Partial<LeadScoringRulePayload>): Observable<LeadScoringRule> {
    return this.http
      .put<unknown>(`${this.base}/scoring-rules/${id}`, payload)
      .pipe(map((r) => unwrapApiData<LeadScoringRule>(r)));
  }

  deleteScoringRule(id: string): Observable<unknown> {
    return this.http.delete<unknown>(`${this.base}/scoring-rules/${id}`);
  }

  previewScore(payload: LeadScorePreviewPayload): Observable<LeadScorePreview> {
    return this.http
      .post<unknown>(`${this.base}/scoring-rules/preview`, payload)
      .pipe(map((r) => unwrapApiData<LeadScorePreview>(r)));
  }

  getSettings(): Observable<LeadSetting> {
    return this.http.get<unknown>(`${this.base}/lead-settings`).pipe(map((r) => unwrapApiData<LeadSetting>(r)));
  }

  updateSettings(payload: LeadSetting): Observable<LeadSetting> {
    return this.http
      .put<unknown>(`${this.base}/lead-settings`, payload)
      .pipe(map((r) => unwrapApiData<LeadSetting>(r)));
  }

  // --- Routing rules -------------------------------------------------------

  listRoutingRules(): Observable<LeadRoutingRule[]> {
    return this.http
      .get<unknown>(`${this.base}/routing-rules`)
      .pipe(map((r) => toPaginated<LeadRoutingRule>(r).data));
  }

  getRoutingRule(id: string): Observable<LeadRoutingRule> {
    return this.http
      .get<unknown>(`${this.base}/routing-rules/${id}`)
      .pipe(map((r) => unwrapApiData<LeadRoutingRule>(r)));
  }

  createRoutingRule(payload: LeadRoutingRulePayload): Observable<LeadRoutingRule> {
    return this.http
      .post<unknown>(`${this.base}/routing-rules`, payload)
      .pipe(map((r) => unwrapApiData<LeadRoutingRule>(r)));
  }

  updateRoutingRule(id: string, payload: Partial<LeadRoutingRulePayload>): Observable<LeadRoutingRule> {
    return this.http
      .put<unknown>(`${this.base}/routing-rules/${id}`, payload)
      .pipe(map((r) => unwrapApiData<LeadRoutingRule>(r)));
  }

  deleteRoutingRule(id: string): Observable<unknown> {
    return this.http.delete<unknown>(`${this.base}/routing-rules/${id}`);
  }

  reorderRoutingRules(ids: string[]): Observable<unknown> {
    return this.http.post<unknown>(`${this.base}/routing-rules/reorder`, { ids });
  }

  // --- Lead sources --------------------------------------------------------

  listSources(): Observable<LeadSource[]> {
    return this.http
      .get<unknown>(`${this.base}/lead-sources`)
      .pipe(map((r) => toPaginated<LeadSource>(r).data));
  }

  createSource(payload: LeadSourcePayload): Observable<LeadSource> {
    return this.http
      .post<unknown>(`${this.base}/lead-sources`, payload)
      .pipe(map((r) => unwrapApiData<LeadSource>(r)));
  }

  updateSource(id: string, payload: Partial<LeadSourcePayload>): Observable<LeadSource> {
    return this.http
      .put<unknown>(`${this.base}/lead-sources/${id}`, payload)
      .pipe(map((r) => unwrapApiData<LeadSource>(r)));
  }

  deleteSource(id: string): Observable<unknown> {
    return this.http.delete<unknown>(`${this.base}/lead-sources/${id}`);
  }

  rotateSourceSecret(id: string): Observable<LeadSource> {
    return this.http
      .post<unknown>(`${this.base}/lead-sources/${id}/rotate-secret`, {})
      .pipe(map((r) => unwrapApiData<LeadSource>(r)));
  }
}
