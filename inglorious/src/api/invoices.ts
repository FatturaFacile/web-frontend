import type { ApiResponse, ListQuery, ListResponse, Page } from "../models/api"
import type {
  CreateInvoicePayload,
  InvoiceConfirmedAction,
  InvoiceDetailResource,
  InvoiceResource,
} from "../models/invoice"
import { http } from "./http"
import { toPage } from "./page"

const PATH = "/sales/invoices"

// The request behind each action that asks first.
const CONFIRMED_ACTIONS: Record<
  InvoiceConfirmedAction,
  (id: string) => string
> = {
  email: (id) => `/documents/invoice/${id}/email`,
  sdi: (id) => `${PATH}/${id}/send-sdi`,
  proforma: (id) => `${PATH}/${id}/convert-proforma`,
}

export async function listInvoices(
  query: ListQuery,
): Promise<Page<InvoiceResource>> {
  return toPage(await http.get<ListResponse<InvoiceResource>>(PATH, query))
}

export async function getInvoice(id: string): Promise<InvoiceDetailResource> {
  return (await http.get<ApiResponse<InvoiceDetailResource>>(`${PATH}/${id}`))
    .data
}

export const createInvoice = (payload: CreateInvoicePayload) =>
  http.post<ApiResponse<InvoiceResource>>(PATH, payload)

export const runInvoiceAction = (action: InvoiceConfirmedAction, id: string) =>
  http.post<ApiResponse<unknown>>(CONFIRMED_ACTIONS[action](id))

export const downloadInvoicePdf = (id: string) =>
  http.download(`/documents/invoice/${id}/pdf?inline=true`)

/** Generates the invoice's Swiss QR-bill, then fetches it as a PDF. */
export async function generateQrBill(id: string): Promise<Blob> {
  await http.post<ApiResponse<unknown>>(`${PATH}/${id}/generate-qr-bill`)
  return http.download(`${PATH}/${id}/download-qr-bill`)
}
