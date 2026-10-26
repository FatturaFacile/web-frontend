import { QueryFilterParams } from './api.models';
import { ContactResource } from './client.model';

export type InvoiceStatus = 'draft' | 'issued' | 'paid' | 'cancelled';
export type PaymentStatus = 'unpaid' | 'partially_paid' | 'paid' | 'overdue';
export type Jurisdiction = 'IT' | 'CH';
export type InvoiceType = 'standard' | 'sdi_electronic' | 'ch_qr_bill' | 'credit_note' | 'proforma';

/** `InvoiceResource` from the OpenAPI spec (list/detail shape). */
export interface InvoiceResource {
  id: string;
  invoice_number: string;
  issue_date: string;
  due_date: string | null;
  status: InvoiceStatus;
  subtotal: number;
  tax_amount: number;
  total: number;
  currency: string;
  has_swiss_qr: boolean;
  /** Not in the documented schema; present on some payloads, handled defensively. */
  jurisdiction?: Jurisdiction;
  invoice_type?: InvoiceType;
  payment_status?: PaymentStatus;
}

export interface InvoiceItemResource {
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  discount_percentage?: number | null;
}

/** GET /sales/invoices/{id} — documented as including contact and items. */
export interface InvoiceDetailResource extends InvoiceResource {
  contact_id?: string;
  contact?: ContactResource | null;
  items?: InvoiceItemResource[];
  notes?: string | null;
}

export interface InvoiceLineItemPayload {
  product_id?: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  discount_percentage?: number | null;
}

/** Body of `POST /sales/invoices`. */
export interface CreateInvoicePayload {
  contact_id: string;
  invoice_type: InvoiceType;
  invoice_number: string;
  date: string;
  due_date?: string | null;
  currency: string;
  exchange_rate?: number | null;
  jurisdiction: Jurisdiction;
  split_payment?: boolean | null;
  reverse_charge?: boolean | null;
  notes?: string | null;
  items: InvoiceLineItemPayload[];
}

/** Query params of `GET /sales/invoices`. */
export interface InvoiceFilterParams extends QueryFilterParams {
  payment_status?: PaymentStatus;
  jurisdiction?: Jurisdiction;
}

export interface SendDocumentEmailPayload {
  to?: string | null;
  message?: string | null;
}

