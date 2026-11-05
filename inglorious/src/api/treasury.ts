import type { ApiResponse, ListQuery, ListResponse, Page } from "../models/api"
import type {
  BankAccountResource,
  BankStatement,
  BankTransactionResource,
  ImportFormat,
} from "../models/treasury"
import { http } from "./http"
import { toPage } from "./page"

export async function listBankAccounts(): Promise<BankAccountResource[]> {
  return toPage(
    await http.get<ListResponse<BankAccountResource>>(
      "/treasury/bank-accounts",
    ),
  ).items
}

export async function listTransactions(
  query: ListQuery,
): Promise<Page<BankTransactionResource>> {
  return toPage(
    await http.get<ListResponse<BankTransactionResource>>(
      "/treasury/transactions",
      query,
    ),
  )
}

export async function listStatements(): Promise<BankStatement[]> {
  return toPage(
    await http.get<ListResponse<BankStatement>>("/banking/statements"),
  ).items
}

export const autoMatchTransactions = () =>
  http.post<ApiResponse<{ matched_count: number }>>(
    "/treasury/reconciliation/auto-match",
    {},
  )

export const reconcileStatement = (id: string) =>
  http.post<ApiResponse<{ reconciled_count: number }>>(
    `/banking/statements/${id}/reconcile`,
    {},
  )

/** A CAMT.053 (Swiss / SEPA) or CBI (Italian) bank file, under the field each endpoint expects. */
export function importStatement(format: ImportFormat, file: File) {
  const form = new FormData()
  form.append(`${format}_file`, file)
  return http.post<ApiResponse<{ imported_count: number }>>(
    `/treasury/import-${format}`,
    form,
  )
}
