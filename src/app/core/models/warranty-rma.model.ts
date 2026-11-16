import { LaravelPaginationMeta } from './api.models';
import { Jurisdiction } from './invoice.model';

/**
 * Warranty, equipment passport and RMA depot-repair contract (ESM module 17, GH-396).
 * The ESM endpoints answer `{ data, meta }` for reads and `{ message, data }` for writes,
 * without the `success` flag of `ApiResponse`.
 */
export interface EsmEnvelope<T> {
  data: T;
  message?: string;
  meta?: Record<string, unknown>;
}

export interface EsmPaginated<T> {
  data: T[];
  meta: LaravelPaginationMeta;
}

/** Error body of the ESM endpoints (`code` is the machine-readable reason). */
export interface EsmErrorBody {
  message: string;
  code?: string;
  errors?: Record<string, string[]>;
  stock_hint?: StockHint | null;
}

export type RmaStatus =
  | 'awaiting_arrival'
  | 'in_diagnosis'
  | 'awaiting_estimate_approval'
  | 'awaiting_parts'
  | 'in_repair_testing'
  | 'ready_for_return'
  | 'returned'
  | 'closed'
  | 'cancelled';

export type WarrantyStatus = 'covered_in_warranty' | 'out_of_warranty_billable' | 'goodwill';

export type EstimateApprovalStatus =
  | 'not_required'
  | 'auto_approved_under_threshold'
  | 'pending_customer_approval'
  | 'approved'
  | 'declined_return_unrepaired';

export type WarrantyPolicyType =
  'statutory_ch_24m' | 'statutory_it_b2c_24m' | 'statutory_it_b2b_12m' | 'extended_care_pack';

export type WarrantySource = 'statutory' | 'contract_clause' | 'extension';

export type VendorClaimStatus =
  | 'draft'
  | 'submitted'
  | 'acknowledged'
  | 'approved_credit_note'
  | 'approved_replacement'
  | 'rejected'
  | 'closed';

export type LoanerRegisterType = 'prestito_uso' | 'conto_riparazione';
export type LoanerStatus = 'issued' | 'returned' | 'lost';
export type DdtCausale =
  'conto_riparazione' | 'prestito_uso' | 'reso_riparato' | 'sostituzione_garanzia';
export type CustomerType = 'b2b' | 'b2c';
export type ComponentSource = 'as_built' | 'as_maintained';
export type RmaLineType = 'part' | 'labour';
export type RmaChargedTo = 'customer' | 'warranty_provision';
export type RepairOutcome = 'repaired' | 'returned_unrepaired' | 'replaced';
export type EstimateDecidedVia = 'public_link' | 'staff' | 'auto';
export type ActorType = 'user' | 'customer' | 'system';

export interface CustomerRef {
  id: string;
  name: string;
  country?: string;
}

export interface EquipmentComponent {
  id: string;
  position: string;
  component_serial: string;
  component_product_id: string | null;
  role: string | null;
  source: ComponentSource;
  installed_at: string | null;
  removed_at: string | null;
  replaced_by_component_id: string | null;
  rma_order_id: string | null;
}

export interface WarrantyExtension {
  id: string;
  name: string;
  months: number;
  starts_at: string;
  ends_at: string;
  reference: string | null;
}

export interface EquipmentPassport {
  id: string;
  serial_number: string;
  stock_serial_number_id: string | null;
  product_id: string | null;
  current_owner_customer_id: string;
  customer: CustomerRef | null;
  original_sales_invoice_id: string | null;
  customer_type: CustomerType;
  jurisdiction: Jurisdiction;
  delivery_date: string;
  warranty_policy_type: WarrantyPolicyType;
  warranty_start_date: string;
  warranty_expiry_date: string;
  warranty_source: WarrantySource;
  contract_warranty_months: number | null;
  contract_clause_reference: string | null;
  installed_firmware_version: string | null;
  extensions: WarrantyExtension[];
  components: EquipmentComponent[];
  created_at: string;
  updated_at: string;
}

export interface GenealogyHistoryEntry {
  rma_order_id: string | null;
  replaced_component_id: string | null;
  new_component_id: string | null;
  at: string;
}

export interface PassportGenealogy {
  as_built: EquipmentComponent[];
  as_maintained: EquipmentComponent[];
  history: GenealogyHistoryEntry[];
}

export interface WarrantyBasis {
  jurisdiction: Jurisdiction;
  customer_type: CustomerType;
  months: number;
  source: WarrantySource;
}

export interface WarrantyEvaluation {
  status: 'in_warranty' | 'out_of_warranty';
  start_date: string;
  expiry_date: string;
  days_remaining: number;
  policy_type: WarrantyPolicyType;
  basis: WarrantyBasis;
}

export interface RmaHistoryItem {
  id: string;
  rma_number: string;
  status: RmaStatus;
  created_at: string;
}

export interface StockHint {
  stock_serial_number_id: string;
  serial_number?: string;
  product_id?: string | null;
  [key: string]: unknown;
}

