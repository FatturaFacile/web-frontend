/** Asset management extensions: maintenance plans and work orders, locations, classes, components, valuations, reports. */

export type MaintenanceType = 'preventive' | 'condition_based' | 'predictive' | 'calibration';
export type MaintenanceTrigger = 'time' | 'meter' | 'time_or_meter';
export type AssetCondition = 'new' | 'excellent' | 'good' | 'fair' | 'poor' | 'damaged';

export interface MaintenancePlan {
  id: string;
  asset_id: string | null;
  asset_class_id: string | null;
  plan_code: string | null;
  name: string | null;
  maintenance_type: MaintenanceType | null;
  trigger_type: MaintenanceTrigger | null;
  frequency_days: number | null;
  meter_code: string | null;
  meter_interval_units: string | null;
  last_meter_reading: string | null;
  next_due_meter: string | null;
  lead_time_days: number | null;
  estimated_duration_hours: string | null;
  estimated_cost: string | null;
  last_executed_date: string | null;
  next_due_date: string | null;
  is_active: boolean;
  checklist: Record<string, unknown> | null;
}

export interface MaintenancePlanPayload {
  name: string;
  plan_code?: string | null;
  asset_id?: string | null;
  asset_class_id?: string | null;
  maintenance_type?: MaintenanceType | null;
  trigger_type?: MaintenanceTrigger | null;
  frequency_days?: number | null;
  meter_code?: string | null;
  meter_interval_units?: number | null;
  lead_time_days?: number | null;
  estimated_duration_hours?: number | null;
  estimated_cost?: number | null;
  next_due_date?: string | null;
  is_active?: boolean | null;
  checklist?: unknown[] | null;
}

export interface WorkOrder {
  id: string;
  work_order_number: string | null;
  asset_id: string | null;
  plan_id: string | null;
  maintenance_type: string | null;
  priority: string | null;
  status: string | null;
  approval_status: string;
  scheduled_date: string | null;
  started_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  downtime_hours: string | null;
  estimated_cost: string | null;
  labor_cost: string | null;
  parts_cost: string | null;
  external_service_cost: string | null;
  total_cost: string | null;
  capitalize_as_upgrade: boolean;
  condition_after_maintenance: string | null;
  journal_entry_id: string | null;
  is_locked: boolean;
  problem_description: string | null;
  resolution_notes: string | null;
}

export interface WorkOrderPart {
  id: string;
  work_order_id: string | null;
  product_id: string | null;
  warehouse_id: string | null;
  quantity: string | null;
  unit_cost: string | null;
  total_cost: string | null;
  consumed_at: string | null;
}

export interface WorkOrderDetail {
  data: WorkOrder;
  parts: WorkOrderPart[];
}

export interface CompleteWorkOrderPayload {
  downtime_hours?: number | null;
  labor_cost?: number | null;
  parts_cost?: number | null;
  external_service_cost?: number | null;
  capitalize_as_upgrade?: boolean | null;
  condition_after_maintenance?: AssetCondition | null;
  meter_reading?: number | null;
  resolution_notes?: string | null;
}

export type AssetLocationType = 'facility' | 'building' | 'floor' | 'room' | 'yard' | 'mobile' | 'project_site';

export interface AssetLocation {
  id: string;
  parent_id: string | null;
  warehouse_id: string | null;
  code: string | null;
  name: string | null;
  location_type: AssetLocationType | null;
  address: string | null;
  city: string | null;
  country: string | null;
  is_active: boolean;
}

export interface AssetLocationPayload {
  code: string;
  name: string;
  parent_id?: string | null;
  warehouse_id?: string | null;
  location_type?: AssetLocationType | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  is_active?: boolean | null;
}

export type AssetCriticality = 'low' | 'medium' | 'high' | 'mission_critical';

export interface AssetClass {
  id: string;
  code: string | null;
  name: string | null;
  criticality: AssetCriticality | null;
  default_maintenance_interval_days: number | null;
  requires_custodian: boolean;
  requires_calibration: boolean;
  is_active: boolean;
}

export interface AssetClassPayload {
  code: string;
  name: string;
  criticality?: AssetCriticality | null;
  default_maintenance_interval_days?: number | null;
  requires_custodian?: boolean | null;
  requires_calibration?: boolean | null;
}

export interface AssetComponent {
  id: string;
  parent_asset_id: string | null;
  component_asset_id: string | null;
  component_code: string | null;
  name: string | null;
  serial_number: string | null;
  cost_allocation: string | null;
  useful_life_months: number | null;
  condition: string | null;
  status: string | null;
  installed_date: string | null;
}

