export type QuoteStatus =
  | 'draft'
  | 'pending_approval'
  | 'sent'
  | 'viewed'
  | 'negotiating'
  | 'accepted'
  | 'rejected'
  | 'expired'
  | 'superseded'
  | 'converted';

export type QuoteLineType =
  'product' | 'service_fixed' | 'service_time_and_material' | 'text_note' | 'subtotal';
export type LineSelectionMode = 'mandatory' | 'optional' | 'alternative_group';
export type QuoteSignatureLevel = 'ses_otp' | 'aes' | 'qes';
export type QuoteJurisdiction = 'CH' | 'IT' | 'EU';

export interface TierPrice {
  min_qty: number;
  unit_price: number;
}

/** A section as the editor holds it. `id` is set once it was saved: sending it back keeps the lineage the revision diff matches on. */
export interface EditorSection {
  key: string;
  id: string | null;
  title: string;
  description: string;
  discount_percent: number;
  page_break_before: boolean;
}

export interface EditorLine {
  key: string;
  id: string | null;
  sectionKey: string | null;
  line_type: QuoteLineType;
  selection_mode: LineSelectionMode;
  alternative_group: string | null;
  is_default_selected: boolean;
  product_id: string | null;
  sku: string | null;
  description: string;
  uom: string | null;
  quantity: number;
  unit_price: number;
  unit_cost: number;
  discount_percent: number;
  discount_fixed: number;
  tax_rate: number;
  tier_prices: TierPrice[] | null;
}

export interface EditorHeader {
  customer_name: string;
  customer_email: string;
  contact_id: string | null;
  currency: 'CHF' | 'EUR';
  jurisdiction: QuoteJurisdiction;
  locale: string;
  valid_until: string | null;
  payment_terms: string;
  incoterms: string;
  cover_letter: string;
  terms_and_conditions: string;
  header_discount_percent: number;
  min_margin_percent: number | null;
  signature_level: QuoteSignatureLevel;
  auto_convert: boolean;
}

/** Totals computed by the editor while typing (the server stays the authority when saving and issuing). */
export interface EditorTotals {
  net: number;
  tax: number;
  gross: number;
  rounding: number;
  payable: number;
  cost: number;
  margin: number;
  marginPercent: number | null;
  sectionSubtotals: Record<string, number>;
  lineNet: Record<string, number>;
  /** Running section total shown on each `subtotal` row. */
  runningSubtotal: Record<string, number>;
  taxBreakdown: { rate: number; net: number; tax: number }[];
}

export interface QuoteSummary {
  id: string;
  root_quote_id: string | null;
  parent_quote_id: string | null;
  quote_number: string;
  revision: number;
  status: QuoteStatus;
  jurisdiction: QuoteJurisdiction;
  locale: string;
  contact_id: string | null;
  customer_name: string | null;
  customer_email: string | null;
  currency: 'CHF' | 'EUR';
  valid_until: string | null;
  payment_terms: string | null;
  incoterms: string | null;
  cover_letter: string | null;
  terms_and_conditions: string | null;
  header_discount_percent: string;
  min_margin_percent: string | null;
  requires_approval: boolean;
  auto_convert: boolean;
  signature_level: QuoteSignatureLevel;
  totals: { net: string; tax: string; gross: string; cost: string; margin_percent: string | null };
  issued_at: string | null;
  accepted_at: string | null;
  converted_sales_order_id: string | null;
}

export interface QuoteSectionDto {
  id: string;
  title: string;
  description: string | null;
  page_break_before: boolean;
  discount_percent: string;
  sort_order: number;
}

export interface QuoteLineDto {
  id: string;
  section_id: string | null;
  line_type: QuoteLineType;
  selection_mode: LineSelectionMode;
  alternative_group: string | null;
  is_default_selected: boolean;
  sku: string | null;
  description: string;
  uom: string | null;
  quantity: string;
  unit_price: string;
  unit_cost: string;
  discount_percent: string;
  discount_fixed: string;
  tier_prices: { min_qty: number | string; unit_price: number | string }[] | null;
  tax_rate: string;
  sort_order: number;
}

export interface QuoteDetail extends QuoteSummary {
  sections: QuoteSectionDto[];
  lines: QuoteLineDto[];
}

export interface IssueResult {
  quote: QuoteSummary;
  portal_token: string | null;
  portal_url: string | null;
  pin: string | null;
}

export interface DiffFieldChange {
  from: unknown;
  to: unknown;
}

export interface DiffModified {
  key: string;
  label: string;
  changes: Record<string, DiffFieldChange>;
}

export interface DiffSet {
  added: Record<string, unknown>[];
  removed: Record<string, unknown>[];
  modified: DiffModified[];
}

export interface RevisionDiff {
  from: string;
  to: string;
  sections: DiffSet;
  lines: DiffSet;
  totals: Record<string, { from: string; to: string; delta: string }>;
}

export const EDITABLE_STATUSES: readonly QuoteStatus[] = ['draft', 'pending_approval'];
export const NEW_REVISION_STATUSES: readonly QuoteStatus[] = [
  'sent',
  'viewed',
  'negotiating',
  'rejected',
  'expired',
];
