import type { ListResponse, Page } from "../models/api"

/** Reads the rows and their count from either shape a list endpoint answers with. */
export function toPage<T>(response: ListResponse<T>): Page<T> {
  const { data, meta } = response

  if (Array.isArray(data)) {
    return {
      items: data,
      total: meta?.total ?? data.length,
      perPage: meta?.per_page,
    }
  }
  if (!data) return { items: [], total: 0 }

  return { items: data.data, total: data.total, perPage: data.per_page }
}
