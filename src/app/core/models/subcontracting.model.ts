/**
 * Wire types of the subcontracting module (Mod 065), served under `/api/v1/subcontracting`: passive and active conto lavoro orders,
 * the dispatch / receipt / return flows with their DDTs, the stock held by partners, the Art. 53 DPR 633/72 statutory register and the
 * IT/CH TPP / TPA summary. Every label of these codes is in the dictionary the API serves (`subcontracting.<group>.<code>`).
 * Decimal quantities and amounts travel as strings: they are never rounded in the browser.
 */

export const SCT_DIRECTIONS = ['passive', 'active'] as const;
export type SctDirection = (typeof SCT_DIRECTIONS)[number];

export const SCT_TYPES = ['full_bom', 'single_operation'] as const;
export type SctType = (typeof SCT_TYPES)[number];

export const SCT_STATUSES = [
  'draft',
  'confirmed',
  'materials_dispatched',
  'in_progress',
  'partially_returned',
  'completed',
  'cancelled',
] as const;
export type SctStatus = (typeof SCT_STATUSES)[number];

export const SCT_CUSTOMS_REGIMES = ['none', 'tpp_outward_processing', 'tpa_inward_processing'] as const;
export type SctCustomsRegime = (typeof SCT_CUSTOMS_REGIMES)[number];

export const SCT_MOVEMENT_TYPES = [
  'outbound_dispatch',
  'inbound_consumption_backflush',
  'scrap_declared',
  'unused_material_return',
  'customer_material_receipt',
  'customer_finished_return',
] as const;
export type SctMovementType = (typeof SCT_MOVEMENT_TYPES)[number];

export const SCT_DEADLINE_STATUSES = ['ok', 'warning', 'expired', 'closed'] as const;
export type SctDeadlineStatus = (typeof SCT_DEADLINE_STATUSES)[number];

export const SCT_CAUSALS = ['subcontracting', 'subcontractor_return', 'subcontracted_goods_return'] as const;
export type SctCausal = (typeof SCT_CAUSALS)[number];

export const SCT_EXPORT_FORMATS = ['csv', 'xlsx', 'pdf'] as const;
export type SctExportFormat = (typeof SCT_EXPORT_FORMATS)[number];

export interface SctEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
  meta?: SctPageMeta;
}

export interface SctPageMeta {
  current_page?: number;
  per_page?: number;
  total?: number;
  last_page?: number;
}

/** RFC 7807 problem of a refused rule: `code` picks `subcontracting.error.<code>`. */
export interface SctProblem {
  code?: string;
  detail?: string;
  params?: Record<string, unknown>;
  errors?: Record<string, string[]>;
}

export interface SctLookups {
  directions: SctDirection[];
  subcontracting_types: SctType[];
  statuses: SctStatus[];
  customs_regimes: SctCustomsRegime[];
  movement_types: SctMovementType[];
  deadline_statuses: SctDeadlineStatus[];
}

export interface SctComponent {
  id: string;
  component_product_id: string;
  sku: string | null;
  product_name: string | null;
  unit_of_measure: string;
  required_qty_per_unit: string;
  total_planned_qty: string;
  dispatched_qty: string;
  consumed_qty: string;
  scrap_qty: string;
  returned_unused_qty: string;
  held_qty: string;
  to_dispatch_qty: string;
  lot_id: string | null;
  serial_number: string | null;
}

export interface SctServiceBilling {
  customer_id: string;
  customer_name: string | null;
  description: string;
  quantity: string;
  unit_price: string;
  amount: string;
  currency: string;
  ddt_numbers: string[];
  sales_order_id: string | null;
  prepared_at: string;
}

export interface SctOrder {
  id: string;
  order_number: string;
  direction: SctDirection;
  subcontracting_type: SctType;
  status: SctStatus;
  partner_type: 'supplier' | 'contact';
  partner_id: string;
  partner_name: string | null;
  source_warehouse_id: string | null;
  subcontractor_warehouse_id: string | null;
  bom_id: string | null;
  linked_production_order_id: string | null;
  linked_production_order_operation_id: string | null;
  routing_operation_label: string | null;
  linked_service_purchase_order_id: string | null;
  linked_customer_sales_order_id: string | null;
  outgoing_material_ddt_id: string | null;
  inbound_return_document_type: string | null;
  inbound_return_document_id: string | null;
  inbound_return_document_number: string | null;
  output_product_id: string;
  output_product_sku: string | null;
  output_product_name: string | null;
  planned_quantity: string;
  received_quantity: string;
  scrap_quantity: string;
  delivered_quantity: string;
  open_quantity: string;
  unit_service_cost: string;
  currency: string;
  expected_return_date: string | null;
  customs_regime: SctCustomsRegime;
  customs_declaration_id: string | null;
  capitalized_service_amount: string;
  capitalized_unit_cost: string;
  service_billing: SctServiceBilling | null;
  zero_balance_sheet_value: boolean;
  confirmed_at: string | null;
  completed_at: string | null;
  notes: string | null;
  created_at: string | null;
  components?: SctComponent[];
}

export interface SctOrderFilters {
  direction?: SctDirection;
  status?: SctStatus;
  partner_id?: string;
  search?: string;
  per_page?: number;
  page?: number;
}

export interface SctComponentInput {
  component_product_id: string;
  required_qty_per_unit: string;
  unit_of_measure?: string;
  lot_id?: string | null;
  serial_number?: string | null;
}

