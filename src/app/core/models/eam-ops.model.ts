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
  fiscal_jurisdiction?: 'CH' | 'IT' | null;
  fiscal_rate_id?: string | null;
  fiscal_sector_code?: string | null;
  incentive_regime?: string | null;
  incentive_rate_percent?: number | null;
  incentive_installment_years?: number | null;
  incentive_interconnection_date?: string | null;
  immediate_expensing_applied?: boolean | null;
  warranty_expiry_date?: string | null;
  capitalize?: boolean | null;
  capitalization_date?: string | null;
  in_service_date?: string | null;
  auto_post_to_gl?: boolean | null;
}

export interface PendingInvoiceLine {
  id: string;
  passive_invoice_id: string;
  invoice_number: string | null;
  invoice_date: string | null;
  supplier_id: string | null;
  supplier_name?: string | null;
  description: string;
  line_total: string;
  currency: string;
  is_capital_asset: boolean;
  asset_category_id: string | null;
}

export interface AssetImprovement {
  id: string;
  asset_id: string | null;
  improvement_number: string | null;
  improvement_date: string | null;
  amount: string | null;
  description: string | null;
  supplier_id?: string | null;
  purchase_invoice_id?: string | null;
  purchase_invoice_number?: string | null;
  extends_useful_life_months: number;
  affects_tax_book: boolean;
  status: string | null;
  journal_entry_id?: string | null;
  created_at?: string | null;
}

export interface RecordAssetImprovementPayload {
  improvement_date?: string | null;
  description: string;
  amount: number;
  supplier_id?: string | null;
  purchase_invoice_id?: string | null;
  purchase_invoice_number?: string | null;
  extends_useful_life_months?: number;
  affects_tax_book?: boolean;
  auto_post_to_gl?: boolean;
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
  apply_to_tax_book?: boolean | null;
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
  carrying_amount_at_disposal?: string | null;
  proceeds_amount: string | null;
  gain_loss_amount: string | null;
  fiscal_carrying_amount_at_disposal?: string | null;
  fiscal_gain_loss_amount?: string | null;
  fiscal_gain_spread_years?: number | null;
  disposal_document_number?: string | null;
  sales_invoice_id?: string | null;
  status: string | null;
}

export interface AssetHistory {
  transfers: AssetTransfer[];
  valuations: AssetValuation[];
  improvements?: AssetImprovement[];
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

export interface ParallelScheduleRow {
  period_code: string;
  is_posted_civil: boolean;
  is_posted_fiscal: boolean;
  civil_opening: string;
  civil_depreciation: string;
  civil_accumulated: string;
  civil_closing: string;
  fiscal_opening: string;
  fiscal_depreciation: string;
  fiscal_accumulated: string;
  fiscal_closing: string;
  temporary_difference: string;
  cumulative_temporary_difference: string;
  incentive_tax_credit: string;
  incentive_extra_deduction: string;
}

export interface ParallelScheduleResponse {
  asset_id: string;
  asset_number: string;
  fiscal_jurisdiction: string | null;
  period_type: 'yearly' | 'quarterly' | 'monthly';
  books: { statutory: Record<string, unknown>; tax: Record<string, unknown> };
  incentive: Record<string, unknown>;
  rows: ParallelScheduleRow[];
  totals: {
    civil_depreciation: string;
    fiscal_depreciation: string;
    temporary_difference: string;
    incentive_tax_credit: string;
    incentive_extra_deduction: string;
  };
}

export interface AssetRegisterRow {
  asset_id: string;
  asset_number: string;
  name: string;
  category_code: string;
  category_name?: string | null;
  fiscal_jurisdiction?: string | null;
  fiscal_regime?: string | null;
  acquisition_date: string | null;
  in_service_date?: string | null;
  depreciation_method: string;
  rate_percent: string;
  cost_start: string;
  additions: string;
  improvements_year?: string;
  disposals_cost: string;
  cost_end: string;
  accumulated_start: string;
  depreciation_year: string;
  disposals_accumulated: string;
  accumulated_end: string;
  value_adjustments: string;
  net_book_value_end: string;
}

export interface AssetRegisterComplianceHeader {
  company_name: string;
  legal_name: string;
  tax_id: string;
  fiscal_code: string;
  jurisdiction: string;
  legal_reference: string;
  currency: string;
  year: number;
  ledger_type: string;
  generated_at: string;
}

export interface AssetRegisterCategorySubtotal {
  category_code: string;
  category_name: string;
  assets_count: number;
  cost_start: string;
  additions: string;
  improvements_year: string;
  disposals_cost: string;
  cost_end: string;
  accumulated_start: string;
  depreciation_year: string;
  disposals_accumulated: string;
  accumulated_end: string;
  value_adjustments: string;
  net_book_value_end: string;
}

export interface AssetRegisterTotals {
  cost_start: string;
  additions: string;
  improvements_year: string;
  disposals_cost: string;
  cost_end: string;
  accumulated_start: string;
  depreciation_year: string;
  disposals_accumulated: string;
  accumulated_end: string;
  value_adjustments: string;
  net_book_value_end: string;
}

export interface AssetRegisterPaginatedResponse {
  success?: boolean;
  data: AssetRegisterRow[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    year: number;
    ledger_type: string;
    compliance_header?: AssetRegisterComplianceHeader;
    category_subtotals?: AssetRegisterCategorySubtotal[];
    totals?: AssetRegisterTotals;
  };
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

/** `POST /eam/maintenance/work-orders`: ad-hoc (not plan-generated) maintenance work order. */
export interface CreateMaintenanceWorkOrderPayload {
  asset_id: string;
  plan_id?: string | null;
  maintenance_type?: 'preventive' | 'corrective' | 'condition_based' | 'emergency' | 'upgrade' | null;
  priority?: 'low' | 'medium' | 'high' | 'critical' | null;
  scheduled_date?: string | null;
  assigned_technician_id?: string | null;
  problem_description?: string | null;
  estimated_cost?: number | null;
}
