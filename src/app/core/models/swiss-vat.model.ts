/** Swiss VAT (MWST / IVA / TVA) accounting method under LIVA/MWSTG/LTVA. */
export type SwissVatMethod = 'effective' | 'saldosteuersatz';

/** Consideration basis (Art. 39 LIVA). */
export type SwissVatConsiderationBasis = 'agreed' | 'received';

/** Periodic reporting frequency. */
export type SwissVatFrequency = 'quarterly' | 'semiannual' | 'monthly';

/** Exempt / zero-rated classification. */
export type SwissVatExemptionType =
  | 'none'
  | 'exempt_with_deduction'
  | 'exempt_without_deduction'
  | 'out_of_scope';

/** Tax code rate category. */
export type SwissVatRateType =
  | 'standard'
  | 'reduced'
  | 'accommodation'
  | 'zero_exempt'
  | 'saldosteuersatz'
  | 'bezugsteuer';

/** Foreign service categories subject to Swiss Bezugsteuer (Art. 45 LIVA). */
export type BezugsteuerCategory =
  | 'software_cloud'
  | 'consulting'
  | 'it_services'
  | 'telecom'
  | 'royalties'
  | 'marketing'
  | 'other_cross_border_service'
  | 'import_service';

export type BezugsteuerStatus = 'detected' | 'confirmed' | 'excluded' | 'declared';

export type InputTaxAdjustmentType =
  | 'autoconsumo'
  | 'degrassazione'
  | 'mixed_use_reduction'
  | 'subsidy_reduction';

export type SwissVatReturnStatus = 'draft' | 'calculated' | 'validated' | 'finalized' | 'submitted';

export interface SwissVatConfig {
  id: string;
  tenant_id: string | null;
  uid_mwst: string | null;
  accounting_method: SwissVatMethod;
  consideration_basis: SwissVatConsiderationBasis;
  reporting_frequency: SwissVatFrequency;
  sss_rate_primary: string | null;
  sss_rate_secondary: string | null;
  sss_sector_primary: string | null;
  sss_sector_secondary: string | null;
  rounding_mode: 'chf_005' | 'standard_001';
  auto_detect_bezugsteuer: boolean;
  bezugsteuer_threshold_chf: string;
  default_currency: string;
  canton: string | null;
  gl_accounts: Record<string, string>;
  updated_at: string | null;
}

export interface UpsertSwissVatConfigPayload {
  uid_mwst: string | null;
  accounting_method: SwissVatMethod;
  consideration_basis: SwissVatConsiderationBasis;
  reporting_frequency: SwissVatFrequency;
  sss_rate_primary?: string | null;
  sss_rate_secondary?: string | null;
  sss_sector_primary?: string | null;
  sss_sector_secondary?: string | null;
  rounding_mode?: 'chf_005' | 'standard_001';
  auto_detect_bezugsteuer?: boolean;
  bezugsteuer_threshold_chf?: string;
  default_currency?: string;
  canton?: string | null;
}

export interface SwissVatTaxCode {
  id: string;
  is_global: boolean;
  code: string;
  name: string;
  description: string | null;
  rate_type: SwissVatRateType;
  exemption_type: SwissVatExemptionType;
  rate_percent: string;
  afc_box: string;
  is_bezugsteuer: boolean;
  is_input_tax_deductible: boolean;
  sss_sector_code: string | null;
  effective_from: string;
  effective_to: string | null;
  is_active: boolean;
}

export interface StoreSwissVatTaxCodePayload {
  code: string;
  name: string;
  description?: string | null;
  rate_type: SwissVatRateType;
  exemption_type?: SwissVatExemptionType;
  rate_percent: number;
  afc_box: string;
  is_bezugsteuer?: boolean;
  is_input_tax_deductible?: boolean;
  sss_sector_code?: string | null;
  effective_from: string;
  effective_to?: string | null;
}

export interface SssSectorRate {
  sector_code: string;
  rate_percent: string;
  label_key: string;
  label: string;
  afc_box: string;
}

export interface BezugsteuerEntry {
  id: string;
  swiss_vat_return_id: string | null;
  source_document_type: string | null;
  source_document_id: string | null;
  supplier_id: string | null;
  supplier_name: string;
  supplier_country: string;
  supplier_vat_number: string | null;
  invoice_number: string | null;
  invoice_date: string;
  service_category: BezugsteuerCategory;
  description: string;
  currency: string;
  original_net_amount: string;
  exchange_rate: string;
  net_amount_chf: string;
  vat_rate_percent: string;
  tax_amount_chf: string;
  deductible_input_tax_chf: string;
  afc_box: string;
  detection_source: 'auto_detected' | 'manual';
  detection_reason: string | null;
  status: BezugsteuerStatus;
  confirmed_at: string | null;
}

