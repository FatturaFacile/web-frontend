import { ApiResponse, LaravelPaginationMeta } from '../models';

/**
 * Shared loose types for the "extra" API services that cover backend endpoints
 * whose payloads are still free-form from the UI point of view.
 */

/** Free-form request body. */
export type ExtraPayload = Record<string, unknown>;

/** A backend record: always has an id, other attributes are read defensively. */
export type ExtraRecord = { id: string } & Record<string, unknown>;

/** Query-string parameters (undefined / null / empty values are dropped). */
export type ExtraParams = Record<string, string | number | boolean | null | undefined>;

/** Envelope used by modules that answer `{ data: T }` only. */
export interface DataEnvelope<T> {
  data: T;
  message?: string;
}

/** Envelope used by modules that answer a paginated `{ data: T[], meta }`. */
export interface DataListEnvelope<T> extends DataEnvelope<T[]> {
  meta?: { current_page?: number; last_page?: number; per_page?: number; total?: number };
}

/** A backend object that is not a stored record (report, summary, link): no `id` guaranteed. */
export type ExtraObject = Record<string, unknown>;

/** List answer that may or may not be paginated (`meta` is present only when it is). */
export type ExtraListResponse = ApiResponse<ExtraRecord[]> & { meta?: LaravelPaginationMeta };

/** Optional text fields sent next to an uploaded file (null / undefined are skipped). */
export type ExtraUploadFields = Record<string, string | number | boolean | null | undefined>;