export interface AssetComponentPayload {
  name: string;
  component_code?: string | null;
  component_asset_id?: string | null;
  serial_number?: string | null;
  cost_allocation?: number | null;
  useful_life_months?: number | null;
  condition?: AssetCondition | null;
  installed_date?: string | null;
}

export interface AssetMeterReading {
  id: string;
  asset_id: string | null;
  meter_code: string | null;
  reading_value: string | null;
  read_at: string | null;
  source: string | null;
  notes: string | null;
}

export interface AssetAssignmentPayload {
  assignee_type: 'employee' | 'department' | 'project' | 'site' | 'vehicle_operator';
  assignee_id?: string | null;
  assignee_name: string;
  department_id?: string | null;
  project_id?: string | null;
  location_id?: string | null;
  assigned_at?: string | null;
  expected_return_at?: string | null;
  notes?: string | null;
}

export interface AssetProjectAllocationPayload {
  project_id: string;
  allocated_from?: string | null;
  allocated_to?: string | null;
  hourly_rate?: number | null;
  daily_rate?: number | null;
  utilized_hours?: number | null;
  utilized_days?: number | null;
  notes?: string | null;
}

export interface AssetAcquirePayload {
  source_type: 'passive_invoice_line' | 'purchase_order_item';
  source_id: string;
  category_id: string;
  name?: string | null;
  asset_class_id?: string | null;
  location_id?: string | null;
  custodian_user_id?: string | null;
  cost_center_id?: string | null;
  serial_number?: string | null;
  salvage_value?: number | null;
  useful_life_years?: number | null;
  warranty_expiry_date?: string | null;
  capitalize?: boolean | null;
  capitalization_date?: string | null;
  in_service_date?: string | null;
  auto_post_to_gl?: boolean | null;
}

export interface AssetTransferPayload {
  to_location_id?: string | null;
  to_custodian_id?: string | null;
  to_project_id?: string | null;
  to_cost_center_id?: string | null;
  transfer_date?: string | null;
  reason?: string | null;
}

export interface AssetValuationPayload {
  valuation_type: 'revaluation' | 'impairment';
  fair_value: number;
  value_in_use?: number | null;
  valuation_date?: string | null;
  appraiser_name?: string | null;
  reason?: string | null;
  auto_post_to_gl?: boolean | null;
}

export interface AssetValuation {
  id: string;
  asset_id: string | null;
  valuation_number: string | null;
  valuation_type: string | null;
  valuation_date: string | null;
  carrying_amount_before: string | null;
  fair_value: string | null;
  recoverable_amount: string | null;
  adjustment_amount: string | null;
  carrying_amount_after: string | null;
  status: string | null;
  journal_entry_id: string | null;
  reason: string | null;
}

export interface AssetTransfer {
  id: string;
  asset_id: string | null;
  transfer_number: string | null;
  transfer_date: string | null;
  status: string | null;
  reason: string | null;
}

export interface AssetDisposal {
  id: string;
  asset_id: string | null;
  disposal_number: string | null;
  disposal_type: string | null;
  disposal_date: string | null;
  proceeds_amount: string | null;
  gain_loss_amount: string | null;
  status: string | null;
}

export interface AssetHistory {
  transfers: AssetTransfer[];
  valuations: AssetValuation[];
  disposals: AssetDisposal[];
}

export type AssetLedgerType = 'statutory' | 'tax' | 'ifrs' | 'management' | 'civil' | 'fiscal';

export interface DepreciationPreviewRow {
  period_code: string;
  opening_book_value: string;
  depreciation_amount: string;
  closing_book_value: string;
  accumulated_depreciation: string;
}

export interface AssetRegisterRow {
  asset_id: string;
  asset_number: string;
  name: string;
  category_code: string;
  acquisition_date: string | null;
  depreciation_method: string;
  rate_percent: string;
  cost_start: string;
  additions: string;
  disposals_cost: string;
  cost_end: string;
  accumulated_start: string;
  depreciation_year: string;
  disposals_accumulated: string;
  accumulated_end: string;
  value_adjustments: string;
  net_book_value_end: string;
}

export interface ExpiringAsset {
  asset_id: string;
  asset_number: string;
  name: string;
  custodian_user_id: string | null;
  warranty_expiry_date: string | null;
  warranty_provider: string | null;
  insurance_expiry_date: string | null;
  insurance_provider: string | null;
  insurance_policy_number: string | null;
}

export type AssetCategoryPayload = { code: string; name: string } & Record<string, string | number | boolean | null | undefined>;
