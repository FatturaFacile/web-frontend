import { QueryFilterParams } from './api.models';
import { ContactResource } from './client.model';
import { CustomsOriginType } from './customs-codes.model';
import {
  DecimalString,
  EnasarcoSettings,
  FundSettings,
  TaxPreviewWithholding,
  VatPayability,
  VatSummaryRow,
  WithholdingSettings,
} from './tax.model';

export type InvoiceStatus = 'draft' | 'approved' | 'posted' | 'issued' | 'paid' | 'cancelled';
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
  jurisdiction?: Jurisdiction;
  invoice_type?: InvoiceType;
  payment_status?: PaymentStatus;
  contact_id?: string;
  contact?: ContactResource | null;
  client?: ContactResource | null;
  payment_term_id?: string | null;
  /** Rate against the accounting currency, fixed by the server on the invoice date (read-only). */
  exchange_rate?: number | null;
  exchange_rate_source?: string | null;
  exchange_rate_date?: string | null;
  free_trade_agreement_id?: string | null;
  origin_declaration_text?: string | null;
  duty_exemption_eligible?: boolean;
}

export interface InvoiceItemResource {
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  discount_percentage?: number | null;
  /** Snapshots of the product customs data taken when the invoice was issued. */
  taric_code?: string | null;
  country_of_origin?: string | null;
  origin_type?: CustomsOriginType | null;
  made_in_label?: string | null;
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
  taric_code?: string | null;
  country_of_origin?: string | null;
  origin_type?: CustomsOriginType | null;
  made_in_label?: string | null;
  natura?: string | null;
  withholding_applies?: boolean;
  fund_applies?: boolean;
}

/**
 * Body of `POST /sales/invoices`. The invoice number is assigned by the server: it is never sent. The exchange rate
 * is looked up by the server for the invoice date (422 on `exchange_rate` when there is none).
 */
export interface CreateInvoicePayload {
  contact_id: string;
  invoice_type: InvoiceType;
  date: string;
  due_date?: string | null;
  currency: string;
  payment_term_id?: string | null;
  jurisdiction: Jurisdiction;
  split_payment?: boolean | null;
  reverse_charge?: boolean | null;
  notes?: string | null;
  free_trade_agreement_id?: string | null;
  origin_declaration_text?: string | null;
  duty_exemption_eligible?: boolean;
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

export interface SwissQrBillData {
  payload: string;
  svg?: string;
  png?: string;
  reference_type: 'NON' | 'QRR' | 'SCOR' | string;
  reference: string | null;
  iban: string;
  currency: string;
  amount: number;
}

export interface BulkSdiResult {
  sent: number;
  failed: number;
  results: {
    id?: string;
    invoice_id?: string;
    success?: boolean;
    status?: string;
    error?: string;
  }[];
}

export interface SdiLogEntry {
  id?: string;
  action?: string;
  status?: string;
  transmitted_at?: string;
  receipt_code?: string;
  details?: string | null;
  created_at?: string;
}

export interface SdiLogsData {
  outbound: SdiLogEntry[];
  inbound: SdiLogEntry[];
}

export interface CreateCreditNotePayload {
  original_invoice_id: string;
  date?: string | null;
  notes?: string | null;
  items: {
    product_id?: string | null;
    description: string;
    quantity: number;
    unit_price: number;
    tax_rate: number;
  }[];
}

export interface CreditNoteResource {
  id: string;
  credit_note_number: string;
  original_invoice_id: string;
  contact_id: string;
  date: string;
  currency: string;
  total_net: number;
  total_tax: number;
  total_gross: number;
  status: string;
}

export interface InvoiceInstallment {
  id?: string;
  installment_number: number;
  due_date: string;
  amount: number;
  status: 'unpaid' | 'paid' | 'overdue' | string;
}

export type DocumentEmailType = 'invoice' | 'quote' | 'order' | 'delivery_note' | 'work_order';

/** One e-mail sent for a document (`GET /documents/{type}/{id}/emails`). */
export interface DocumentEmailRecord {
  id: string;
  recipient: string;
  subject: string | null;
  message: string | null;
  status: string;
  error: string | null;
  sent_at: string | null;
  attachment_name: string | null;
  created_at?: string | null;
}
