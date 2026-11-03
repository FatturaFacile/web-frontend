export type ExpenseStatus =
  "draft" | "pending_approval" | "approved" | "rejected" | "reimbursed" | "paid"

export interface ExpenseResource {
  id: string
  expense_number?: string
  date: string
  category_name?: string
  amount: number
  currency: string
  description: string
  merchant?: string
  status: ExpenseStatus
}

export interface ExpensePayload {
  date: string
  amount: number
  currency: "EUR" | "CHF"
  description: string
  merchant?: string
  status: ExpenseStatus
}
