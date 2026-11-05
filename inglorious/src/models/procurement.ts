export type PurchaseOrderStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "rejected"
  | "ordered"
  | "received"
  | "cancelled"

export interface PurchaseOrder {
  id: string
  order_number: string
  supplier_id: string
  supplier_name: string
  channel: "SDI" | "QR-Bill" | "Standard"
  status: PurchaseOrderStatus
  issue_date: string
  due_date?: string
  currency: "EUR" | "CHF"
  subtotal: number
  tax_amount: number
  total: number
}

/** `POST /procurement/purchase-orders`, as the OpenAPI spec documents it. */
export interface CreatePurchaseOrderPayload {
  supplier_id: string
  order_date: string
  expected_delivery_date: string
  lines: {
    description: string
    quantity_ordered: number
    unit_price: number
    uom: string
  }[]
}

export interface ProcurementSupplier {
  id: string
  supplier_code?: string
  company_name: string
}

export type PurchaseOrderTransition = "submit-approval" | "approve" | "reject"
