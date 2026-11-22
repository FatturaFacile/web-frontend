/** Field Service Management (`/api/v1/fsm`, backend `Modules\ServiceManagement`): dispatcher board, work orders, contracts, reports, equipment. */

export interface FsmEnvelope<T> {
  data: T;
}

export const FSM_WORK_ORDER_TYPES = ['preventive', 'corrective', 'installation', 'warranty'] as const;
export type FsmWorkOrderType = (typeof FSM_WORK_ORDER_TYPES)[number];

export const FSM_PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;
export type FsmPriority = (typeof FSM_PRIORITIES)[number];

/** Lifecycle of a work order (`draft` and `scheduled`/`in_progress` are legacy values the board still returns). */
export const FSM_WORK_ORDER_STATUSES = [
  'unscheduled',
  'dispatched',
  'en_route',
  'on_site',
  'completed',
  'invoiced',
  'cancelled',
] as const;
export type FsmWorkOrderStatus = (typeof FSM_WORK_ORDER_STATUSES)[number];

export interface FsmSite {
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
}

export interface FsmRequiredPart {
  product_id: string;
  quantity: number | string;
}

export interface FsmWorkOrder {
  id: string;
  work_order_number: string;
  work_order_type: FsmWorkOrderType;
  status: FsmWorkOrderStatus;
  priority: FsmPriority;
  title: string;
  problem_description: string | null;
  customer_id: string | null;
  equipment_passport_id: string | null;
  service_contract_id: string | null;
  assigned_technician_id: string | null;
  required_skills: string[];
  required_parts: FsmRequiredPart[];
  scheduled_start: string | null;
  scheduled_end: string | null;
  actual_arrival: string | null;
  actual_completion: string | null;
  site: FsmSite | null;
  client_uuid: string | null;
  invoice_id: string | null;
}

export interface FsmWorkOrderPart {
  id: string;
  product_id: string;
  description: string;
  quantity: string;
  unit_price: string;
  /** True when warranty or the maintenance contract covers the line: it is charged 0.00. */
  covered: boolean;
  warehouse_id: string | null;
  stock_movement_id: string | null;
}

export interface FsmChecklistItem {
  item: string;
  result: 'pass' | 'fail' | 'na';
  notes?: string | null;
}

export type FsmBillingLineKind = 'labor' | 'travel' | 'callout' | 'part';

/** Priced line of a report; covered lines keep their list amount but are charged 0.00. */
export interface FsmBillingLine {
  kind: FsmBillingLineKind;
  description: string;
  quantity: string;
  unit_price: string;
  list_amount: string;
  charged_amount: string;
  covered: boolean;
  product_id: string | null;
}

export interface FsmServiceReportBilling {
  lines: FsmBillingLine[];
  billable_total: string;
  covered_total: string;
  currency: string;
}

export interface FsmServiceReport {
  id: string;
  work_order_id: string;
  report_number: string;
  work_performed_summary: string;
  checklist: FsmChecklistItem[];
  labor_hours: string;
  travel_hours: string;
  travel_km: string;
  apply_callout_fee: boolean;
  meter_reading_hours: string | null;
  meter_reading_cycles: number | null;
  customer_signer_name: string;
  customer_signer_role: string | null;
  signature_svg: string | null;
  signature_sha256_hash: string;
  signature_intact: boolean;
  signed_at: string;
  gps_latitude: number | string | null;
  gps_longitude: number | string | null;
  photos: { path: string; name?: string | null; taken_at?: string | null }[];
  locale: string;
  has_pdf: boolean;
  emailed_at: string | null;
  invoice_id: string | null;
  billing: FsmServiceReportBilling;
}

export interface FsmWorkOrderDetail extends FsmWorkOrder {
  parts: FsmWorkOrderPart[];
  service_report: FsmServiceReport | null;
}

export interface FsmWorkOrderListParams {
  status?: FsmWorkOrderStatus | '';
  work_order_type?: FsmWorkOrderType | '';
}

export interface FsmWorkOrderPayload {
  client_uuid?: string | null;
  work_order_type: FsmWorkOrderType;
  customer_id: string;
  title: string;
  problem_description?: string | null;
  priority?: FsmPriority | null;
  equipment_passport_id?: string | null;
  service_contract_id?: string | null;
  site_address?: string | null;
  site_latitude?: number | null;
  site_longitude?: number | null;
  required_skills?: string[];
  required_parts?: { product_id: string; quantity: number }[];
  internal_notes?: string | null;
}

export interface FsmDispatchPayload {
  technician_id: string;
  scheduled_start: string;
  scheduled_end: string;
}

export interface FsmAdvanceStatusPayload {
  status: 'en_route' | 'on_site';
  at?: string | null;
}

export interface FsmRecordPartPayload {
  client_uuid?: string | null;
  product_id: string;
  quantity: number;
  unit_price?: number | null;
  lot_number?: string | null;
}

export interface FsmRecordedPart {
  id: string;
  covered: boolean;
  unit_price: string;
  stock_movement_id: string | null;
}

export interface FsmInvoicePayload {
  tax_rate: number;
  due_date?: string | null;
  revenue_account_id?: string | null;
}

