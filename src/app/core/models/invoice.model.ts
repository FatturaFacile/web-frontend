import { QueryFilterParams } from './api.models';
import { ContactResource } from './client.model';
import {
  DecimalString,
  EnasarcoSettings,
  FundSettings,
  TaxPreviewWithholding,
  VatPayability,
  VatSummaryRow,
  WithholdingSettings,
} from './tax.model';

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
  contact_id?: string;
  contact?: ContactResource | null;
  client?: ContactResource | null;
}

export interface InvoiceItemResource {
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  discount_percentage?: number | null;
  /** Italian fiscal fields (issue #286). */
  natura?: string | null;
  withholding_applies?: boolean | null;
  fund_applies?: boolean | null;
}

/** GET /sales/invoices/{id} — documented as including contact and items. */
export interface InvoiceDetailResource extends InvoiceResource {
  items?: InvoiceItemResource[];
  notes?: string | null;
  /** Italian fiscal figures (issue #286); decimal strings, `total_due` is null for CH/CHF invoices. */
  split_payment?: boolean | null;
  reverse_charge?: boolean | null;
  vat_payability?: VatPayability | null;
  total_due?: DecimalString | null;
  fund?: {
    type: string;
    percent: DecimalString;
    amount: DecimalString;
    vat_rate: DecimalString | null;
    natura: string | null;
    withholding_applies: boolean;
  } | null;
  withholding?: TaxPreviewWithholding | null;
  enasarco?: {
    rate: DecimalString;
    commissions: DecimalString;
    contributory_base: DecimalString;
    amount: DecimalString;
  } | null;
  stamp_duty_applied?: boolean;
  stamp_duty_amount?: DecimalString | null;
  stamp_duty_charged_to_customer?: boolean;
  vat_summary?: VatSummaryRow[] | null;
  legal_notices?: string[];
}

export interface InvoiceLineItemPayload {
  product_id?: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  discount_percentage?: number | null;
  natura?: string | null;
  withholding_applies?: boolean;
  fund_applies?: boolean;
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
  /** Italian fiscal fields (issue #286): omitted = tenant default, `null` = disabled. */
  vat_payability?: VatPayability;
  fund?: FundSettings | null;
  withholding?: WithholdingSettings | null;
  enasarco?: EnasarcoSettings | null;
  stamp_duty_charged_to_customer?: boolean | null;
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