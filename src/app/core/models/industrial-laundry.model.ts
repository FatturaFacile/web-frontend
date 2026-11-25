/**
 * Industrial laundries and linen / workwear rental (Mod 177). Amounts and weights travel as decimal strings; every label
 * (article types, states, programs, findings, rejections, errors) comes from the dictionary served by the API.
 */

export type IlrDecimal = string | number;

export const ILR_ARTICLE_TYPES = [
  'flat_linen',
  'terry_towel',
  'hospital_scrub',
  'personal_workwear_uniform',
  'ppe_safety_garment',
] as const;
export type IlrArticleType = (typeof ILR_ARTICLE_TYPES)[number];

export const ILR_LIFECYCLE_STATES = [
  'clean_in_stock',
  'delivered_to_customer',
  'soiled_returned',
  'in_wash_tunnel',
  'in_mending',
  'condemned_rag',
] as const;
export type IlrLifecycleState = (typeof ILR_LIFECYCLE_STATES)[number];

export const ILR_DIRECTIONS = ['inbound_soil', 'outbound_clean'] as const;
export type IlrDirection = (typeof ILR_DIRECTIONS)[number];

export const ILR_SEGMENTS = ['hotel', 'restaurant', 'clinic', 'rsa', 'industry'] as const;
export type IlrSegment = (typeof ILR_SEGMENTS)[number];

export const ILR_BILLING_MODELS = [
  'per_piece_washed',
  'per_kg_dirty_or_clean',
  'fixed_monthly_rental_per_garment',
  'hybrid_rental_plus_wash',
] as const;
export type IlrBillingModel = (typeof ILR_BILLING_MODELS)[number];

export const ILR_RISK_ZONES = ['standard', 'contaminated', 'protected'] as const;
export type IlrRiskZone = (typeof ILR_RISK_ZONES)[number];

export const ILR_CERTIFICATION_STATUSES = ['pending', 'compliant', 'non_compliant'] as const;
export type IlrCertificationStatus = (typeof ILR_CERTIFICATION_STATUSES)[number];

export const ILR_PPE_ACTIONS = ['replace', 'mend', 'condemn'] as const;
export type IlrPpeAction = (typeof ILR_PPE_ACTIONS)[number];
export type IlrPpeDecision = IlrPpeAction | 'complete_mending';

export type IlrPpeStatus = 'limit_reached' | 'near_limit';

export type IlrBillingLineKind =
  | 'wash_piece'
  | 'wash_kg'
  | 'minimum_top_up'
  | 'rental'
  | 'unreturned';

export type IlrBillingRunStatus = 'drafted' | 'invoiced';

// --- Envelopes ---

