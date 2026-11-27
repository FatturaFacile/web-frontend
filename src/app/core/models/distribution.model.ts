/**
 * Distribution, multi-warehouse and transfers (DRP, Issue #271): wire types of the warehouse network, distribution lanes, transfers with
 * goods in transit, replenishment rules and proposals, the time-phased DRP grid, consignment / 3PL and the sales channel ATP.
 * Quantities and amounts may arrive as decimal strings or numbers.
 */

export type DstDecimal = string | number;

export const DST_WAREHOUSE_ROLES = [
  'internal',
  'retail_pos',
  'transit',
  'third_party_3pl',
  'consignment_out',
  'consignment_in',
] as const;
export type DstWarehouseRole = (typeof DST_WAREHOUSE_ROLES)[number];

export const DST_POLICIES = [
  'min_max',
  'reorder_point_fixed_qty',
  'periodic_review',
  'demand_driven_drp',
] as const;
export type DstPolicy = (typeof DST_POLICIES)[number];

export const DST_ALLOCATION_MODES = [
  'shared_pool',
  'percentage',
  'fixed_reserve',
  'priority_rank',
] as const;
export type DstAllocationMode = (typeof DST_ALLOCATION_MODES)[number];

export const DST_PROPOSAL_TYPES = ['replenishment', 'balancing'] as const;
export type DstProposalType = (typeof DST_PROPOSAL_TYPES)[number];

export const DST_PROPOSAL_STATUSES = [
  'pending',
  'approved',
  'rejected',
  'converted',
  'shortfall',
] as const;
export type DstProposalStatus = (typeof DST_PROPOSAL_STATUSES)[number];

export const DST_TRANSPORT_MODES = ['road', 'rail', 'air', 'sea', 'courier', 'internal'] as const;
export type DstTransportMode = (typeof DST_TRANSPORT_MODES)[number];

export const DST_BUCKET_TYPES = ['daily', 'weekly'] as const;
export type DstBucketType = (typeof DST_BUCKET_TYPES)[number];

export const DST_CHANNEL_TYPES = [
  'b2b_portal',
  'ecommerce',
  'retail_pos',
  'marketplace',
  'direct_sales',
  'custom',
] as const;
export type DstChannelType = (typeof DST_CHANNEL_TYPES)[number];

export const DST_SETTLEMENT_TRIGGERS = ['on_consumption', 'monthly_report', 'on_return'] as const;
export type DstSettlementTrigger = (typeof DST_SETTLEMENT_TRIGGERS)[number];

export const DST_BILLING_FREQUENCIES = ['weekly', 'monthly', 'quarterly'] as const;
export type DstBillingFrequency = (typeof DST_BILLING_FREQUENCIES)[number];

export const DST_TRANSFER_STATUSES = [
  'draft',
  'approved',
  'in_transit',
  'partially_received',
  'received',
  'discrepancy_pending',
  'closed',
  'cancelled',
] as const;
export type DstTransferStatus = (typeof DST_TRANSFER_STATUSES)[number];

export const DST_RECEIPT_RESOLUTIONS = [
  'keep_in_transit',
  'write_off',
  'return_to_source',
  'carrier_claim',
] as const;
export type DstReceiptResolution = (typeof DST_RECEIPT_RESOLUTIONS)[number];

export type DstAlertType = 'stockout_risk' | 'excess_stock' | 'late_inbound';

