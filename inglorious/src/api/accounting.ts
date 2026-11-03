import type {
  ChartOfAccount,
  CreateLedgerEntryPayload,
  LedgerEntry,
  VatSettlement,
} from "../models/accounting"
import type { ApiResponse, ListQuery, ListResponse, Page } from "../models/api"
import { http } from "./http"
import { toPage } from "./page"

const PATH = "/accounting"

export async function listLedgerEntries(
  query: ListQuery,
): Promise<Page<LedgerEntry>> {
  return toPage(
    await http.get<ListResponse<LedgerEntry>>(`${PATH}/ledger-entries`, query),
  )
}

export async function listChartOfAccounts(): Promise<ChartOfAccount[]> {
  return toPage(
    await http.get<ListResponse<ChartOfAccount>>(`${PATH}/chart-of-accounts`),
  ).items
}

export async function listVatSettlements(): Promise<VatSettlement[]> {
  return toPage(
    await http.get<ListResponse<VatSettlement>>(`${PATH}/vat-settlements`),
  ).items
}

export const createLedgerEntry = (payload: CreateLedgerEntryPayload) =>
  http.post<ApiResponse<LedgerEntry>>(`${PATH}/ledger-entries`, payload)
