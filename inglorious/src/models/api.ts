/** Laravel-style pagination block (`PaginationMeta` in the OpenAPI spec). */
export interface PaginationMeta {
  current_page: number
  from: number | null
  last_page: number
  per_page: number
  to: number | null
  total: number
}

/** Standard FatturaFacile success envelope (`ApiSuccessResponse`). */
export interface ApiResponse<T> {
  success: boolean
  message: string
  data: T
}

/**
 * Laravel's length-aware paginator, which `/crm/contacts` nests in the
 * envelope's `data` (checked against a real response).
 */
export interface LaravelPage<T> {
  current_page: number
  data: T[]
  first_page_url: string
  from: number | null
  last_page: number
  last_page_url: string
  links: {
    url: string | null
    label: string
    page: number | null
    active: boolean
  }[]
  next_page_url: string | null
  path: string
  per_page: number
  prev_page_url: string | null
  to: number | null
  total: number
}

/**
 * What a list endpoint answers. The spec documents the rows in `data` with a
 * top-level `meta` (`/sales/invoices`), but `/crm/contacts` nests a Laravel
 * paginator in `data` instead: both are accepted.
 */
export interface ListResponse<T> extends ApiResponse<T[] | LaravelPage<T>> {
  meta?: Partial<PaginationMeta>
}

/** A page of rows and how many there are in all, whatever the response's shape. */
export interface Page<T> {
  items: T[]
  total: number
  /** The page size the server used, when it says: it may not be the one asked for. */
  perPage?: number
}

/** HTTP 422 body (`ApiValidationErrorResponse`). */
export interface ValidationErrorBody {
  message: string
  errors: Record<string, string[]>
}

/** Query sent to every list endpoint. Filters are added by name. */
export interface ListQuery {
  page: number
  per_page: number
  search?: string
  sort_by?: string
  sort_dir?: "asc" | "desc"
  [filter: string]: string | number | undefined
}