export interface SerialLookupResult {
  passport: EquipmentPassport;
  warranty: WarrantyEvaluation;
  rma_history: RmaHistoryItem[];
  stock_hint: StockHint | null;
}

export interface RmaEstimate {
  labour_total: string;
  parts_total: string;
  total: string;
  currency: string;
  preauthorized_threshold: string;
  approval_status: EstimateApprovalStatus;
  decided_at: string | null;
  decided_via: EstimateDecidedVia | null;
  expires_at: string | null;
}

export interface RmaLine {
  id: string;
  line_type: RmaLineType;
  product_id: string | null;
  description: string;
  qty: string;
  unit_cost: string;
  unit_price: string;
  charged_to: RmaChargedTo;
  defective_part_serial: string | null;
  supplier_id: string | null;
  replacement_part_serial: string | null;
}

export interface RmaDdt {
  causale_outbound: DdtCausale | null;
  causale_return: DdtCausale | null;
  is_non_ownership_transfer: boolean;
  vat_exempt_art15_dpr633: boolean;
}

export interface RmaStatusHistoryEntry {
  from: RmaStatus | null;
  to: RmaStatus;
  actor_type: ActorType;
  at: string;
  note: string | null;
}

export interface ReceiptPhoto {
  url?: string;
  asset_id?: string;
  caption?: string | null;
}

export interface Loaner {
  id: string;
  rma_order_id: string;
  loaner_serial_number: string;
  loaner_stock_serial_number_id: string | null;
  loaner_product_id: string | null;
  customer_id: string;
  register_type: LoanerRegisterType;
  issued_at: string;
  expected_return_at: string | null;
  returned_at: string | null;
  status: LoanerStatus;
  ddt_causale: DdtCausale | null;
  is_overdue: boolean;
  days_outstanding: number;
  overdue_alerted_at?: string | null;
  notes?: string | null;
}

export interface VendorClaim {
  id: string;
  rma_order_id: string;
  rma_number: string;
  original_supplier_id: string;
  supplier: { id: string; name: string } | null;
  defective_part_serial: string;
  defective_product_id: string | null;
  supplier_rma_reference: string | null;
  status: VendorClaimStatus;
  claimed_amount: string | null;
  credit_note_reference: string | null;
  resolved_at: string | null;
  notes: string | null;
  currency?: string | null;
}

export interface RmaOrder {
  id: string;
  rma_number: string;
  status: RmaStatus;
  warranty_status: WarrantyStatus;
  equipment_passport_id: string;
  serial_number: string;
  customer_id: string;
  customer: CustomerRef | null;
  reported_symptom: string;
  received_at: string | null;
  receipt_condition_notes: string | null;
  receipt_photos: ReceiptPhoto[];
  lab_bench_diagnostic_notes: string | null;
  estimate: RmaEstimate;
  lines: RmaLine[];
  loaner: Loaner | null;
  ddt: RmaDdt;
  repair_outcome: RepairOutcome | null;
  vendor_claims: VendorClaim[];
  history: RmaStatusHistoryEntry[];
  returned_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
  warranty_evaluated_at?: string | null;
  warranty_basis?: WarrantyEvaluation | null;
  diagnosed_at?: string | null;
  repair_test_notes?: string | null;
  cancelled_at?: string | null;
  cancellation_reason?: string | null;
}

/** Shipping label data. Raw `tracking_token`/`tracking_url` are only present once, right after issue. */
export interface RmaLabel {
  rma_number: string;
  serial_number: string;
  product_name: string | null;
  customer_name: string | null;
  return_address: string | null;
  barcode_payload: string;
  tracking_url?: string | null;
  tracking_token?: string | null;
}

/** `POST /rma-orders` response: the RMA plus its label. */
export interface RmaIssueResult extends RmaOrder {
  label?: RmaLabel;
}

/** Transition responses that may carry a once-only estimate link. */
export interface RmaWithEstimateLink extends RmaOrder {
  estimate_url?: string | null;
  estimate_token?: string | null;
}

export interface RmaBoardItem {
  id: string;
  rma_number: string;
  serial_number: string;
  customer_name: string | null;
  warranty_status: WarrantyStatus;
  estimate_approval_status: EstimateApprovalStatus | null;
  age_days: number;
  has_loaner: boolean;
  loaner_overdue: boolean;
}

export interface RmaBoardColumn {
  status: RmaStatus;
  label: string;
  count: number;
  items: RmaBoardItem[];
}

export interface RmaBoard {
  columns: RmaBoardColumn[];
}

export interface RmaBoardFilters {
  warranty_status?: WarrantyStatus | null;
  customer_id?: string | null;
  include_closed?: 0 | 1;
}

export interface PassportListFilters {
  serial_number?: string | null;
  customer_id?: string | null;
  jurisdiction?: Jurisdiction | null;
  warranty?: 'in' | 'out' | null;
  page?: number;
}

export interface RmaListFilters {
  status?: RmaStatus | null;
  warranty_status?: WarrantyStatus | null;
  customer_id?: string | null;
  serial_number?: string | null;
  search?: string | null;
  page?: number;
}

