/** Models of the bonded warehouse module (Mod 353): customs warehouses (CDU 7100 / OZL), IVA warehouses (Art. 50-bis) and AEO. */

export const BW_REGIME_TYPES = [
  'CDU_Private_7100',
  'Swiss_OZL',
  'Swiss_Zollfreilager_ZE',
  'VatDepot_Art50Bis',
] as const;
export type BwRegimeType = (typeof BW_REGIME_TYPES)[number];

export const BW_WAREHOUSE_SUBTYPES = ['Type_C', 'Type_D', 'Type_E', 'Private'] as const;
export type BwWarehouseSubtype = (typeof BW_WAREHOUSE_SUBTYPES)[number];

export const BW_AEO_STATUSES = ['None', 'AEOC', 'AEOS', 'AEOF'] as const;
export type BwAeoStatus = (typeof BW_AEO_STATUSES)[number];

export const BW_DECLARATION_TYPES = ['IM7', 'Passar_Import', 'T1'] as const;
export type BwDeclarationType = (typeof BW_DECLARATION_TYPES)[number];

export const BW_CUSTOMS_STATUSES = [
  'NonUnion_Suspended',
  'UsualHandling_InProgress',
  'PartiallyDischarged',
  'FullyDischarged',
] as const;
export type BwCustomsStatus = (typeof BW_CUSTOMS_STATUSES)[number];

export const BW_DISCHARGE_TYPES = [
  'IM4_FreeCirculation',
  'EX3_ReExport',
  'Passar_Export',
  'T1_Transit',
  'UsualHandling_Annex71_03',
] as const;
export type BwDischargeType = (typeof BW_DISCHARGE_TYPES)[number];

export const BW_ALLOCATION_METHODS = ['FIFO', 'Specific_MRN'] as const;
export type BwAllocationMethod = (typeof BW_ALLOCATION_METHODS)[number];

export const BW_USUAL_HANDLING_OPERATIONS = [
  'Repacking',
  'Labeling',
  'Kitting',
  'Sorting',
  'Cleaning',
  'Testing',
  'Marking',
] as const;
export type BwUsualHandlingOperation = (typeof BW_USUAL_HANDLING_OPERATIONS)[number];

export const BW_CGU_DIRECTIONS = ['Engage', 'Release'] as const;
export type BwCguDirection = (typeof BW_CGU_DIRECTIONS)[number];

export const BW_VAT_INBOUND_TYPES = [
  'Inbound_FreeCirculation',
  'Inbound_IntraEU',
  'Internal_Transfer_NoVAT',
] as const;
export const BW_VAT_EXTRACTION_TYPES = [
  'Extraction_TD22',
  'Extraction_TD23',
  'Extraction_LetterOfIntent',
] as const;
export const BW_VAT_MOVEMENT_TYPES = [...BW_VAT_INBOUND_TYPES, ...BW_VAT_EXTRACTION_TYPES] as const;
export type BwVatMovementType = (typeof BW_VAT_MOVEMENT_TYPES)[number];
export type BwVatInboundType = (typeof BW_VAT_INBOUND_TYPES)[number];
export type BwVatExtractionType = (typeof BW_VAT_EXTRACTION_TYPES)[number];

export const BW_AUDIT_TYPES = [
  'Physical_Book_Reconciliation',
  'Security_Partner_Check',
  'Usual_Handling_Verification',
  'CGU_Threshold_Check',
] as const;
export type BwAuditType = (typeof BW_AUDIT_TYPES)[number];

export const BW_DISCREPANCY_STATUSES = [
  'Matched',
  'Minor_Variance',
  'Critical_Alert_ADM_UDSC',
] as const;
export type BwDiscrepancyStatus = (typeof BW_DISCREPANCY_STATUSES)[number];

export const BW_CURRENCIES = ['EUR', 'CHF'] as const;
export type BwCurrency = (typeof BW_CURRENCIES)[number];

