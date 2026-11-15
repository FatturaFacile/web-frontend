/**
 * Italian fiscal contracts (issue #286). Field names mirror the backend "API contract for frontend";
 * money values in responses are decimal strings with two decimals and must never be recomputed here.
 */

/** Decimal amount or rate as returned by the API, e.g. `"1068.80"`. */
export type DecimalString = string;

export type VatPayability = 'I' | 'D' | 'S';
export type StampDutyChargeMode = 'customer' | 'issuer';

export type FiscalErrorCode =
  | 'forfettario_incompatible'
  | 'enasarco_rate_not_configured'
  | 'split_payment_incompatible'
  | 'split_payment_requires_vat'
  | 'invalid_natura';

/** Cassa previdenziale settings sent with an invoice/preview (`fund`) or stored as tenant default. */
export interface FundSettings {
  type: string;
  percent: number;
  vat_rate?: number | null;
  natura?: string | null;
  withholding_applies?: boolean;
}

/** Ritenuta d'acconto settings sent with an invoice/preview (`withholding`) or stored as tenant default. */
export interface WithholdingSettings {
  type: string;
  reason: string;
  rate: number;
  taxable_percent?: number | null;
  includes_fund?: boolean;
}

/** ENASARCO request block; `null` disables it on the invoice, omitting it applies the tenant default. */
export interface EnasarcoSettings {
  enabled?: boolean;
  rate?: number;
  reason?: string;
}

/** `fiscal` group of `GET /settings/preferences` and body of `PUT /settings/preferences/fiscal`. */
export interface FiscalPreferences {
  regime_fiscale?: string | null;
  default_fund?: FundSettings | null;
  default_withholding?: WithholdingSettings | null;
  stamp_duty_charge_mode?: StampDutyChargeMode | null;
  enasarco_enabled?: boolean | null;
}

export interface TaxPreviewItem {
  description?: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  discount_percentage?: number | null;
  natura?: string | null;
  withholding_applies?: boolean;
  fund_applies?: boolean;
}

/** Body of `POST /tax/preview`. `contact_id` is required by the backend when `enasarco` is sent. */
export interface TaxPreviewRequest {
  contact_id?: string | null;
  date?: string | null;
  split_payment?: boolean;
  reverse_charge?: boolean;
  vat_payability?: VatPayability;
  fund?: FundSettings | null;
  withholding?: WithholdingSettings | null;
  enasarco?: EnasarcoSettings | null;
  stamp_duty_charged_to_customer?: boolean | null;
  items: TaxPreviewItem[];
}

export interface TaxTotals {
  net: DecimalString;
  fund: DecimalString;
  taxable_vat: DecimalString;
  vat: DecimalString;
  stamp_duty: DecimalString;
  gross: DecimalString;
  withholding: DecimalString;
  enasarco: DecimalString;
  split_payment_vat: DecimalString;
  due: DecimalString;
}

export interface VatSummaryRow {
  rate: DecimalString;
  natura: string | null;
  taxable: DecimalString;
  tax: DecimalString;
  payability: VatPayability | null;
}

export interface TaxPreviewLine {
  net: DecimalString;
  tax_rate: DecimalString;
  natura: string | null;
}

export interface TaxPreviewFund {
  type: string;
  percent: DecimalString;
  base: DecimalString;
  amount: DecimalString;
  vat_rate: DecimalString;
  natura: string | null;
  withholding_applies: boolean;
}

export interface TaxPreviewWithholding {
  type: string;
  reason: string;
  rate: DecimalString;
  taxable_percent: DecimalString;
  includes_fund: boolean;
  base: DecimalString;
  amount: DecimalString;
}

export interface TaxPreviewEnasarco {
  rate: DecimalString;
  commissions: DecimalString;
  contributory_base: DecimalString;
  amount: DecimalString;
  annual_maximum: DecimalString;
  ytd_commissions: DecimalString;
}

export interface TaxStampDuty {
  applied: boolean;
  amount: DecimalString;
  charged_to_customer: boolean;
  exempt_base: DecimalString;
}

/** `data` of `POST /tax/preview`: the single source of truth for every Italian fiscal figure. */
export interface TaxPreviewResult {
  totals: TaxTotals;
  vat_summary: VatSummaryRow[];
  lines: TaxPreviewLine[];
  fund: TaxPreviewFund | null;
  withholding: TaxPreviewWithholding | null;
  enasarco: TaxPreviewEnasarco | null;
  stamp_duty: TaxStampDuty;
  split_payment: boolean;
  legal_notices: string[];
  warnings: string[];
}

/** `GET /tax/stamp-duty/quarterly`. */
export interface StampDutyQuarterlyReport {
  year: number;
  quarter: number;
  count: number;
  total_amount: DecimalString;
  f24: { tributo: string; due_date: string; deferrable: boolean };
  invoices: {
    id: string;
    number: string;
    date: string;
    customer: string | null;
    amount: DecimalString;
  }[];
}

export interface WithholdingSupplierRow {
  supplier_id: string | null;
  name: string | null;
  fiscal_code: string | null;
  vat_number: string | null;
  reason: string | null;
  invoices: number;
  gross_paid: DecimalString;
  taxable: DecimalString;
  withheld: DecimalString;
}

export interface UnpaidWithholdingRow {
  passive_invoice_id: string;
  invoice_number: string | null;
  date: string | null;
  supplier_id: string | null;
  name: string | null;
  reason: string | null;
  taxable: DecimalString;
  withheld: DecimalString;
}

/** `GET /tax/withholdings/report` (CU). */
export interface WithholdingReport {
  year: number;
  suppliers: WithholdingSupplierRow[];
  totals: { gross_paid: DecimalString; taxable: DecimalString; withheld: DecimalString };
  unpaid_withholdings: UnpaidWithholdingRow[];
}

/** `GET /tax/enasarco/status`. */
export interface EnasarcoStatus {
  contact_id: string;
  year: number;
  rate: DecimalString;
  ytd_commissions: DecimalString;
  annual_maximum: DecimalString;
  remaining_cap: DecimalString;
  annual_minimum: DecimalString;
  ytd_contributions: DecimalString;
  shortfall: DecimalString;
}

/** HTTP 422 body of a fiscal-rule violation. */
export interface FiscalErrorResponse {
  success: false;
  message: string;
  code?: FiscalErrorCode | string;
  errors: Record<string, string[]>;
}
