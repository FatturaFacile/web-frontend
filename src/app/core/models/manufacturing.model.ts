export type BomStatus = 'draft' | 'active' | 'superseded' | 'archived' | string;
export type BomType = 'standard' | 'phantom' | 'engineering';

export interface MfgBomComponent {
  id?: string;
  component_item_id: string;
  item_code?: string;
  item_name?: string;
  quantity_per: number;
  sequence?: number | null;
  scrap_percentage?: number | null;
  yield_percentage?: number | null;
  is_phantom?: boolean | null;
  issue_method?: 'manual' | 'backflush' | null;
  operation_sequence?: number | null;
  notes?: string | null;
}

export interface MfgBomResource {
  id: string;
  bom_number: string;
  mfg_item_id: string;
  item_code?: string;
  item_name?: string;
  name: string;
  revision: string;
  version?: number;
  bom_type?: BomType;
  status: BomStatus;
  base_quantity: number;
  uom: string;
  effective_from?: string | null;
  effective_to?: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
  notes?: string | null;
  components?: MfgBomComponent[];
  created_at?: string;
}

export interface CreateBomPayload {
  mfg_item_id: string;
  name: string;
  bom_number?: string | null;
  revision?: string | null;
  bom_type?: BomType | null;
  base_quantity?: number | null;
  uom?: string | null;
  effective_from?: string | null;
  effective_to?: string | null;
  notes?: string | null;
  components: {
    component_item_id: string;
    quantity_per: number;
    sequence?: number | null;
    scrap_percentage?: number | null;
    yield_percentage?: number | null;
    is_phantom?: boolean | null;
    issue_method?: 'manual' | 'backflush' | null;
    operation_sequence?: number | null;
    notes?: string | null;
  }[];
}

export type ProductionOrderStatus =
  | 'planned'
  | 'released'
  | 'in_progress'
  | 'completed'
  | 'closed'
  | 'cancelled'
  | string;

export interface MfgProductionOrderLine {
  id?: string;
  mfg_item_id: string;
  required_quantity: number;
  issued_quantity: number;
  uom?: string;
  notes?: string | null;
}

export interface MfgProductionOrderOperation {
  id?: string;
  operation_sequence: number;
  name: string;
  work_center_id?: string | null;
  planned_setup_hours?: number;
  planned_run_hours?: number;
  status?: string;
}

export interface MfgProductionOrderResource {
  id: string;
  order_number: string;
  mfg_item_id: string;
  item_code?: string;
  item_name?: string;
  bom_id?: string | null;
  routing_id?: string | null;
  project_id?: string | null;
  sales_order_id?: string | null;
  planned_order_id?: string | null;
  warehouse_id?: string | null;
  receipt_warehouse_id?: string | null;
  status: ProductionOrderStatus;
  target_quantity: number;
  completed_quantity: number;
  scrapped_quantity: number;
  uom: string;
  planned_start_date: string;
  planned_end_date: string;
  actual_start_date?: string | null;
  actual_end_date?: string | null;
  standard_cost_total?: number;
  actual_cost_total?: number;
  variance_total?: number;
  notes?: string | null;
  lines?: MfgProductionOrderLine[];
  operations?: MfgProductionOrderOperation[];
  created_at?: string;
}

export interface CreateProductionOrderPayload {
  mfg_item_id: string;
  target_quantity: number;
  planned_start_date: string;
  planned_end_date: string;
  bom_id?: string | null;
  routing_id?: string | null;
  project_id?: string | null;
  sales_order_id?: string | null;
  warehouse_id?: string | null;
  receipt_warehouse_id?: string | null;
  notes?: string | null;
}

export type MrpRunType = 'regenerative' | 'net_change';

export interface MfgPlannedOrderResource {
  id: string;
  planned_order_number: string;
  mrp_run_id: string;
  mfg_item_id: string;
  item_code?: string;
  item_name?: string;
  order_type: 'make' | 'buy' | string;
  quantity: number;
  net_requirement: number;
  bom_level: number;
  uom: string;
  start_date: string;
  due_date: string;
  status: 'planned' | 'converted' | 'cancelled' | string;
  bom_id?: string | null;
  routing_id?: string | null;
  converted_order_id?: string | null;
  converted_at?: string | null;
}

export interface MfgShortageResource {
  id: string;
  mrp_run_id: string;
  mfg_item_id: string;
  item_code?: string;
  item_name?: string;
  required_date: string;
  gross_requirement: number;
  available_inventory: number;
  scheduled_receipts: number;
  safety_stock: number;
  net_shortage: number;
  recommended_action: string;
}

export interface MfgMrpRunResource {
  id: string;
  run_number: string;
  run_type: MrpRunType;
  status: 'pending' | 'running' | 'completed' | 'failed' | string;
  horizon_start_date: string;
  horizon_end_date: string;
  total_items_processed: number;
  total_planned_orders: number;
  total_shortages: number;
  executed_by?: string | null;
  executed_at?: string | null;
  planned_orders?: MfgPlannedOrderResource[];
  shortages?: MfgShortageResource[];
  created_at?: string;
}

export interface RunMrpPayload {
  horizon_start_date: string;
  horizon_end_date: string;
  run_type?: MrpRunType | null;
  item_ids?: string[] | null;
}

export interface MfgWorkCenterResource {
  id: string;
  work_center_code: string;
  name: string;
  description?: string | null;
  department_code?: string | null;
  capacity_hours_per_day: number;
  efficiency_rate?: number;
  availability_rate?: number;
  hourly_cost_rate?: number;
  hourly_overhead_rate?: number;
  status: 'active' | 'inactive' | 'maintenance' | string;
  created_at?: string;
}

export interface CreateWorkCenterPayload {
  work_center_code: string;
  name: string;
  description?: string | null;
  department_code?: string | null;
  capacity_hours_per_day?: number;
  efficiency_rate?: number;
  availability_rate?: number;
  hourly_cost_rate?: number;
  hourly_overhead_rate?: number;
  status?: string;
}

export interface MfgRoutingResource {
  id: string;
  routing_number: string;
  mfg_item_id: string;
  item_code?: string;
  item_name?: string;
  name: string;
  revision: string;
  status: string;
  is_default: boolean;
  effective_from?: string | null;
  effective_to?: string | null;
  notes?: string | null;
  operations?: {
    id?: string;
    operation_sequence: number;
    work_center_id: string;
    description: string;
    setup_time_minutes?: number;
    run_time_minutes?: number;
  }[];
  created_at?: string;
}

// Backward-compatible aliases
export type ProductionOrder = MfgProductionOrderResource | {
  id?: string;
  num?: string;
  product?: string;
  qty?: string | number;
  line?: string;
  progress?: string;
  qa?: string;
  status?: string;
};

export type BillOfMaterial = MfgBomResource;
export interface TrackProductionStagePayload {
  actual_hours: number;
  status: 'pending' | 'running' | 'done';
}
