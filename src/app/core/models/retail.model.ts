export interface CommercialDocumentLine {
  id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  vat_rate: number;
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
    vat_rate?: number;
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

// Backward-compatible alias
export interface RetailSession {
  id?: string;
  pos: string;
  cashier: string;
  regime: string;
  total: string;
  device: string;
  status: string;
}
