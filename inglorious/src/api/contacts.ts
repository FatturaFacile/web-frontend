import type { ApiResponse, ListQuery, ListResponse, Page } from "../models/api"
import type { ContactPayload, ContactResource } from "../models/contact"
import { http } from "./http"
import { toPage } from "./page"

const PATH = "/crm/contacts"

export async function listContacts(
  query: ListQuery,
): Promise<Page<ContactResource>> {
  return toPage(await http.get<ListResponse<ContactResource>>(PATH, query))
}

export const createContact = (payload: ContactPayload) =>
  http.post<ApiResponse<ContactResource>>(PATH, payload)

export const updateContact = (id: string, payload: ContactPayload) =>
  http.put<ApiResponse<ContactResource>>(`${PATH}/${id}`, payload)

export const deleteContact = (id: string) =>
  http.delete<ApiResponse<null>>(`${PATH}/${id}`)
