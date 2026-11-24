export type VatPeriodType = 'monthly' | 'quarterly' | 'semiannual';
export type VatJurisdiction = 'CH' | 'IT';
export type VatSettlementStatus = 'DRAFT' | 'CLOSED' | 'FILED';

export interface VatSettlementRequest {
  period_type: VatPeriodType;
  year: number;
  period: number;
}

export interface VatSettlementPeriod {
  type: VatPeriodType;
  year: number;
  number: number;
  label: string;
  from: string;
  to: string;
}

export interface VatSettlementTotals {
  turnover: string;
  taxable_turnover: string;
  output_vat: string;
  input_vat: string;
  previous_credit: string;
  previous_debit: string;
  interest: string;
  payable: string;
}

/** One journal line behind the VAT figures (invoice drill-down). */
export interface VatDrilldownLine {
  journal_entry_id: string;
  entry_number: string | null;
  posting_date: string;
  document_number: string | null;
  source_document_type: string | null;
  partner_id: string | null;
  taxable: string;
  rate: string | null;
  tax: string;
  treatment: string | null;
}

export interface VatDrilldown {
  sales: VatDrilldownLine[];
  purchases: VatDrilldownLine[];
}

/** A Swiss AFC form box that carries a base, a rate and a tax (Ziffern 303-383). */
export interface SwissBoxRate {
  base: string;
  rate: string;
  tax: string;
}

/** Swiss boxes keyed by Ziffer; most are amounts, the rated ones are objects. */
export type SwissBoxes = Record<string, string | SwissBoxRate | number | null | undefined>;

/** Italian LIPE boxes (VP2-VP14), amounts as decimal strings. */
export type LipeBoxes = Record<string, string | number | null | undefined>;

export interface VatSettlementCalculation {
  jurisdiction: VatJurisdiction;
  period: VatSettlementPeriod;
  regime: string | null;
  basis: string | null;
  totals: VatSettlementTotals;
  payable_amount: string;
  warnings: string[];
  drilldown: VatDrilldown;
  swiss_boxes?: SwissBoxes;
  lipe_boxes?: LipeBoxes;
}

export interface VatSettlementSummary {
  id: string;
  jurisdiction: VatJurisdiction;
  period_type: VatPeriodType;
  period_from: string;
  period_to: string;
  regime: string | null;
  basis: string | null;
  payable_amount: string;
  status: VatSettlementStatus;
  locked_at: string | null;
  filed_at: string | null;
}

export interface VatSettlementRecord extends VatSettlementSummary {
  calculation: VatSettlementCalculation;
}

/** Ziffern shown for Switzerland, in form order. */
export const SWISS_ZIFFERN = [
  '200', '220', '221', '225', '230', '235', '289', '299', '303', '313', '343', '383', '399', '400', '405', '410', '415', '420', '479', '500', '510',
] as const;

/** LIPE boxes shown for Italy, in form order. */
export const LIPE_BOXES = [
  'VP2', 'VP3', 'VP4', 'VP5', 'VP6_due', 'VP6_credit', 'VP7', 'VP8', 'VP9', 'VP10', 'VP11', 'VP12', 'VP13', 'VP14_payable', 'VP14_credit',
] as const;

export type IntegrationSupplyKind = 'goods' | 'services';

export interface GenerateIntegrationPayload {
  supply_kind?: IntegrationSupplyKind;
  date?: string;
  tax_rate?: number;
  vat_nature?: string;
  description?: string;
  notes?: string;
}
