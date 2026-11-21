/**
 * Typed mirrors of the manufacturing cockpit, genealogy, cost report, capacity, shop-floor and edge endpoints of the API
 * (`modules/30_Manufacturing`). Amounts, quantities and percentages arrive as decimal strings.
 */

export type MfgProductionStrategy = 'MTO' | 'MTS' | 'ATO';
export type MfgMachineState = 'RUNNING' | 'SETUP' | 'IDLE' | 'FAULT' | 'MAINTENANCE';

export const MFG_MACHINE_STATES: readonly MfgMachineState[] = ['RUNNING', 'SETUP', 'IDLE', 'FAULT', 'MAINTENANCE'];
export const MFG_STRATEGIES: readonly MfgProductionStrategy[] = ['MTO', 'MTS', 'ATO'];

export interface MfgCockpitOrders {
  by_strategy: Record<MfgProductionStrategy, number>;
  by_status: Record<string, number>;
  open: number;
}

export interface MfgMachineAlert {
  machine_id: string;
  machine_code: string;
  state: MfgMachineState;
  since: string | null;
}

export interface MfgCockpitMachines {
  by_state: Record<MfgMachineState, number>;
  alerts: MfgMachineAlert[];
}

export interface MfgWorkCenterOee {
  work_center_id: string;
  work_center_code: string;
  operating_minutes: string;
  run_minutes: string;
  downtime_minutes: string;
  ideal_minutes: string;
  good_units: string;
  total_units: string;
  available_hours: string;
  utilization_percent: string | null;
  availability: string | null;
  performance: string | null;
  quality: string | null;
  oee: string | null;
}

export interface MfgBottleneck {
  work_center_id: string;
  work_center_code: string;
  utilization_percent: string;
}

export interface MfgMrpExceptionItem {
  mfg_item_id: string;
  required_date: string;
  net_shortage: string;
  recommended_action: string;
}

export interface MfgMrpExceptions {
  run_id: string | null;
  shortages: number;
  items: MfgMrpExceptionItem[];
}

export interface MfgCockpitWip {
  valuation: string;
  standard_cost: string;
  variance: string;
}

export interface MfgCockpitKpis {
  window_days: number;
  orders: { completed: number; average_lead_time_days: string | null; on_time_percent: string | null };
  quality: { good_quantity: string; scrap_quantity: string; scrap_rate_percent: string | null };
  variances: { orders_closed: number; material: string; labor: string; overhead: string; subcontract: string; total: string };
}

export interface MfgCockpit {
  orders: MfgCockpitOrders;
  machines: MfgCockpitMachines;
  oee: MfgWorkCenterOee[];
  bottlenecks: MfgBottleneck[];
  mrp_exceptions: MfgMrpExceptions;
  wip: MfgCockpitWip;
  kpis: MfgCockpitKpis;
}

// --- Genealogy ---

export interface MfgLotDelivery {
  delivery_note_id: string;
  ddt_number: string;
  contact_id: string;
  date: string;
  quantity: string;
}

/** A node of the lot tree (backward: supplier lots of the components; forward: derived lots and their deliveries). */
export interface MfgLotNode {
  lot_id: string;
  lot_number: string;
  lot_level: string | null;
  stock_item_id: string;
  sku: string | null;
  item_name: string | null;
  supplier_id: string | null;
  supplier_lot_number: string | null;
  manufacturing_date: string | null;
  expiration_date: string | null;
  received_at: string | null;
  quantity_consumed: string | null;
  production_order_id: string | null;
  deliveries: MfgLotDelivery[];
  lots: MfgLotNode[];
}

export interface MfgGenealogyOutputLot {
  lot_id: string;
  lot_number: string;
  backward: MfgLotNode;
  forward: MfgLotNode;
}

export interface MfgGenealogyOperation {
  production_order_operation_id: string;
  machine_id: string | null;
  operator_id: string | null;
  started_at: string;
  completed_at: string | null;
}

export interface MfgGenealogyMachineEvent {
  machine_id: string;
  state: MfgMachineState | string;
  occurred_at: string;
  payload: Record<string, unknown> | null;
}

export interface MfgGenealogy {
  production_order_id: string;
  order_number: string;
  output_lots: MfgGenealogyOutputLot[];
  operations: MfgGenealogyOperation[];
  machine_events: MfgGenealogyMachineEvent[];
}

// --- Cost report ---

export type MfgCostElementKey = 'material' | 'labor' | 'overhead' | 'subcontract';
export const MFG_COST_ELEMENTS: readonly MfgCostElementKey[] = ['material', 'labor', 'overhead', 'subcontract'];

export interface MfgCostElement {
  standard_unit_cost: string;
  standard_for_target: string;
  standard_for_output: string;
  actual: string;
  variance: string;
}

export interface MfgCostReport {
  production_order_id: string;
  status: string;
  currency: string;
  target_quantity: string;
  received_quantity: string;
  scrapped_quantity: string;
  standard_unit_cost: string;
  elements: Record<MfgCostElementKey, MfgCostElement>;
  totals: {
    standard_for_target: string;
    standard_for_output: string;
    actual: string;
    received_value: string;
    wip_balance: string;
    variance: string;
  };
  journal_entry_ids: string[];
  is_closed: boolean;
}

// --- Capacity ---

export interface MfgCapacityDay {
  date: string;
  gross_hours: string;
  available_hours: string;
  load_hours: string;
  utilization_percent: string | null;
  is_exception: boolean;
}

// --- Production order operations as returned by `GET /production-orders/{id}` ---

export interface MfgOrderOperation {
  id: string;
  sequence: number;
  operation_code: string | null;
  name: string;
  work_center_id: string | null;
  status: string;
  is_subcontracted: boolean;
  scheduled_date: string | null;
  planned_setup_minutes: string;
  planned_run_minutes: string;
  planned_labor_minutes: string | null;
  actual_setup_minutes: string;
  actual_run_minutes: string;
  completed_quantity: string;
  scrapped_quantity: string;
}

// --- Operation confirmation ---

export interface MfgConfirmOperationPayload {
  setup_minutes?: string;
  run_minutes?: string;
  labor_minutes?: string;
  downtime_minutes?: string;
  good_quantity: string;
  scrap_quantity?: string;
  scrap_reason?: string;
  is_final?: boolean;
  posting_date?: string;
  /** Idempotency key: one per user action, reused on retry. */
  operation_posting_uuid: string;
}

export interface MfgOperationConfirmation {
  id: string;
  [key: string]: unknown;
}

export interface MfgConfirmationResult {
  confirmation: MfgOperationConfirmation;
  /** `true` when the API answered 200: the uuid was already posted and nothing was booked again. */
  replayed: boolean;
}

// --- Shop floor and edge ---

export interface MfgShopFloorExecution {
  id: string;
  execution_number: string;
  production_order_id: string;
  production_order_operation_id: string;
  work_center_id: string | null;
  operator_id: string | null;
  machine_id: string | null;
  status: string;
  good_units: string;
  scrap_units: string;
  started_at: string;
  completed_at: string | null;
}

export interface MfgEdgeGateway {
  id: string;
  name: string;
  is_active: boolean;
  last_seen_at: string | null;
}

/** The registration answer: the shared HMAC secret is returned only once. */
export interface MfgEdgeGatewayRegistration {
  id: string;
  name: string;
  secret: string;
}
