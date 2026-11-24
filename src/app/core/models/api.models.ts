/** Laravel-style pagination block (matches `PaginationMeta` in the OpenAPI spec). */
export interface LaravelPaginationMeta {
  current_page: number;
  from: number | null;
  last_page: number;
  per_page: number;
  to: number | null;
  total: number;
}

/** Standard FatturaFacile success envelope (`ApiSuccessResponse`). */
export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

/** Generic paginated envelope: `{ success, message, data: T[], meta }`. */
export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  meta: LaravelPaginationMeta;
}

/** Standard error envelope (`ApiErrorResponse`). */
export interface ApiErrorResponse {
  success: false;
  message: string;
  error_code?: string | null;
}

/** HTTP 422 body (`ApiValidationErrorResponse`). */
export interface ApiValidationErrorResponse {
  message: string;
  errors: Record<string, string[]>;
}

/** Base query params shared by every list endpoint. */
export interface QueryFilterParams {
  page?: number;
  per_page?: number;
  search?: string;
}
