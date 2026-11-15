/** Localization packs of the general ledger: VAT code packs, FEC and SII exports, US sales tax and 1099 data capture. */

/** Envelope of the localization endpoints: `{ data }` without the `success` and `message` fields. */
export interface DataEnvelope<T> {
  data: T;
}

/** Countries that have a VAT code pack. */
export type VatCodePackCountry = 'FR' | 'ES' | 'DE';

/** One entry of GET /general-ledger/vat-code-packs. */
export interface VatCodePack {
  country: VatCodePackCountry;
  name: string;
  codes: number;
}

/** Result of POST /general-ledger/vat-code-packs/{country}/import. */
export interface VatCodePackImportResult {
  country: VatCodePackCountry;
  created: number;
  updated: number;
}

export type SiiBookType = 'sales' | 'purchases';

export type UsTaxLevel = 'state' | 'county' | 'city' | 'special';

export const US_TAX_LEVELS: readonly UsTaxLevel[] = ['state', 'county', 'city', 'special'];

export type UsNexusType = 'physical' | 'economic' | 'affiliate' | 'marketplace';

export const US_NEXUS_TYPES: readonly UsNexusType[] = [
  'physical',
  'economic',
  'affiliate',
  'marketplace',
];

export interface UsTaxRate {
  id: string;
  jurisdiction_id: string;
  rate_percent: string;
  effective_from: string;
  effective_to: string | null;
  applies_to_shipping: boolean;
}

export interface UsTaxJurisdiction {
  id: string;
  code: string;
  name: string;
  state: string;
  level: UsTaxLevel;
  county: string | null;
  city: string | null;
  zip_prefix: string | null;
  is_active: boolean;
  rates: UsTaxRate[];
}

export interface UsTaxJurisdictionPayload {
  code: string;
  name: string;
  state: string;
  level: UsTaxLevel;
  county?: string | null;
  city?: string | null;
  zip_prefix?: string | null;
}

export interface UsTaxRatePayload {
  rate_percent: number;
  effective_from: string;
  effective_to?: string | null;
  applies_to_shipping?: boolean;
}

export interface UsTaxNexus {
  id: string;
  state: string;
  nexus_type: UsNexusType;
  established_on: string;
  ended_on: string | null;
  registration_number: string | null;
  sales_threshold: string | null;
  transactions_threshold: number | null;
}

export interface UsTaxNexusPayload {
  state: string;
  nexus_type: UsNexusType;
  established_on: string;
  ended_on?: string | null;
  registration_number?: string | null;
  sales_threshold?: number | null;
  transactions_threshold?: number | null;
}

export interface UsTaxCalculationPayload {
  state: string;
  date?: string | null;
  taxable_amount: number;
  shipping_amount?: number | null;
  county?: string | null;
  city?: string | null;
  zip?: string | null;
  customer_id?: string | null;
}

export interface UsTaxCalculationLine {
  jurisdiction_id: string;
  code: string;
  name: string;
  level: UsTaxLevel;
  rate_percent: string;
  tax: string;
  exempt: boolean;
}

/** Result of POST /general-ledger/us-tax/calculate; `reason` is `no_nexus` when the state has no nexus on the date. */
export interface UsTaxCalculation {
  state: string;
  date: string;
  has_nexus: boolean;
  taxable_amount: string;
  shipping_amount: string;
  lines: UsTaxCalculationLine[];
  rate_percent: string;
  tax_total: string;
  exempt_tax: string;
  exemption_certificate_id: string | null;
  reason: string | null;
}

export type Us1099Form = '1099-NEC' | '1099-MISC';

export const US_1099_BOXES: Readonly<Record<Us1099Form, readonly string[]>> = {
  '1099-NEC': ['1', '4'],
  '1099-MISC': ['1', '2', '3', '6', '10'],
};

export type Us1099TinType = 'ein' | 'ssn' | 'itin';

export const US_1099_TIN_TYPES: readonly Us1099TinType[] = ['ein', 'ssn', 'itin'];

/** A 1099 recipient; the tax identification number is never returned, only its last four digits. */
export interface Us1099Recipient {
  id: string;
  name: string;
  business_name: string | null;
  tin_type: Us1099TinType;
  tin_last4: string | null;
  address_line: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  default_form: Us1099Form;
  is_exempt: boolean;
  w9_received_on: string | null;
}

export interface Us1099RecipientPayload {
  name: string;
  business_name?: string | null;
  tin_type?: Us1099TinType;
  tin?: string | null;
  address_line?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  default_form?: Us1099Form;
  is_exempt?: boolean;
  w9_received_on?: string | null;
}

export interface Us1099PaymentPayload {
  recipient_id: string;
  paid_on?: string;
  amount?: number;
  supplier_payment_id?: string | null;
  form_type: Us1099Form;
  box: string;
  payment_method?: string | null;
  reference?: string | null;
}

export interface Us1099SummaryBox {
  form_type: Us1099Form;
  box: string;
  amount: string;
  meets_threshold: boolean;
}

