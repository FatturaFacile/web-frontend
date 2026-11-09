/** Invoicing extras: order billing, billing plans, debit notes, reports, credit, approvals, commissions. */

export interface BillingDocumentOptions {
  date?: string | null;
  due_date?: string | null;
  notes?: string | null;
  payment_method?: string | null;
  payment_terms?: string | null;
  bank_name?: string | null;
  bank_iban?: string | null;
}

export interface InvoiceFromOrderPayload extends BillingDocumentOptions {
  lines?: { sales_order_item_id?: string; quantity?: number | string }[];
}

export interface DownPaymentInvoicePayload extends BillingDocumentOptions {
  percentage?: number | string | null;
  amount?: number | string | null;
}

export interface DeferredInvoicePayload extends BillingDocumentOptions {
  delivery_note_ids: string[];
}

export interface DeferredRunPayload {
  up_to_date: string;
  contact_id?: string | null;
  date?: string | null;
  due_date?: string | null;
}

export type BillingPlanStatus = 'active' | 'completed' | 'cancelled' | string;
export type BillingPlanItemStatus = 'pending' | 'invoiced' | 'cancelled' | string;

export interface BillingPlanItem {
  id: string;
  name: string;
  milestone_id?: string | null;
  percentage?: string | null;
  amount?: string | null;
  target_date: string;
  status: BillingPlanItemStatus;
  invoice_id?: string | null;
  invoiced_at?: string | null;
}

export interface BillingPlan {
  id: string;
  schedule_number: string;
  sales_order_id: string;
  customer_id: string;
  status: BillingPlanStatus;
  currency: string;
  total_amount: string;
  billed_amount: string;
  remaining_amount: string;
  start_date?: string | null;
  end_date?: string | null;
  next_billing_date?: string | null;
  items?: BillingPlanItem[];
}

export interface BillingPlanPayload {
  sales_order_id: string;
  items: {
    name: string;
    percentage?: number | string | null;
    amount?: number | string | null;
    target_date: string;
    milestone_id?: string | null;
  }[];
}

export interface BillingPlanFilterParams {
  sales_order_id?: string;
  status?: string;
  page?: number;
  per_page?: number;
}

export interface DebitNotePayload {
  original_invoice_id: string;
  date?: string | null;
  due_date?: string | null;
  notes?: string | null;
  items: {
    product_id?: string | null;
    description: string;
    quantity: number | string;
    unit_price: number | string;
    tax_rate: number | string;
    discount_percentage?: number | string | null;
  }[];
}

export type SalesRegisterDocumentType = string;

export interface SalesRegisterParams {
  from: string;
  to: string;
  document_type?: SalesRegisterDocumentType | null;
}

export type SalesRegisterReport = Record<string, unknown>;
export type ReceivablesAgingReport = Record<string, unknown>;

export interface CustomerLedgerEntry {
  id?: string;
  date?: string;
  type?: string;
  reference?: string | null;
  debit?: string;
  credit?: string;
  balance?: string;
  [key: string]: unknown;
}

export type CustomerAging = Record<string, unknown>;

export interface InvoiceReminder {
  id: string;
  level?: number;
  sent_at?: string | null;
  channel?: string | null;
  [key: string]: unknown;
}

export interface PaymentImport {
  id: string;
  file_name?: string | null;
  status?: string | null;
  lines?: PaymentImportLine[];
  [key: string]: unknown;
}

export interface PaymentImportLine {
  id: string;
  amount?: string;
  currency?: string;
  reference?: string | null;
  debtor_name?: string | null;
  status?: string | null;
  invoice_id?: string | null;
  [key: string]: unknown;
}

export interface DeclarationOfIntent {
  id: string;
  contact_id: string;
  direction: 'received' | 'issued' | string;
  protocol_number: string;
  receipt_date: string;
  year: number;
  plafond_amount: string;
  used_amount?: string | null;
  valid_from: string;
  valid_to: string;
  notes?: string | null;
}

export interface DeclarationOfIntentPayload {
  contact_id: string;
  direction?: 'received' | 'issued' | null;
  protocol_number: string;
  receipt_date: string;
  year: number;
  plafond_amount: number | string;
  valid_from: string;
  valid_to: string;
  notes?: string | null;
}

export interface ProductCharge {
  id: string;
  code: string;
  name: string;
  calculation_basis: ProductChargeBasis;
  revenue_account_id: string;
  [key: string]: unknown;
}

export type ProductChargeBasis = 'per_unit' | 'per_kg' | 'per_litre' | 'percent_of_net';

export interface ProductChargePayload {
  code: string;
  name: string;
  calculation_basis: ProductChargeBasis;
  revenue_account_id: string;
}

export interface ProductChargeRatePayload {
  rate: number | string;
  currency: string;
  valid_from: string;
  valid_to?: string | null;
}

export interface ProductChargePreviewPayload {
  date: string;
  currency: string;
  lines: {
    product_id?: string | null;
    quantity: number | string;
    unit_price: number | string;
    tax_rate: number | string;
    discount_percentage?: number | string | null;
  }[];
}

export interface InvoiceApprovalTier {
  tier_level: number;
  approver_type: 'role' | 'user';
  approver_value: string;
  threshold_min?: number | string | null;
  threshold_max?: number | string | null;
}

export interface InvoiceApprovalMatrix {
  id: string;
  name: string;
  cost_center_id?: string | null;
  tiers?: InvoiceApprovalTier[];
}

export interface InvoiceApprovalMatrixPayload {
  name: string;
  cost_center_id?: string | null;
  tiers: InvoiceApprovalTier[];
}

export interface CommissionStatement {
  id: string;
  status?: string;
  sales_representative_id?: string | null;
  from?: string;
  to?: string;
  total_amount?: string;
  [key: string]: unknown;
}

export interface CommissionPeriodPayload {
  from: string;
  to: string;
  sales_representative_id?: string;
}

export interface SalesTeamPayload {
  name: string;
  sales_representative_ids?: string[];
}

export interface SalesTargetPayload {
  sales_representative_id?: string | null;
  sales_team_id?: string | null;
  period_start: string;
  period_end: string;
  target_amount: number | string;
  currency: string;
}

export interface CommissionSettingsPayload {
  expense_account_id: string;
  payable_account_id: string;
}