export interface LoanerListFilters {
  status?: LoanerStatus | null;
  register_type?: LoanerRegisterType | null;
  overdue?: 0 | 1 | null;
  page?: number;
}

export interface VendorClaimListFilters {
  status?: VendorClaimStatus | null;
  supplier_id?: string | null;
  rma_order_id?: string | null;
  page?: number;
}

// --- Request payloads ---

export interface PassportComponentPayload {
  position: string;
  component_serial: string;
  component_product_id?: string | null;
  role?: string | null;
}

export interface CreatePassportPayload {
  serial_number: string;
  stock_serial_number_id?: string | null;
  product_id?: string | null;
  current_owner_customer_id: string;
  original_sales_invoice_id?: string | null;
  customer_type?: CustomerType | null;
  jurisdiction?: Jurisdiction | null;
  delivery_date: string;
  contract_warranty_months?: number | null;
  contract_clause_reference?: string | null;
  installed_firmware_version?: string | null;
  components?: PassportComponentPayload[];
}

export interface UpdatePassportPayload {
  current_owner_customer_id?: string;
  installed_firmware_version?: string | null;
  contract_warranty_months?: number | null;
  contract_clause_reference?: string | null;
}

export interface AddExtensionPayload {
  name: string;
  months: number;
  starts_at: string;
  reference?: string | null;
  price?: number | null;
}

export interface IssueRmaPayload {
  serial_number?: string;
  equipment_passport_id?: string;
  reported_symptom: string;
  preauthorized_threshold?: number | null;
  ddt_causale_outbound?: DdtCausale | null;
  goodwill?: boolean;
}

export interface ReceiveRmaPayload {
  received_at?: string | null;
  receipt_condition_notes?: string | null;
  receipt_photos?: ReceiptPhoto[];
}

export interface DiagnosisLinePayload {
  line_type: RmaLineType;
  product_id?: string | null;
  description: string;
  qty: number;
  unit_cost: number;
  unit_price: number;
  defective_part_serial?: string | null;
  supplier_id?: string | null;
  replacement_part_serial?: string | null;
}

export interface DiagnosisPayload {
  lab_bench_diagnostic_notes: string;
  repair_feasible: boolean;
  parts_available?: boolean;
  lines: DiagnosisLinePayload[];
  goodwill?: boolean;
}

export interface ReplacedComponentPayload {
  old_component_id: string;
  new_component_serial: string;
  component_product_id?: string | null;
}

export interface CompleteRepairPayload {
  replaced_components?: ReplacedComponentPayload[];
  installed_firmware_version?: string | null;
  test_notes?: string | null;
}

export interface ReturnRmaPayload {
  returned_at?: string | null;
  ddt_causale_return?: DdtCausale | null;
  vat_exempt_art15_dpr633?: boolean;
}

export interface NotePayload {
  note?: string | null;
}

export interface CancelRmaPayload {
  reason: string;
}

export interface IssueLoanerPayload {
  loaner_serial_number?: string | null;
  loaner_stock_serial_number_id?: string | null;
  register_type: LoanerRegisterType;
  issued_at?: string | null;
  expected_return_at?: string | null;
  ddt_causale?: DdtCausale | null;
}

export interface ReturnLoanerPayload {
  returned_at?: string | null;
}

export interface PatchVendorClaimPayload {
  supplier_rma_reference?: string | null;
  notes?: string | null;
  claimed_amount?: number | null;
}

export interface VendorClaimTransitionPayload {
  to: VendorClaimStatus;
  credit_note_reference?: string | null;
  note?: string | null;
}

// --- Public (unauthenticated) contract ---

export interface PublicEstimateLine {
  description: string;
  qty: string;
  unit_price: string;
  total_price: string;
}

export type PublicEstimateDecision = 'approved' | 'declined';

export interface PublicEstimate {
  rma_number: string;
  status: RmaStatus;
  serial_number: string;
  product_name: string | null;
  reported_symptom: string | null;
  diagnosis_summary: string | null;
  warranty_status: WarrantyStatus;
  lines: PublicEstimateLine[];
  labour_total: string;
  parts_total: string;
  total: string;
  currency: string;
  decision: PublicEstimateDecision | null;
  expires_at: string | null;
  company_name: string | null;
}

export interface PublicEstimateDecisionResult {
  decision: PublicEstimateDecision;
  status: RmaStatus;
}

export interface AcceptEstimatePayload {
  accepted_by_name: string;
}

export interface DeclineEstimatePayload {
  declined_by_name: string;
  reason?: string | null;
}

export interface PublicTrackingStep {
  status: RmaStatus;
  label: string;
  reached_at: string | null;
  current: boolean;
}

export interface PublicTracking {
  rma_number: string;
  status: RmaStatus;
  status_label: string;
  steps: PublicTrackingStep[];
  estimate_pending: boolean;
  estimate_url: string | null;
  updated_at: string;
}
