export interface BankAccountResource {
  id: string
  bank_name: string
  account_name?: string
  iban: string
  bic?: string | null
  currency: "EUR" | "CHF"
  balance: number
  is_active: boolean
}

export interface BankTransactionResource {
  id: string
  bank_account_id: string
  transaction_date: string
  value_date?: string
  amount: number
  currency: string
  description: string
  counterparty?: string | null
  reference?: string | null
  reconciled: boolean
  category?: string | null
}

export type StatementStatus = "imported" | "reconciled" | "partially_reconciled"

export interface BankStatement {
  id: string
  file_name?: string
  iban: string
  statement_date: string
  opening_balance: number
  closing_balance: number
  currency: string
  status: StatementStatus
  source_format: "camt053" | "cbi" | "csv" | "xlsx"
  lines_count?: number
  reconciled_lines_count?: number
}

export type ImportFormat = "camt" | "cbi"
