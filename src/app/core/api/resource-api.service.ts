import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { map, Observable } from 'rxjs';
import { toHttpParams } from '../http/laravel-http.utils';
import { ResourceHttpMethod, ResourceListResult, ResourceRow } from '../models/resource.model';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toRows(value: unknown): ResourceRow[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

/**
 * Normalises the list shapes of the API: a bare array, `{data: []}`, a resource collection
 * `{data: [], meta: {total}}`, a Laravel paginator `{data: {data: [], total}}` and `{data: {data: []}, meta}`.
 */
export function normalizeListResponse(raw: unknown): ResourceListResult {
  if (Array.isArray(raw)) {
    return { rows: toRows(raw), total: null, raw };
  }
  if (!isRecord(raw)) {
    return { rows: [], total: null, raw };
  }
  const meta = isRecord(raw['meta']) ? raw['meta'] : null;
  const data = raw['data'];
  if (Array.isArray(data)) {
    const total = meta?.['total'] ?? raw['total'];
    return { rows: toRows(data), total: typeof total === 'number' ? total : null, raw };
  }
  if (isRecord(data) && Array.isArray(data['data'])) {
    const total = data['total'] ?? meta?.['total'];
    return { rows: toRows(data['data']), total: typeof total === 'number' ? total : null, raw };
  }
  return { rows: [], total: null, raw };
}

/** Removes the `{success, message, data}` envelope when present. */
export function unwrapResponse(raw: unknown): unknown {
  return isRecord(raw) && 'data' in raw ? raw['data'] : raw;
}

/** A body holding a `File` is sent as multipart form data, anything else as JSON. */
function toRequestBody(body?: object): object | undefined {
  if (!body || !Object.values(body).some((value) => value instanceof Blob)) {
    return body;
  }
  const formData = new FormData();
  for (const [key, value] of Object.entries(body)) {
    formData.append(key, value instanceof Blob ? value : String(value));
  }
  return formData;
}

/**
 * Untyped gateway used by the declarative resource panels (WMS, procurement, manufacturing):
 * paths are relative to the API base URL (`/inventory/waves`).
 */
@Service()
export class ResourceApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  list(path: string, filters?: object): Observable<ResourceListResult> {
    return this.http
      .get<unknown>(`${this.base}${path}`, { params: filters ? toHttpParams(filters) : undefined })
      .pipe(map(normalizeListResponse));
  }

  request(method: ResourceHttpMethod, path: string, body?: object, filters?: object): Observable<unknown> {
    const url = `${this.base}${path}`;
    const params = filters ? toHttpParams(filters) : undefined;
    return this.http.request<unknown>(method, url, { body: toRequestBody(body), params }).pipe(map(unwrapResponse));
  }

  blob(method: ResourceHttpMethod, path: string, body?: object, filters?: object): Observable<Blob> {
    const params = filters ? toHttpParams(filters) : undefined;
    return this.http.request(method, `${this.base}${path}`, { body, params, responseType: 'blob' });
  }
}
