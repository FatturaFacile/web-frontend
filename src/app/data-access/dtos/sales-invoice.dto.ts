/** Subset of an invoice as returned by `GET /sales/invoices`. */
export interface SalesInvoiceApiDto {
  id: string;
  invoice_number: string;
  date: string;
  due_date: string | null;
  currency: string;
  jurisdiction: string;
  status: string;
  payment_status: string;
  amount_due: number;
  notes: string | null;
  contact?: { id: string; name: string | null; country: string } | null;
  qr_bill_data?: { qr_iban: string; scor_reference: string } | null;
}