/** Error codes of the API (`bondedWarehouses.error.<code>`). */
export const BW_ERROR_CODES = [
  'record_immutable',
  'authorization_not_found',
  'authorization_inactive',
  'regime_not_customs_warehouse',
  'regime_not_vat_depot',
  'declaration_type_not_allowed',
  'invalid_mrn',
  'invalid_discharge_mrn',
  'invalid_taric',
  'mrn_already_registered',
  'cgu_ceiling_exceeded',
  'cgu_release_exceeds_utilized',
  'ceiling_below_utilized',
  'authorization_in_use',
  'quantity_must_be_positive',
  'insufficient_remaining_quantity',
  'insufficient_remaining_weight',
  'lot_not_found',
  'discharge_before_entry',
  'usual_handling_code_required',
  'fifo_needs_product_and_quantity',
  'movement_not_inbound',
  'movement_not_extraction',
  'negative_value',
  'f24_required',
  'f24_not_allowed',
  'insufficient_depot_stock',
  'self_contact_missing',
  'unknown_dataset',
  'unknown',
] as const;

export interface BwEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
  meta?: BwPageMeta;
}

export interface BwPageMeta {
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
}

/** RFC 7807 problem of a refusal: the `code` picks the translation. */
export interface BwProblem {
  title?: string;
  detail?: string;
  code?: string;
  context?: Record<string, string | number | null>;
  errors?: Record<string, string[]>;
}

export interface BwAuthorization {
  id: string;
  warehouse_id: string;
  authorization_code: string;
  customs_office_code: string;
  regime_type: BwRegimeType;
  warehouse_subtype: BwWarehouseSubtype;
  cgu_guarantee_reference: string | null;
  cgu_max_ceiling_amount: string;
  cgu_utilized_amount: string;
  cgu_available_amount: string;
  cgu_utilization_percent: number;
  currency: BwCurrency;
  aeo_certificate_number: string | null;
  aeo_status: BwAeoStatus;
  aeo_next_audit_date: string | null;
  valid_from: string;
  valid_to: string | null;
  is_active: boolean;
}

export interface BwAuthorizationPayload {
  warehouse_id: string;
  authorization_code: string;
  customs_office_code: string;
  regime_type: BwRegimeType;
  warehouse_subtype: BwWarehouseSubtype;
  cgu_guarantee_reference: string | null;
  cgu_max_ceiling_amount: number;
  currency: BwCurrency;
  aeo_certificate_number: string | null;
  aeo_status: BwAeoStatus;
  aeo_next_audit_date: string | null;
  valid_from: string;
  valid_to: string | null;
  is_active: boolean;
}

export interface BwDischargeMovement {
  id: string;
  authorization_id: string;
  mrn_lot_id: string;
  discharge_type: BwDischargeType;
  discharge_mrn_number: string | null;
  discharge_date: string;
  allocation_method: BwAllocationMethod;
  discharged_quantity: string;
  discharged_net_weight_kg: string;
  released_customs_value: string;
  paid_duty_amount: string;
  paid_vat_amount: string;
  extinguished_duty_amount: string;
  extinguished_vat_amount: string;
  cgu_released_amount: string;
  usual_handling_code: BwUsualHandlingOperation | null;
  usual_handling_notes: string | null;
  customs_prospectus_document_id: string | null;
}

export interface BwMrnLot {
  id: string;
  authorization_id: string;
  authorization_code?: string;
  regime_type?: BwRegimeType;
  currency?: BwCurrency;
  mrn_number: string;
  mrn_item_number: number;
  declaration_type: BwDeclarationType;
  entry_date: string;
  product_id: string;
  wms_lot_id: string | null;
  taric_hs_code: string;
  country_of_origin: string;
  preferential_origin: boolean;
  preferential_agreement_code: string | null;
  initial_quantity: string;
  remaining_quantity: string;
  unit_of_measure: string;
  initial_net_weight_kg: string;
  remaining_net_weight_kg: string;
  initial_gross_weight_kg: string;
  remaining_gross_weight_kg: string;
  customs_statistical_value: string;
  duty_rate_percent: string;
  vat_rate_percent: string;
  suspended_duty_amount: string;
  suspended_vat_amount: string;
  cgu_engaged_amount: string;
  customs_status: BwCustomsStatus;
  discharges?: BwDischargeMovement[];
}