export interface Us1099SummaryRecipient {
  recipient_id: string;
  name: string;
  tin_type: Us1099TinType;
  tin_last4: string | null;
  is_exempt: boolean;
  reportable: boolean;
  missing_tin: boolean;
  missing_w9: boolean;
  boxes: Us1099SummaryBox[];
}

/** A captured 1099 payment; `supplier_payment_id` is set when it was derived from a supplier payment. */
export interface Us1099Payment {
  id: string;
  recipient_id: string;
  supplier_payment_id: string | null;
  paid_on: string;
  amount: string;
  currency: string;
  form_type: Us1099Form;
  box: string;
  payment_method: string | null;
  reference: string | null;
}

export type Us1099PaymentUpdatePayload = Partial<Omit<Us1099PaymentPayload, 'recipient_id' | 'supplier_payment_id'>>;

/** A supplier payment not yet linked to a 1099 payment (GET /general-ledger/us-1099/supplier-payments). */
export interface Us1099SupplierPayment {
  id: string;
  passive_invoice_id: string;
  invoice_number: string | null;
  paid_at: string;
  amount: string;
  currency: string;
  reference: string | null;
}

/** Result of GET /general-ledger/us-1099/summary. */
export interface Us1099Summary {
  year: number;
  threshold: string;
  recipients: Us1099SummaryRecipient[];
}

export type UsTaxJurisdictionUpdatePayload = Partial<
  Pick<UsTaxJurisdictionPayload, 'code' | 'name' | 'county' | 'city' | 'zip_prefix'> & { is_active: boolean }
>;

export type UsTaxRateUpdatePayload = Partial<UsTaxRatePayload>;

export type UsTaxNexusUpdatePayload = Partial<Omit<UsTaxNexusPayload, 'state'>>;

export type Us1099RecipientUpdatePayload = Partial<Us1099RecipientPayload>;

/** Result of POST /general-ledger/us-tax/preload. */
export interface UsTaxPreloadResult {
  created: number;
  skipped: number;
}

export interface UsTaxLookupParams {
  state?: string | null;
  zip?: string | null;
  county?: string | null;
  city?: string | null;
  date?: string | null;
}

export interface UsTaxLookupLine {
  jurisdiction_id: string;
  code: string;
  name: string;
  level: UsTaxLevel;
  rate_percent: string;
}

/** Result of GET /general-ledger/us-tax/lookup. */
export interface UsTaxLookup {
  state: string;
  date: string;
  zip: string | null;
  has_nexus: boolean;
  lines: UsTaxLookupLine[];
  rate_percent: string;
}

export const US_EXEMPTION_REASONS = ['resale', 'government', 'nonprofit', 'manufacturing', 'agricultural', 'other'] as const;

export type UsExemptionReason = (typeof US_EXEMPTION_REASONS)[number];

export interface UsTaxExemptionCertificate {
  id: string;
  contact_id: string;
  jurisdiction_id: string | null;
  state: string;
  certificate_number: string;
  reason: UsExemptionReason;
  issued_on: string;
  expires_on: string | null;
  is_active: boolean;
  notes: string | null;
}

export interface UsTaxExemptionCertificatePayload {
  contact_id: string;
  state: string;
  jurisdiction_id?: string | null;
  certificate_number: string;
  reason?: UsExemptionReason;
  issued_on: string;
  expires_on?: string | null;
  is_active?: boolean;
  notes?: string | null;
}

export type UsTaxExemptionCertificateUpdatePayload = Partial<Omit<UsTaxExemptionCertificatePayload, 'contact_id' | 'state'>>;

/** One box of a country VAT return; `NN_tax` is the tax of the base box `NN`. */
export interface CountryVatReturnBox {
  code: string;
  label: string;
  amount: string;
}

export type CountryVatReturnForm = 'CA3' | '303' | 'UStVA';

/** Result of GET /general-ledger/fr/ca3, es/modelo-303 and de/ustva. */
export interface CountryVatReturn {
  form: CountryVatReturnForm;
  country: 'FR' | 'ES' | 'DE';
  from: string;
  to: string;
  boxes: CountryVatReturnBox[];
  vat_due: string;
  vat_credit: string;
  warnings: string[];
}

export interface CountryVatReturnQuarter extends CountryVatReturn {
  quarter: number;
}

/** Result of GET /general-ledger/es/modelo-390. */
export interface SpanishAnnualVatSummary {
  form: '390';
  country: 'ES';
  year: number;
  quarters: CountryVatReturnQuarter[];
  annual: CountryVatReturn;
}

export interface DatevExportParams {
  from: string;
  to: string;
  consultant_number?: number | null;
  client_number?: number | null;
  account_length?: number | null;
}

/** A lettering: ledger lines of one account whose debits and credits cancel out. */
export interface JournalLettering {
  lettering_code: string;
  lettered_on: string;
  account_id: string;
  line_ids: string[];
}

export interface JournalLetteringResult {
  lettering_code: string;
  lettered_on: string;
  lines: number;
}
