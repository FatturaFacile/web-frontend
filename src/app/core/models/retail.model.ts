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

export type RetailPaymentMethod = 'cash' | 'card' | 'voucher' | 'bank_transfer' | 'mobile' | 'other';

export type RetailRefundMethod = 'cash' | 'card' | 'other';

/** One line of a ticket sent to the till: a catalogue product or a free line. */
export interface RetailTicketLinePayload {
  product_id?: string | null;
  description?: string;
  quantity: number;
  unit_price?: number;
  tax_rate?: number;
}

export interface RetailPaymentPayload {
  method: RetailPaymentMethod;
  amount: number;
  reference?: string | null;
}

export interface RetailTicketPayload {
  pos_session_id: string;
  contact_id?: string | null;
  items: RetailTicketLinePayload[];
  payments: RetailPaymentPayload[];
}

/** Priced lines (discount lines have a negative unit price) and the promotions applied (`POST /fiscal-retail/pos/promotions/preview`). */
export interface RetailTicketPreview {
  items: { description: string; quantity: string; unit_price: string; tax_rate: string }[];
  promotions: { code: string; name: string; discount_net: string }[];
  discount_total: string;
  total_net: string;
  total_tax: string;
  total_gross: string;
}

export interface RetailTicketItem {
  id: string;
  product_id: string | null;
  description: string;
  quantity: string;
  unit_price: string;
  tax_rate: string;
  line_total: string;
  returnable_quantity?: string;
}

export interface RetailTicket {
  id: string;
  pos_session_id: string;
  receipt_number: string;
  status: string;
  total_net: string;
  total_tax: string;
  total_gross: string;
  items: RetailTicketItem[];
  payments: { method: string; amount: string; reference: string | null }[];
  promotions: { code: string; name: string; discount_net: string }[];
}

export interface RetailReturnPayload {
  pos_session_id: string;
  lines: { pos_sale_item_id: string; quantity: number }[];
  refund_method: RetailRefundMethod;
  reason?: string | null;
}

export type RetailSaleRefundPayload = Omit<RetailReturnPayload, 'lines'>;

export interface RetailReturn {
  id: string;
  number: string;
  pos_sale_id: string;
  total_gross: string;
  cash_refunded: string;
  other_refunded: string;
}