export interface BwMrnLotFilters {
  mrn?: string;
  taric?: string;
  regime_type?: BwRegimeType | null;
  origin?: string;
  status?: BwCustomsStatus | null;
  authorization_id?: string | null;
  product_id?: string | null;
  has_balance?: boolean;
  page?: number;
  per_page?: number;
}

export interface BwInboundMrnPayload {
  authorization_id: string;
  mrn_number: string;
  mrn_item_number: number;
  declaration_type: BwDeclarationType;
  entry_date: string;
  product_id: string;
  wms_lot_id: string | null;
  taric_hs_code: string;
  country_of_origin: string;
  preferential_origin: boolean;
  preferential_agreement_code: string | null;
  initial_quantity: number;
  unit_of_measure: string;
  initial_net_weight_kg: number;
  initial_gross_weight_kg: number | null;
  customs_statistical_value: number;
  duty_rate_percent: number;
  vat_rate_percent: number;
}

export interface BwDischargeAllocation {
  mrn_lot_id: string;
  quantity: number;
  net_weight_kg?: number | null;
}

export interface BwDischargePayload {
  authorization_id: string;
  discharge_type: BwDischargeType;
  allocation_method: BwAllocationMethod;
  discharge_date: string;
  product_id?: string | null;
  quantity?: number | null;
  allocations?: BwDischargeAllocation[];
  discharge_mrn_number?: string | null;
  usual_handling_code?: BwUsualHandlingOperation | null;
  usual_handling_notes?: string | null;
  customs_prospectus_document_id?: string | null;
}

export interface BwDischargeLine {
  mrn_lot_id: string;
  mrn_number: string;
  mrn_item_number: number;
  taric_hs_code: string;
  country_of_origin: string;
  entry_date: string;
  quantity: number;
  net_weight_kg: number;
  remaining_quantity_after: number;
  released_customs_value: number;
  duty_amount: number;
  vat_amount: number;
  paid_duty_amount: number;
  paid_vat_amount: number;
  extinguished_duty_amount: number;
  extinguished_vat_amount: number;
  cgu_release_amount: number;
}

export interface BwDischargeSummary {
  authorization_id: string;
  authorization_code: string;
  customs_office_code: string;
  discharge_type: BwDischargeType;
  allocation_method: BwAllocationMethod;
  discharge_date: string;
  discharge_mrn_number: string | null;
  currency: BwCurrency;
  total_quantity: number;
  total_net_weight_kg: number;
  total_customs_value: number;
  total_duty_due: number;
  total_vat_due: number;
  total_duty_extinguished: number;
  total_vat_extinguished: number;
  total_cgu_released: number;
  customs_debt_arises: boolean;
  lots: number;
}

export interface BwDischargePlan {
  simulated: boolean;
  lines: BwDischargeLine[];
  summary: BwDischargeSummary;
  movement_ids: string[];
}

export interface BwPlafondRow {
  authorization_id: string;
  authorization_code: string;
  regime_type: BwRegimeType;
  currency: BwCurrency;
  cgu_guarantee_reference: string | null;
  ceiling: string;
  utilized: string;
  available: string;
  utilization_percent: number;
  is_active: boolean;
}

export interface BwCguLedgerEntry {
  id: string;
  authorization_id: string;
  reference_type: string;
  reference_id: string | null;
  movement_direction: BwCguDirection;
  duty_amount: string;
  vat_amount: string;
  total_cgu_delta: string;
  running_utilized_balance: string;
  remaining_plafond: string;
  recorded_at: string;
}

export interface BwCguMoney {
  currency: BwCurrency;
  ceiling: string;
  utilized: string;
  available: string;
  utilization_percent: number;
}

