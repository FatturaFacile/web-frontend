import { type QrBill, toQrBill } from "../models/qr-bill"
import { http } from "./http"

/** The endpoint answers with a bare array, without the usual envelope. */
export async function listQrBills(): Promise<QrBill[]> {
  const bills = await http.get<QrBill[]>("/sales/qr-bills")
  return bills.map(toQrBill)
}