export interface IlrEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface IlrPageMeta {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

export interface IlrPage<T> extends IlrEnvelope<T[]> {
  meta: IlrPageMeta;
}

/** RFC 7807 problem of a refused rule: `code` picks the translated text, 422 brings the field errors. */
export interface IlrProblem {
  code?: string;
  detail?: string;
  errors?: Record<string, string[]>;
  params?: Record<string, string | number>;
}

// --- Reference data ---

export interface IlrCustomerRef {
  id: string;
  name: string;
  country: string | null;
}

export interface IlrProgram {
  code: string;
  is_thermal: boolean;
  is_chemical: boolean;
  disinfects: boolean;
  target_temperature_c: IlrDecimal;
  min_hold_minutes: number;
  min_chemical_dosing_ml_per_kg: IlrDecimal | null;
}

export interface IlrLookups {
  enums: Record<string, string[]>;
  nominal_article_types: IlrArticleType[];
  programs: IlrProgram[];
  ppe_standards: string[];
  tax_rates: Record<string, string>;
  defaults: {
    dormant_days: number;
    unreturned_threshold_days: number;
    ppe_warning_ratio: string;
    rabc_max_cfu_per_25cm2: string;
    min_rssi_dbm: number;
  };
  customers: IlrCustomerRef[];
}

// --- Par stock ---

export interface IlrParStockLine {
  article_type: IlrArticleType;
  par_level: number;
  circulating: number;
  at_customer: number;
  in_laundry: number;
  in_mending: number;
  gap: number;
}

export interface IlrBillingTotals {
  wash_amount: IlrDecimal;
  minimum_top_up_amount: IlrDecimal;
  rental_amount: IlrDecimal;
  unreturned_amount: IlrDecimal;
  subtotal: IlrDecimal;
  tax_amount: IlrDecimal;
  total: IlrDecimal;
}

export interface IlrParStockRow {
  contract_id: string;
  contract_code: string;
  customer_id: string;
  customer_name: string | null;
  customer_segment: IlrSegment;
  billing_model: IlrBillingModel;
  currency: string;
  period_start: string;
  period_end: string;
  lines: IlrParStockLine[];
  par_total: number;
  circulating_total: number;
  pieces_delivered: number | null;
  net_kg_dirty: IlrDecimal;
  net_kg_clean: IlrDecimal;
  billing_preview: IlrBillingTotals | null;
}

export interface IlrParStockFilters {
  segment?: IlrSegment;
  customer_id?: string;
  as_of?: string;
  with_preview?: boolean;
}

// --- Garments, dormant, PPE, lockers ---

export interface IlrDormantGarment {
  id: string;
  epc_uid_rfid_hex: string;
  article_type: IlrArticleType;
  assigned_customer_id: string | null;
  customer_name: string | null;
  assigned_wearer_employee_name: string | null;
  last_delivered_at: string;
  dormant_days: number;
  threshold_days: number;
}

export interface IlrDormantFilters {
  customer_id?: string;
  days?: number;
}

export interface IlrPpeAlert {
  id: string;
  epc_uid_rfid_hex: string;
  article_type: IlrArticleType;
  assigned_customer_id: string | null;
  assigned_wearer_employee_name: string | null;
  assigned_locker_code: string | null;
  ppe_certification_standard: string | null;
  ppe_category: number | null;
  wash_cycles_count: number;
  max_certified_wash_cycles_limit: number;
  remaining_washes: number | null;
  current_lifecycle_state: IlrLifecycleState;
  is_reissue_blocked: boolean;
  status: IlrPpeStatus;
}

export interface IlrPpeDecisionPayload {
  action: IlrPpeDecision;
  replacement_epc?: string | null;
  reason?: string | null;
}

export interface IlrLockerGarment {
  id: string;
  epc_uid_rfid_hex: string;
  article_type: IlrArticleType;
  current_lifecycle_state: IlrLifecycleState;
  wash_cycles_count: number;
  max_certified_wash_cycles_limit: number | null;
  is_reissue_blocked: boolean;
}

export interface IlrLockerGroup {
  employee: string;
  locker_code: string | null;
  customer_id: string;
  garments: IlrLockerGarment[];
}

export interface IlrLockerPayload {
  employee_name: string | null;
  locker_code: string | null;
  customer_id?: string | null;
}

export interface IlrGarment {
  id: string;
  epc_uid_rfid_hex: string;
  thermal_barcode: string | null;
  article_type: IlrArticleType;
  description: string | null;
  assigned_customer_id: string | null;
  customer: IlrCustomerRef | null;
  assigned_wearer_employee_name: string | null;
  assigned_locker_code: string | null;
  wash_cycles_count: number;
  max_certified_wash_cycles_limit: number | null;
  remaining_washes: number | null;
  ppe_certification_standard: string | null;
  ppe_category: number | null;
  current_lifecycle_state: IlrLifecycleState;
  is_reissue_blocked: boolean;
  last_delivered_at: string | null;
}

export interface IlrGarmentFilters {
  q?: string;
  state?: IlrLifecycleState;
  article_type?: IlrArticleType;
  customer_id?: string;
  per_page?: number;
  page?: number;
}

// --- Scans ---

export interface IlrScanRead {
  epc: string;
  rssi?: number | null;
  antenna_id?: string | null;
}

export interface IlrScanPayload {
  gate_antenna_id: string;
  roll_cage_barcode: string;
  direction: IlrDirection;
  reads: IlrScanRead[];
  gross_weight_kg?: IlrDecimal | null;
  roll_cage_tare_weight_kg?: IlrDecimal | null;
  contact_id?: string | null;
  external_scan_id?: string | null;
  generate_ddt?: boolean;
}

export interface IlrRejectedRead {
  epc: string;
  reason: string;
  rssi: number | null;
}

export interface IlrAlert {
  code: string;
  severity: 'warning' | 'blocking';
  epc?: string;
  params?: Record<string, string | number | null>;
}

export interface IlrScanSession {
  id: string;
  gate_antenna_id: string;
  roll_cage_barcode: string;
  roll_cage_tare_weight_kg: IlrDecimal;
  gross_weight_kg: IlrDecimal | null;
  net_weight_kg: IlrDecimal | null;
  direction: IlrDirection;
  contact_id: string | null;
  customer: IlrCustomerRef | null;
  accepted_epc_tags: string[];
  rejected_reads: IlrRejectedRead[];
  alerts: IlrAlert[];
  raw_reads_count: number;
  accepted_count: number;
  rejected_count: number;
  generated_ddt_number: string | null;
  scanned_at: string;
}

export interface IlrScanFilters {
  direction?: IlrDirection;
  contact_id?: string;
  from?: string;
  to?: string;
  per_page?: number;
  page?: number;
}

export interface IlrRollCage {
  id: string;
  barcode: string;
  label: string | null;
  tare_weight_kg: IlrDecimal;
  max_gross_weight_kg: IlrDecimal | null;
  is_active: boolean;
}

// --- RABC wash batches ---

export interface IlrViolation {
  code: string;
  severity: 'warning' | 'blocking';
  params: Record<string, string | number | null>;
}

export interface IlrWashBatch {
  id: string;
  batch_code: string;
  disinfection_thermal_chem_program_code: string;
  rabc_risk_zone: IlrRiskZone;
  rabc_control_status: IlrCertificationStatus;
  target_temperature_c: IlrDecimal;
  target_hold_minutes: number;
  target_chemical_dosing_ml_per_kg: IlrDecimal | null;
  measured_temperature_c: IlrDecimal | null;
  measured_hold_minutes: number | null;
  measured_chemical_dosing_ml_per_kg: IlrDecimal | null;
  microbiological_cfu_per_25cm2: IlrDecimal | null;
  load_net_weight_kg: IlrDecimal;
  garments_count: number;
  operator_name: string | null;
  verifier_name: string | null;
  violations: IlrViolation[];
  washed_at: string | null;
  certified_at: string | null;
}

export interface IlrBatchPayload {
  program_code: string;
  rabc_risk_zone: IlrRiskZone;
  scan_session_ids: string[];
  operator_name?: string | null;
  batch_code?: string | null;
}

export interface IlrCertifyPayload {
  measured_temperature_c?: IlrDecimal | null;
  measured_hold_minutes?: number | null;
  measured_chemical_dosing_ml_per_kg?: IlrDecimal | null;
  microbiological_cfu_per_25cm2?: IlrDecimal | null;
  verifier_name: string;
}

// --- Billing ---

export interface IlrParContractRef {
  id: string;
  code: string;
  customer_id: string;
  customer: IlrCustomerRef | null;
  customer_segment: IlrSegment;
  billing_model: IlrBillingModel;
  jurisdiction: 'IT' | 'CH';
  currency: string;
  valid_from: string;
  valid_to: string | null;
  is_active: boolean;
}

export interface IlrBillingLine {
  kind: IlrBillingLineKind;
  article_type: IlrArticleType | null;
  quantity: IlrDecimal;
  uom: string;
  unit_price: IlrDecimal;
  amount: IlrDecimal;
}

export interface IlrComplianceReport {
  returnable_containers?: { out: number; back: number; at_customer: number };
  water_discharge?: { treated_net_kg: IlrDecimal; discharged_litres: IlrDecimal; discharged_m3: IlrDecimal };
  delivery_notes?: string[];
  document?: string;
}

export interface IlrBillingPreview extends IlrBillingTotals {
  lines: IlrBillingLine[];
  washed_pieces: number;
  net_weight_kg: IlrDecimal;
  tax_rate: IlrDecimal;
  document_type: string | null;
  compliance: IlrComplianceReport;
}

export interface IlrBillingRun extends IlrBillingTotals {
  id: string;
  contract_id: string;
  contract_code: string | null;
  customer: IlrCustomerRef | null;
  period_start: string;
  period_end: string;
  status: IlrBillingRunStatus;
  billing_model: IlrBillingModel;
  jurisdiction: 'IT' | 'CH';
  currency: string;
  washed_pieces: number;
  net_weight_kg: IlrDecimal;
  tax_rate: IlrDecimal;
  invoice_id: string | null;
  invoice_number: string | null;
  compliance_report: IlrComplianceReport | null;
  lines: IlrBillingLine[] | null;
}

export interface IlrBillingPayload {
  contract_id: string;
  period_start: string;
  period_end: string;
  create_invoice?: boolean;
}