export interface StoreBezugsteuerPayload {
  supplier_name: string;
  supplier_country: string;
  supplier_vat_number?: string | null;
  invoice_number?: string | null;
  invoice_date: string;
  service_category?: BezugsteuerCategory;
  description: string;
  currency?: string;
  original_net_amount: number;
  exchange_rate?: number;
  vat_rate_percent?: number;
}

export interface InputTaxAdjustment {
  id: string;
  swiss_vat_return_id: string | null;
  adjustment_type: InputTaxAdjustmentType;
  afc_box: string;
  effective_date: string;
  fiscal_year: number;
  asset_category: 'movable' | 'real_estate' | 'service' | 'general' | null;
  description: string;
  reference_document: string | null;
  original_cost_chf: string | null;
  original_vat_rate: string | null;
  years_elapsed: number | null;
  private_or_exempt_ratio: string | null;
  adjustment_amount_chf: string;
  legal_basis: string;
  status: 'draft' | 'approved' | 'applied';
  notes: string | null;
}

export interface StoreInputTaxAdjustmentPayload {
  adjustment_type: InputTaxAdjustmentType;
  effective_date: string;
  asset_category?: 'movable' | 'real_estate' | 'service' | 'general';
  description: string;
  reference_document?: string | null;
  original_cost_chf?: number | null;
  original_vat_rate?: number | null;
  years_elapsed?: number | null;
  private_or_exempt_ratio?: number | null;
  adjustment_amount_chf?: number | null;
  notes?: string | null;
}

export interface QuadraturaCheck {
  code: string;
  severity: 'blocker' | 'warning';
  passed: boolean;
  expected: string;
  actual: string;
  difference: string;
  message_key: string;
  message: string;
  params: Record<string, string | number | boolean | null>;
}

export interface QuadraturaReport {
  passed: boolean;
  checks: QuadraturaCheck[];
  blockers_count: number;
  warnings_count: number;
  blockers: QuadraturaCheck[];
  warnings: QuadraturaCheck[];
}

export interface AfcBoxLine {
  code: string;
  section: 'turnover' | 'deductions' | 'tax_calculation' | 'input_tax' | 'settlement' | 'other_flows';
  label_key: string;
  label: string;
  amount: string;
  base_amount: string | null;
  rate_percent: string | null;
  tax_amount: string | null;
  source_count: number;
  epoch_box_alias: string | null;
}

export interface SwissVatReturn {
  id: string;
  fiscal_year: number;
  period_type: SwissVatFrequency;
  period_number: number;
  period_label: string;
  period_from: string;
  period_to: string;
  accounting_method: SwissVatMethod;
  consideration_basis: SwissVatConsiderationBasis;
  currency: string;
  status: SwissVatReturnStatus;
  box_200_total_turnover: string;
  box_289_total_deductions: string;
  box_299_taxable_turnover: string;
  box_399_total_output_tax: string;
  box_479_total_input_tax: string;
  box_500_payable_amount: string;
  box_510_credit_amount: string;
  gross_turnover: string;
  invoiced_vat_total: string;
  forfeited_input_vat: string;
  sss_revenue_adjustment: string;
  bezugsteuer_base: string;
  bezugsteuer_tax: string;
  adjustments_box_410: string;
  adjustments_box_415: string;
  adjustments_box_420: string;
  afc_boxes: Record<string, unknown>;
  quadratura_passed: boolean;
  quadratura_report: QuadraturaReport;
  reconciliation_lines: Record<string, unknown>[];
  finalized_at: string | null;
  submitted_at: string | null;
  suissetax_reference: string | null;
}

export interface SwissVatReconciliationReport {
  return_id: string;
  period_label: string;
  accounting_method: SwissVatMethod;
  quadratura_passed: boolean;
  quadratura_report: QuadraturaReport;
  box_schedule: AfcBoxLine[];
  reconciliation_lines: Record<string, unknown>[];
}

export interface SuisseTaxValidationResult {
  valid: boolean;
  xsd_valid: boolean;
  quadratura_passed: boolean;
  schema_version: string;
  xsd_errors: string[];
  business_errors: string[];
  errors: string[];
}

export interface SuisseTaxXmlExport {
  id: string;
  swiss_vat_return_id: string;
  accounting_method: SwissVatMethod;
  period_label: string;
  schema_version: string;
  file_name: string;
  sha256_checksum: string;
  xsd_valid: boolean;
  quadratura_passed: boolean;
  validation_errors: string[];
  exported_at: string;
}

export interface CalculateSwissVatReturnPayload {
  fiscal_year: number;
  period_type?: SwissVatFrequency;
  period_number: number;
  accounting_method?: SwissVatMethod;
  consideration_basis?: SwissVatConsiderationBasis;
}
