export interface CommercialDocumentLine {
  id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  total_amount: number;
}

export interface CommercialDocumentResource {
  id: string;
  document_number: string;
  pos_sale_id?: string | null;
  cashier_name?: string | null;
  device_serial?: string | null;
  issued_at: string;
  payment_method: 'cash' | 'card' | 'electronic' | string;
  total_amount: number | string;
  vat_amount?: number | string;
  status: 'issued' | 'voided' | 'refunded' | string;
  voided_at?: string | null;
  lines?: CommercialDocumentLine[];
}

export interface StoreCommercialDocumentPayload {
  pos_sale_id?: string | null;
  payment_method: string;
  cashier_name?: string;
  lines: {
    description: string;
    quantity: number;
    unit_price: number;
    tax_rate: number;
  }[];
}

export interface DailyCorrispettivoResource {
  date: string;
  device_serial: string;
  total_sales: number | string;
  total_vat: number | string;
  total_refunds?: number | string;
  transactions_count: number;
  status: 'open' | 'transmitted' | 'closed' | string;
}

/** POS cash session (`GET /retail/pos/sessions`); amounts are decimal strings. */
export interface RetailPosSession {
  id: string;
  tenant_id: string | null;
  pos_terminal_id: string;
  user_id: string;
  opened_at: string;
  closed_at: string | null;
  opening_float: string;
  closing_cash: string | null;
  total_sales: string;
  status: string;
  expected_cash: string | null;
  cash_difference: string | null;
}

/** Laravel paginator nested in the success envelope, as returned by the POS session list. */
export interface RetailPosSessionPage {
  current_page: number;
  data: RetailPosSession[];
  last_page: number;
  per_page: number;
  total: number;
}