export interface DstEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface DstPageMeta {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

export interface DstPage<T, M = Record<string, unknown>> extends DstEnvelope<T[]> {
  meta: Partial<DstPageMeta> & M;
}

/** RFC 7807 problem of a refused rule: `code` picks the translated text, 422 brings the field errors. */
export interface DstProblem {
  code?: string;
  detail?: string;
  errors?: Record<string, string[]>;
  params?: Record<string, unknown>;
}

export interface DstRef {
  id: string;
  code: string;
  name: string;
}

export interface DstItemRef {
  id: string;
  sku: string;
  name: string;
  uom: string;
}

export interface DstLookups {
  warehouse_roles: DstWarehouseRole[];
  replenishment_policies: DstPolicy[];
  allocation_modes: DstAllocationMode[];
  proposal_types: DstProposalType[];
  proposal_statuses: DstProposalStatus[];
  transport_modes: DstTransportMode[];
  bucket_types: DstBucketType[];
  channel_types: DstChannelType[];
  settlement_triggers: DstSettlementTrigger[];
  billing_frequencies: DstBillingFrequency[];
  warehouses: { id: string; code: string; name: string; role: DstWarehouseRole | null }[];
  items: DstItemRef[];
}

// --- Network ---

export interface DstProfile {
  warehouse_id: string;
  role: DstWarehouseRole;
  parent_warehouse_id: string | null;
  default_transit_warehouse_id: string | null;
  third_party_partner_id: string | null;
  external_reference: string | null;
  settlement_trigger: DstSettlementTrigger | null;
  billing_frequency: DstBillingFrequency | null;
  max_consignment_days: number | null;
  is_insured: boolean;
  counts_in_valuation: boolean;
  include_in_free_stock: boolean;
  is_blocked: boolean;
  is_counting: boolean;
  notes: string | null;
}

export type DstProfilePayload = Partial<Omit<DstProfile, 'warehouse_id'>> & {
  role: DstWarehouseRole;
};

export interface DstNetworkWarehouse {
  id: string;
  code: string;
  name: string;
  warehouse_type: string;
  is_active: boolean;
  profile: DstProfile | null;
}

export interface DstLane {
  id: string;
  source_warehouse_id: string;
  destination_warehouse_id: string;
  lead_time_days: number;
  lead_time_hours: number;
  transport_mode: DstTransportMode;
  cost_per_unit: DstDecimal | null;
  is_active: boolean;
  source_warehouse?: DstRef;
  destination_warehouse?: DstRef;
}

export interface DstLanePayload {
  source_warehouse_id: string;
  destination_warehouse_id: string;
  lead_time_days: number;
  lead_time_hours?: number;
  transport_mode: DstTransportMode;
  cost_per_unit?: DstDecimal | null;
  is_active?: boolean;
}

// --- Transfers ---

export interface DstTransferLine {
  id: string;
  stock_item_id: string;
  sku: string;
  name: string;
  uom: string;
  lot_id: string | null;
  lot_number: string | null;
  quantity: DstDecimal;
  quantity_shipped: DstDecimal;
  quantity_received: DstDecimal;
  quantity_damaged: DstDecimal;
  discrepancy_qty: DstDecimal;
  discrepancy_reason: string | null;
  unit_cost: DstDecimal | null;
}

export interface DstTransferDiscrepancy {
  id: string;
  status: string;
  quantity: DstDecimal;
  reason: string | null;
}

export interface DstTransfer {
  id: string;
  transfer_number: string;
  status: DstTransferStatus;
  source_warehouse: DstRef;
  destination_warehouse: DstRef;
  requested_date: string | null;
  expected_arrival_date: string | null;
  shipped_at: string | null;
  received_at: string | null;
  carrier: string | null;
  tracking_number: string | null;
  ddt_reference: string | null;
  is_overdue: boolean;
  notes: string | null;
  lines: DstTransferLine[];
  discrepancies: DstTransferDiscrepancy[];
}

export interface DstTransferLinePayload {
  stock_item_id: string;
  lot_id?: string | null;
  quantity: number;
}

export interface DstTransferPayload {
  source_warehouse_id: string;
  destination_warehouse_id: string;
  requested_date?: string | null;
  notes?: string | null;
  auto_approve?: boolean;
  lines: DstTransferLinePayload[];
}

export interface DstDispatchPayload {
  carrier?: string | null;
  tracking_number?: string | null;
  ddt_reference?: string | null;
  expected_arrival_date?: string | null;
}

export interface DstReceiptLinePayload {
  line_id: string;
  quantity: number;
  damaged_quantity?: number;
  destination_bin_id?: string | null;
}

export interface DstReceivePayload {
  lines: DstReceiptLinePayload[];
  final?: boolean;
  resolution?: DstReceiptResolution;
}

export interface DstTransferFilters {
  status?: DstTransferStatus | null;
  warehouse_id?: string | null;
  q?: string | null;
  page?: number;
}

export type DstStatusCounts = Partial<Record<DstTransferStatus, number>>;

export interface DstAvailability {
  on_hand: DstDecimal;
  reserved: DstDecimal;
  available: DstDecimal;
  in_transit_inbound: DstDecimal;
}

export interface DstInTransitLine {
  transfer_id: string;
  transfer_number: string;
  stock_item_id: string;
  sku: string;
  name: string;
  uom: string;
  lot_id: string | null;
  lot_number: string | null;
  source_warehouse: DstRef;
  destination_warehouse: DstRef;
  quantity_in_transit: DstDecimal;
  value: DstDecimal;
  shipped_at: string | null;
  expected_arrival_date: string | null;
  is_overdue: boolean;
  carrier: string | null;
  tracking_number: string | null;
}

export interface DstInTransitFilters {
  stock_item_id?: string | null;
  source_warehouse_id?: string | null;
  destination_warehouse_id?: string | null;
  overdue?: boolean;
  lot_id?: string | null;
  expected_to?: string | null;
}

// --- Replenishment ---

export interface DstRule {
  id: string;
  warehouse_id: string;
  stock_item_id: string;
  policy: DstPolicy;
  source_warehouse_id: string | null;
  safety_stock: DstDecimal;
  reorder_point: DstDecimal;
  max_stock: DstDecimal | null;
  fixed_quantity: DstDecimal | null;
  min_transfer_qty: DstDecimal | null;
  transfer_multiple: DstDecimal | null;
  lead_time_days: number;
  review_cycle_days: number | null;
  target_days_of_supply: number | null;
  priority: number;
  is_active: boolean;
  warehouse?: DstRef;
  source_warehouse?: DstRef | null;
  item?: DstItemRef;
}

export interface DstRulePayload {
  warehouse_id: string;
  stock_item_id: string;
  policy: DstPolicy;
  source_warehouse_id?: string | null;
  safety_stock: number;
  reorder_point: number;
  max_stock?: number | null;
  fixed_quantity?: number | null;
  min_transfer_qty?: number | null;
  transfer_multiple?: number | null;
  lead_time_days: number;
  review_cycle_days?: number | null;
  target_days_of_supply?: number | null;
  priority: number;
  is_active?: boolean;
}

export interface DstCalculation {
  policy: DstPolicy | null;
  trigger_reason: string | null;
  on_hand: DstDecimal;
  in_transit_inbound: DstDecimal;
  reserved: DstDecimal;
  safety_stock: DstDecimal;
  reorder_point: DstDecimal;
  max_stock: DstDecimal | null;
  projected_demand: DstDecimal;
  net_position: DstDecimal;
  steps: { label: string; value: DstDecimal | string }[];
}

export interface DstProposal {
  id: string;
  proposal_type: DstProposalType;
  status: DstProposalStatus;
  warehouse_id: string;
  stock_item_id: string;
  source_warehouse_id: string | null;
  suggested_quantity: DstDecimal;
  original_quantity: DstDecimal;
  uom: string;
  projected_stockout_date: string | null;
  source_available_quantity: DstDecimal | null;
  shortfall_quantity: DstDecimal | null;
  rule_id: string | null;
  transfer_order_id: string | null;
  calculation: DstCalculation;
  generated_at: string;
  warehouse?: DstRef;
  source_warehouse?: DstRef | null;
  item?: DstItemRef;
}

export interface DstProposalFilters {
  status?: DstProposalStatus | null;
  proposal_type?: DstProposalType | null;
  warehouse_id?: string | null;
  page?: number;
}

export interface DstGenerateResult {
  created: number;
  balancing: number;
  shortfalls: number;
}

export interface DstApproveResult {
  transfers: DstTransfer[];
  shortfalls: DstProposal[];
}

// --- DRP ---

export interface DstDrpAlert {
  id: string;
  type: DstAlertType;
  severity: string;
  warehouse_id: string;
  stock_item_id: string;
  bucket_index: number | null;
  warehouse?: DstRef;
  item?: DstItemRef;
  params: Record<string, unknown>;
}

export interface DstDrpRun {
  id: string;
  run_number: string;
  bucket_type: DstBucketType;
  horizon: number;
  status: string;
  started_at: string | null;
  finished_at: string | null;
  summary: { rows: number; alerts: number };
  alerts?: DstDrpAlert[];
}

export interface DstDrpRunPayload {
  bucket_type: DstBucketType;
  horizon: number;
  stock_item_ids?: string[];
  warehouse_ids?: string[];
}

export interface DstDrpBucket {
  index: number;
  start: string;
  end: string;
}

export interface DstDrpCell {
  index: number;
  gross_requirements: DstDecimal;
  scheduled_receipts: DstDecimal;
  projected_available: DstDecimal;
  net_requirements: DstDecimal;
  planned_receipts: DstDecimal;
  planned_releases: DstDecimal;
}

export interface DstDrpRow {
  warehouse_id: string;
  stock_item_id: string;
  warehouse?: DstRef;
  item?: DstItemRef;
  lead_time_days: number;
  source_warehouse_id: string | null;
  opening_balance: DstDecimal;
  safety_stock: DstDecimal;
  cells: DstDrpCell[];
}

export interface DstDrpGrid {
  buckets: DstDrpBucket[];
  rows: DstDrpRow[];
}

// --- Channels and ATP ---

export interface DstChannelRule {
  id: string;
  sales_channel_id: string;
  warehouse_id: string;
  allocation_mode: DstAllocationMode;
  allocation_percentage: DstDecimal | null;
  fixed_reserve_qty: DstDecimal | null;
  priority_rank: number | null;
  include_in_transit: boolean;
  exclude_consignment: boolean;
  exclude_3pl: boolean;
  safety_buffer_qty: DstDecimal | null;
  is_active: boolean;
  warehouse?: DstRef;
}

export interface DstChannelRulePayload {
  warehouse_id: string;
  allocation_mode: DstAllocationMode;
  allocation_percentage?: number | null;
  fixed_reserve_qty?: number | null;
  priority_rank?: number | null;
  include_in_transit?: boolean;
  exclude_consignment?: boolean;
  exclude_3pl?: boolean;
  safety_buffer_qty?: number | null;
  is_active?: boolean;
}

export interface DstChannel {
  id: string;
  code: string;
  name: string;
  channel_type: DstChannelType;
  is_active: boolean;
  priority: number;
  rules?: DstChannelRule[];
}

export interface DstChannelPayload {
  code: string;
  name: string;
  channel_type: DstChannelType;
  is_active?: boolean;
  priority?: number;
}

export interface DstAtpWarehouse {
  warehouse_id: string;
  code: string;
  name: string;
  on_hand: DstDecimal;
  reserved: DstDecimal;
  in_transit_inbound: DstDecimal;
  ring_fenced: DstDecimal;
  atp: DstDecimal;
}

export interface DstAtpChannel {
  sales_channel_id: string;
  code: string;
  name: string;
  on_hand: DstDecimal;
  reserved: DstDecimal;
  in_transit_inbound: DstDecimal;
  ring_fenced: DstDecimal;
  safety_buffer: DstDecimal;
  atp: DstDecimal;
  warehouses: DstAtpWarehouse[];
}

export interface DstAtp {
  stock_item: DstItemRef;
  channels: DstAtpChannel[];
}

export interface DstAtpMatrix {
  channels: { id: string; code: string; name: string }[];
  rows: { stock_item_id: string; sku: string; name: string; cells: Record<string, DstDecimal> }[];
}

// --- Consignment and 3PL ---

export type DstConsignmentDirection = 'out' | 'in';

export interface DstConsignmentStock {
  warehouse: DstRef;
  stock_item: DstItemRef;
  quantity: DstDecimal;
  unit_cost: DstDecimal;
  value: DstDecimal;
  days_held: number;
  max_consignment_days: number | null;
  is_overdue: boolean;
}

export interface DstSettlementLine {
  stock_item_id: string;
  sku: string;
  name: string;
  quantity: DstDecimal;
  unit_price: DstDecimal | null;
  line_total: DstDecimal;
}

export interface DstSettlement {
  id: string;
  settlement_number: string;
  warehouse: DstRef;
  direction: DstConsignmentDirection;
  status: 'open' | 'invoiced';
  total_quantity: DstDecimal;
  total_value: DstDecimal;
  settled_at: string;
  reference: string | null;
  lines: DstSettlementLine[];
}

export interface DstSettlementPayload {
  warehouse_id: string;
  reference?: string | null;
  settled_at?: string | null;
  notes?: string | null;
  lines: { stock_item_id: string; quantity: number; unit_price?: number | null }[];
}

export interface DstReturnPayload {
  warehouse_id: string;
  destination_warehouse_id: string;
  notes?: string | null;
  lines: { stock_item_id: string; quantity: number }[];
}

export interface DstReconciliationLine {
  stock_item_id: string;
  sku: string;
  name: string;
  system_quantity: DstDecimal;
  external_quantity: DstDecimal;
  difference: DstDecimal;
}

export interface DstReconciliation {
  id: string;
  warehouse: DstRef;
  external_reference: string | null;
  status: 'balanced' | 'discrepancy';
  lines: DstReconciliationLine[];
  reconciled_at: string;
}

export interface DstReconciliationPayload {
  warehouse_id: string;
  external_reference?: string | null;
  lines: { stock_item_id: string; external_quantity: number }[];
}

// --- Dashboard ---

export interface DstDashboard {
  active_transfers: number;
  units_in_transit: DstDecimal;
  value_in_transit: DstDecimal;
  overdue_shipments: number;
  pending_proposals: number;
  stockout_alerts: number;
  consignment_stock_value: DstDecimal;
  overdue: DstInTransitLine[];
  latest_run: DstDrpRun | null;
}
