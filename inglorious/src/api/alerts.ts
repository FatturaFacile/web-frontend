import type { AlertPayload, AlertResource } from "../models/alerts"
import type { ApiResponse, ListQuery, ListResponse, Page } from "../models/api"
import { http } from "./http"
import { toPage } from "./page"

const PATH = "/alerts"

/** The spec documents only `page`; `search` and `severity` are sent anyway. */
export async function listAlerts(
  query: ListQuery,
): Promise<Page<AlertResource>> {
  return toPage(await http.get<ListResponse<AlertResource>>(PATH, query))
}

export const saveAlert = (id: string | null, payload: AlertPayload) =>
  id
    ? http.put<ApiResponse<AlertResource>>(`${PATH}/${id}`, payload)
    : http.post<ApiResponse<AlertResource>>(PATH, payload)

export const deleteAlert = (id: string) =>
  http.delete<ApiResponse<unknown>>(`${PATH}/${id}`)
