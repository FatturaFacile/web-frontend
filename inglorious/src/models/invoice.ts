import type { ContactResource } from "./contact"

export type InvoiceStatus = "draft" | "issued" | "paid" | "cancelled"
export type PaymentStatus = "unpaid" | "partially_paid" | "paid" | "overdue"
export type Jurisdiction = "IT" | "CH"
export type InvoiceType =
  "standard" | "sdi_electronic" | "ch_qr_bill" | "credit_note" | "proforma"

/** `InvoiceResource` from the OpenAPI spec (list/detail shape). */
export interface InvoiceResource {
  id: string
  invoice_number: string
  issue_date: string
  due_date: string | null
  status: InvoiceStatus
  subtotal: number
  tax_amount: number
  total: number
  currency: string
  has_swiss_qr: boolean
  /** Not in the documented schema; present on some payloads. */
  jurisdiction?: Jurisdiction
  invoice_type?: InvoiceType
  payment_status?: PaymentStatus
  contact_id?: string
  contact?: ContactResource | null
  client?: ContactResource | null
}

export interface InvoiceItemResource {
  description: string
  quantity: number
  unit_price: number
  tax_rate: number
  discount_percentage?: number | null
}

/** `GET /sales/invoices/{id}`: the list shape with its lines. */
export interface InvoiceDetailResource extends InvoiceResource {
  items?: InvoiceItemResource[]
  notes?: string | null
}

/** Body of `POST /sales/invoices`. */
export interface CreateInvoicePayload {
  contact_id: string
  invoice_type: InvoiceType
  invoice_number: string
  date: string
  due_date: string | null
  currency: string
  jurisdiction: Jurisdiction
  notes: string | null
  items: InvoiceItemResource[]
}

/** The row actions that ask before they run. */
export type InvoiceConfirmedAction = "email" | "sdi" | "proforma"
