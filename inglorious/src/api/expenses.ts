import type { ApiResponse, ListQuery, ListResponse, Page } from "../models/api"
import type { ExpensePayload, ExpenseResource } from "../models/expenses"
import { http } from "./http"
import { toPage } from "./page"

const PATH = "/expenses"

export async function listExpenses(
  query: ListQuery,
): Promise<Page<ExpenseResource>> {
  return toPage(await http.get<ListResponse<ExpenseResource>>(PATH, query))
}

export const saveExpense = (id: string | null, payload: ExpensePayload) =>
  id
    ? http.put<ApiResponse<ExpenseResource>>(`${PATH}/${id}`, payload)
    : http.post<ApiResponse<ExpenseResource>>(PATH, payload)

export const deleteExpense = (id: string) =>
  http.delete<ApiResponse<unknown>>(`${PATH}/${id}`)

export const exportExpenses = () => http.download(`${PATH}/export?format=csv`)