export interface FsmInvoiceResult {
  invoice_id: string;
}

/** Board status of a block: raw work order status as the board returns it. */
export type FsmBoardStatus = FsmWorkOrderStatus | 'draft' | 'scheduled' | 'in_progress';

export interface FsmBoardSite {
  address: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface FsmBoardBlock {
  work_order_id: string;
  work_order_number: string;
  title: string;
  work_type: string;
  work_order_type?: FsmWorkOrderType;
  customer_id?: string | null;
  service_contract_id?: string | null;
  equipment_passport_id?: string | null;
  assigned_technician_id?: string | null;
  priority: string;
  status: FsmBoardStatus;
  scheduled_start: string | null;
  scheduled_end: string | null;
  site: FsmBoardSite;
}

export interface FsmBoardUnassigned extends FsmBoardBlock {
  required_skills: string[];
  required_parts: FsmRequiredPart[];
}

export interface FsmBoardVan {
  warehouse_id: string | null;
  ready: boolean;
  distinct_products_in_stock: number;
  /** product id => available quantity (empty object or array when the van holds nothing). */
  stock?: Record<string, number> | unknown[];
}

export interface FsmBoardLane {
  technician_id: string;
  name: string;
  is_available: boolean;
  skills: string[];
  van: FsmBoardVan;
  blocks: FsmBoardBlock[];
}

export interface FsmBoard {
  window: { from: string; to: string };
  unassigned: FsmBoardUnassigned[];
  lanes: FsmBoardLane[];
}

export interface FsmBoardParams {
  from?: string;
  to?: string;
}

/** Blockers of a rejected dispatch, keyed by `schedule`, `skills`, `van_stock`, `technician`, `hse`. */
export type FsmDispatchBlockers = Record<string, string[]>;

export const FSM_CONTRACT_STATUSES = ['draft', 'active', 'suspended', 'expired', 'cancelled'] as const;
export type FsmContractStatus = (typeof FSM_CONTRACT_STATUSES)[number];

export const FSM_COVERAGE_TYPES = ['labor_only', 'parts_and_labor', 'preventive_only', 'full_comprehensive'] as const;
export type FsmCoverageType = (typeof FSM_COVERAGE_TYPES)[number];

export const FSM_CALENDAR_UNITS = ['day', 'week', 'month', 'year'] as const;
export type FsmCalendarUnit = (typeof FSM_CALENDAR_UNITS)[number];

export interface FsmPreventiveFrequencyRule {
  calendar?: { every: number; unit: FsmCalendarUnit } | null;
  meter?: { operating_hours?: number | null; cycles?: number | null; lead_percent?: number | null } | null;
  lead_days?: number | null;
}

export interface FsmMaintenanceContract {
  id: string;
  customer_id: string;
  contract_number: string;
  title: string;
  start_date: string;
  end_date: string | null;
  status: FsmContractStatus;
  coverage_type: FsmCoverageType | null;
  preventive_frequency_rule: FsmPreventiveFrequencyRule | null;
  included_visits_per_year: number | null;
  used_visits_current_year: number;
  callout_fee_amount: string;
  hourly_labor_rate: string | null;
  recurring_billing_subscription_id: string | null;
  currency: string;
  notes: string | null;
  equipment_passport_ids: string[];
}

export interface FsmMaintenanceContractPayload {
  customer_id: string;
  contract_number: string;
  title: string;
  start_date: string;
  end_date: string | null;
  status: FsmContractStatus;
  coverage_type: FsmCoverageType | null;
  preventive_frequency_rule: FsmPreventiveFrequencyRule | null;
  included_visits_per_year: number | null;
  callout_fee_amount: number | null;
  hourly_labor_rate: number | null;
  currency: string | null;
  notes: string | null;
  equipment_passport_ids: string[];
}

export interface FsmPreventiveRunResult {
  evaluated_assets: number;
  created: string[];
  skipped_existing: number;
}

export interface FsmEquipment {
  id: string;
  serial_number: string;
  product_id: string | null;
  customer_id: string;
  service_contract_id: string | null;
  site_address: string | null;
  site_latitude: number | string | null;
  site_longitude: number | string | null;
  current_operating_hours: string;
  current_cycle_count: number;
  last_service_date: string | null;
  next_scheduled_service_date: string | null;
}

export interface FsmHistoryPart {
  product_id: string;
  quantity: string;
  covered: boolean;
}

export interface FsmHistoryEntry {
  report_id: string;
  report_number: string;
  work_order_id: string;
  work_type: string;
  signed_at: string;
  summary: string;
  labor_hours: string;
  meter_reading_hours: string | null;
  meter_reading_cycles: number | null;
  parts: FsmHistoryPart[];
}

export interface FsmEquipmentHistory {
  equipment: Pick<
    FsmEquipment,
    'id' | 'serial_number' | 'current_operating_hours' | 'current_cycle_count' | 'last_service_date' | 'next_scheduled_service_date'
  >;
  history: FsmHistoryEntry[];
}

export interface FsmMeterPayload {
  current_operating_hours?: number | null;
  current_cycle_count?: number | null;
}

export interface FsmMeterResult {
  id: string;
  current_operating_hours: string;
  current_cycle_count: number;
}