export interface SctOrderPayload {
  direction: SctDirection;
  subcontracting_type: SctType;
  partner_id: string;
  output_product_id: string;
  planned_quantity: string;
  unit_service_cost?: string;
  currency?: string;
  expected_return_date?: string | null;
  bom_id?: string | null;
  linked_production_order_id?: string | null;
  linked_production_order_operation_id?: string | null;
  routing_operation_label?: string | null;
  source_warehouse_id?: string | null;
  customs_regime?: SctCustomsRegime;
  customs_declaration_id?: string | null;
  linked_service_purchase_order_id?: string | null;
  linked_customer_sales_order_id?: string | null;
  generate_service_purchase_order?: boolean;
  notes?: string | null;
  components?: SctComponentInput[];
}

/** A quantity per component line; without lines the whole open quantity moves. */
export interface SctLineQuantity {
  component_id: string;
  quantity: string;
}

export interface SctMovementPayload {
  lines?: SctLineQuantity[];
  date?: string | null;
  carrier_name?: string | null;
  customer_ddt_number?: string | null;
  customer_ddt_date?: string | null;
  notes?: string | null;
}

export interface SctComponentOverride {
  component_id: string;
  consumed_qty?: string;
  scrap_qty?: string;
}

export interface SctReceiptPayload {
  good_quantity: string;
  scrap_quantity?: string;
  date?: string | null;
  vendor_ddt_number?: string | null;
  vendor_ddt_date?: string | null;
  output_warehouse_id?: string | null;
  components?: SctComponentOverride[];
  notes?: string | null;
}

export interface SctProductionPayload {
  good_quantity: string;
  scrap_quantity?: string;
  date?: string | null;
  production_order_id?: string | null;
  components?: SctComponentOverride[];
}

export interface SctDeliveryPayload {
  quantity?: string | null;
  return_unused_materials?: boolean;
  date?: string | null;
  carrier_name?: string | null;
  notes?: string | null;
}

export interface SctReceiptPlanLine {
  component_id: string;
  product_id: string;
  consumed: string;
  scrap: string;
  unit_cost: string;
  value: string;
}

/** What a receipt would do: the backflush per component, its value, the service fee and the cost the goods are capitalized at. */
export interface SctReceiptPlan {
  good_quantity: string;
  scrap_quantity: string;
  lines: SctReceiptPlanLine[];
  components_value: string;
  service_amount: string;
  total_cost: string;
  unit_cost: string;
}

export interface SctDashboardFilters {
  direction?: SctDirection;
  partner_id?: string;
  product_id?: string;
  lot_id?: string;
  deadline_status?: SctDeadlineStatus;
}

export interface SctKpis {
  active_passive_orders: number;
  active_customer_orders: number;
  active_customs_regimes: number;
  units_held: string;
  expiring_30d: number;
  overdue_deadlines: number;
}

export interface SctStockRow {
  order_id: string;
  order_number: string;
  direction: SctDirection;
  partner_id: string;
  partner_name: string | null;
  warehouse_id: string | null;
  product_id: string;
  sku: string | null;
  product_name: string | null;
  lot_id: string | null;
  held_qty: string;
  held_since: string | null;
  aging_days: number | null;
  statutory_return_deadline: string | null;
  days_to_deadline: number | null;
  deadline_status: SctDeadlineStatus;
  customs_regime: SctCustomsRegime;
}

export interface SctPartnerTotal {
  partner_id: string;
  partner_name: string | null;
  direction: SctDirection;
  held_qty: string;
  open_orders: number;
  worst_deadline_status: SctDeadlineStatus;
}

export interface SctDashboard {
  kpis: SctKpis;
  rows: SctStockRow[];
  by_partner: SctPartnerTotal[];
}

export interface SctRegisterFilters {
  direction?: SctDirection;
  partner_id?: string;
  product_id?: string;
  order_id?: string;
  movement_type?: SctMovementType;
  from?: string;
  to?: string;
  deadline_status?: SctDeadlineStatus;
  per_page?: number;
  page?: number;
}

export interface SctRegisterLine {
  id: string;
  entry_date: string;
  direction: SctDirection;
  movement_type: SctMovementType;
  order_id: string;
  order_number: string | null;
  partner_id: string;
  partner_name: string | null;
  product_id: string;
  sku: string | null;
  product_name: string | null;
  lot_id: string | null;
  dispatched_qty: string;
  consumed_in_returned_goods_qty: string;
  scrap_reported_by_subcontractor_qty: string;
  returned_unused_qty: string;
  remaining_at_subcontractor_qty: string;
  ddt_document_id: string | null;
  ddt_number: string | null;
  ddt_date: string | null;
  transport_reason: string | null;
  statutory_return_deadline: string | null;
  days_to_deadline: number | null;
  deadline_status: SctDeadlineStatus;
  customs_declaration_id: string | null;
  valuation_amount: string;
}

export interface SctCrossBorderOrder {
  order_id: string;
  order_number: string;
  direction: SctDirection;
  customs_regime: SctCustomsRegime;
  status: SctStatus;
  partner_name: string | null;
  output_product_id: string;
  planned_quantity: string;
  material_out_qty: string;
  goods_back_qty: string;
  balance_qty: string;
  customs_declaration_id: string | null;
  declaration_number: string | null;
  declaration_mrn: string | null;
  declaration_status: string | null;
  customs_expiry_date: string | null;
  days_to_expiry: number | null;
  expired: boolean;
}

export interface SctRegimeTotal {
  customs_regime: SctCustomsRegime;
  orders: number;
  open_orders: number;
  material_out_qty: string;
  goods_back_qty: string;
  balance_qty: string;
}

export interface SctCrossBorder {
  regimes: SctRegimeTotal[];
  orders: SctCrossBorderOrder[];
}
