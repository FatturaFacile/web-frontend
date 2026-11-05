// Swiss amounts round to five centimes, the smallest coin.
const STEPS_PER_FRANC = 20

export interface QrBillAddress {
  name: string
  address: string
  postalCode: string
  city: string
  country: string
  qrIban?: string
}

export type QrBillStatus = "DRAFT" | "PENDING" | "PAID" | "CANCELLED"

/** `GET /sales/qr-bills`, as the Angular app read it: not in the API spec. */
export interface QrBill {
  id: string
  billNumber: string
  issueDate: string
  dueDate: string
  currency: "CHF" | "EUR"
  amount: number
  creditor: QrBillAddress
  debtor: QrBillAddress
  reference: string
  unstructuredMessage: string
  status: QrBillStatus
}

/** CHF commercial rounding, to 0.05. */
export function roundSwissAmount(amount: number): number {
  return Math.round(amount * STEPS_PER_FRANC) / STEPS_PER_FRANC
}

export function toQrBill(bill: QrBill): QrBill {
  return {
    ...bill,
    amount:
      bill.currency === "CHF" ? roundSwissAmount(bill.amount) : bill.amount,
  }
}

/** A 27-digit QR reference, in the groups the payment part prints. */
export function formatScor(reference: string): string {
  return reference.replace(
    /(\d{2})(\d{5})(\d{5})(\d{5})(\d{5})(\d{5})/,
    "$1 $2 $3 $4 $5 $6",
  )
}