export interface BwOverview {
  authorizations: { total: number; active: number };
  cgu: BwCguMoney[];
  expiring_authorizations: {
    authorization_id: string;
    authorization_code: string;
    valid_to: string;
  }[];
  open_lots: number;
  usual_handling_in_progress: number;
  aeo_compliance_score: number;
  plafond: BwPlafondRow[];
}

export interface BwVatRegisterEntry {
  id: string;
  authorization_id: string;
  register_progressive_number: number;
  movement_type: BwVatMovementType;
  movement_date: string;
  product_id: string;
  lot_reference: string | null;
  quantity: string;
  base_goods_value: string;
  storage_and_processing_services_value: string;
  total_taxable_extraction_base: string;
  vat_rate_percent: string;
  vat_amount: string;
  self_invoice_id: string | null;
  sdi_document_type: 'TD22' | 'TD23' | 'None';
  f24_payment_reference: string | null;
  f24_payment_date: string | null;
  notes: string | null;
}

export interface BwVatInboundPayload {
  authorization_id: string;
  movement_type: BwVatInboundType;
  movement_date: string;
  product_id: string;
  lot_reference: string | null;
  quantity: number;
  base_goods_value: number;
  notes: string | null;
}

export interface BwVatExtractionPayload {
  authorization_id: string;
  movement_type: BwVatExtractionType;
  movement_date: string;
  product_id: string;
  lot_reference: string | null;
  quantity: number;
  base_goods_value: number;
  storage_and_processing_services_value: number;
  vat_rate_percent: number;
  f24_payment_reference?: string | null;
  f24_payment_date?: string | null;
  self_contact_id?: string | null;
  notes?: string | null;
}

export interface BwExtractionPreview {
  total_taxable_extraction_base: number;
  vat_rate_percent: number;
  vat_amount: number;
  total_with_vat: number;
  sdi_document_type: 'TD22' | 'TD23' | 'None';
  available_quantity: number;
  sufficient_stock: boolean;
  requires_f24: boolean;
}

export interface BwVatFilters {
  authorization_id?: string | null;
  movement_type?: BwVatMovementType | null;
  date_from?: string | null;
  date_to?: string | null;
  page?: number;
  per_page?: number;
}

export interface BwAeoAudit {
  id: string;
  authorization_id: string;
  audit_type: BwAuditType;
  audit_date: string;
  mrn_lot_id: string | null;
  product_id: string | null;
  wms_physical_quantity: string;
  customs_ledger_quantity: string;
  discrepancy_quantity: string;
  discrepancy_status: BwDiscrepancyStatus;
  partner_or_carrier_name: string | null;
  partner_aeo_status: BwAeoStatus | null;
  security_seal_verified: boolean;
  findings: string | null;
  corrective_action: string | null;
}

export interface BwAeoDashboard {
  score: number;
  audits_last_90_days: number;
  matched: number;
  minor: number;
  critical: number;
  certified_authorizations: {
    authorization_id: string;
    authorization_code: string;
    aeo_status: BwAeoStatus;
    aeo_certificate_number: string | null;
    aeo_next_audit_date: string | null;
    audit_overdue: boolean;
  }[];
}

export interface BwPartnerCheck {
  partner_or_carrier_name: string;
  partner_aeo_status: BwAeoStatus;
  security_seal_verified: boolean;
  findings?: string | null;
  corrective_action?: string | null;
}

export interface BwReconciliationPayload {
  authorization_id: string;
  audit_date?: string;
  partner_checks?: BwPartnerCheck[];
}

export interface BwReconciliationResult {
  audits: BwAeoAudit[];
  critical: number;
  minor: number;
  matched: number;
  cgu_utilization_percent: number;
}

export interface BwAuditFilters {
  authorization_id?: string | null;
  audit_type?: BwAuditType | null;
  discrepancy_status?: BwDiscrepancyStatus | null;
  page?: number;
  per_page?: number;
}

export type BwExportDataset = 'mrn-lots' | 'cgu-ledger' | 'vat-register' | 'aeo-audits';
export type BwExportFormat = 'csv' | 'pdf';
