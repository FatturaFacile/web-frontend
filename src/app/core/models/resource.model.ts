export type ResourceHttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/** A generic API record (list row or detail): decimals arrive as strings. */
export type ResourceRow = Record<string, unknown>;

export interface ResourceListResult {
  rows: ResourceRow[];
  /** Total of the server pagination, null when the endpoint is not paginated. */
  total: number | null;
  raw: unknown;
}
