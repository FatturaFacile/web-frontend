/** Production engineering (Mod 061): work centres, machines, working calendars, routings and OEE. Decimals are strings. */

export type MfgWorkCenterStatus = 'active' | 'maintenance' | 'inactive' | 'decommissioned';
export type MfgOperationType = 'internal_machining' | 'manual_assembly' | 'external_subcontracting';
export type MfgCalendarDayType = 'working_shift' | 'holiday' | 'non_working_weekend' | 'planned_shutdown';
export type MfgOeeGranularity = 'real_time' | 'shift' | 'daily' | 'weekly' | 'monthly';
export type MfgOeeLossCategory =
  | 'equipment_failure'
  | 'setup_adjustment'
  | 'minor_stops'
  | 'reduced_speed'
  | 'process_defects'
  | 'startup_rejects';

export interface MfgWorkCenterDetail {
  id: string;
  work_center_code: string;
  name: string;
  description?: string | null;
  department_code?: string | null;
  capacity_hours_per_day: string;
  efficiency_rate: string;
  availability_rate: string;
  hourly_cost_rate: string;
  hourly_overhead_rate: string;
  status: MfgWorkCenterStatus;
  warehouse_id?: string | null;
  cost_center_id?: string | null;
  working_calendar_id?: string | null;
  parent_work_center_id?: string | null;
  parallel_capacity_units: number;
  oee_target_percent: string;
  availability_target_percent?: string | null;
  performance_target_percent?: string | null;
  quality_target_percent?: string | null;
  hourly_setup_cost_rate: string;
  hourly_machine_run_cost_rate: string;
  currency_code: string;
  default_queue_wait_minutes: number;
  default_move_time_minutes: number;
  alternate_work_center_ids: string[];
}

/** Body of POST / PUT work-centres (every field but code and name is optional). */
export interface SaveWorkCenterPayload {
  work_center_code?: string;
  name?: string;
  description?: string | null;
  department_code?: string | null;
  capacity_hours_per_day?: number;
  efficiency_rate?: number;
  availability_rate?: number;
  hourly_cost_rate?: number;
  hourly_overhead_rate?: number;
  status?: MfgWorkCenterStatus;
  cost_center_id?: string | null;
  working_calendar_id?: string | null;
  parent_work_center_id?: string | null;
  parallel_capacity_units?: number;
  oee_target_percent?: number;
  availability_target_percent?: number | null;
  performance_target_percent?: number | null;
  quality_target_percent?: number | null;
  hourly_setup_cost_rate?: number;
  hourly_machine_run_cost_rate?: number;
  currency_code?: string;
  default_queue_wait_minutes?: number;
  default_move_time_minutes?: number;
  alternate_work_center_ids?: string[];
}

export interface MfgMachineDetail {
  id: string;
  machine_code: string;
  name: string;
  work_center_id: string;
  manufacturer?: string | null;
  model?: string | null;
  serial_number?: string | null;
  is_industria_40_enabled: boolean;
  is_transizione_50_enabled: boolean;
  telemetry_device_id?: string | null;
  has_telemetry_endpoint_key: boolean;
  telemetry_status?: string | null;
  telemetry_last_seen_at?: string | null;
  ideal_cycle_time_seconds_per_unit?: string | null;
  parallel_capacity_units: number;
  efficiency_factor_percent?: string | null;
  hourly_machine_run_cost_rate_override?: string | null;
  status: MfgWorkCenterStatus;
}

export interface SaveMachinePayload {
  machine_code?: string;
  name?: string;
  work_center_id?: string;
  manufacturer?: string | null;
  model?: string | null;
  serial_number?: string | null;
  is_industria_40_enabled?: boolean;
  is_transizione_50_enabled?: boolean;
  telemetry_device_id?: string | null;
  ideal_cycle_time_seconds_per_unit?: number | null;
  parallel_capacity_units?: number;
  efficiency_factor_percent?: number | null;
  hourly_machine_run_cost_rate_override?: number | null;
  status?: MfgWorkCenterStatus;
}

export interface MfgCalendarShift {
  day_of_week: number;
  shift_code: string;
  start_time: string;
  end_time: string;
  crosses_midnight?: boolean;
  break_minutes?: number | null;
  net_available_minutes?: number;
  labor_multiplier?: string | null;
}

export interface MfgCalendarClosure {
  starts_on: string;
  ends_on: string;
  reason?: string | null;
}

export interface MfgWorkingCalendarDetail {
  id: string;
  code: string;
  name: string;
  timezone: string;
  country_code: string;
  region_code?: string | null;
  inherit_holiday_calendar_id?: string | null;
  is_default: boolean;
  shifts?: MfgCalendarShift[];
  closures?: MfgCalendarClosure[];
}

export interface SaveWorkingCalendarPayload {
  code?: string;
  name?: string;
  timezone?: string;
  country_code?: string;
  region_code?: string | null;
  is_default?: boolean;
  shifts?: MfgCalendarShift[];
  closures?: MfgCalendarClosure[];
}

export interface MfgCalendarPreviewShift {
  shift_code: string;
  start_at: string;
  end_at: string;
  net_minutes: number;
  labor_multiplier: string | null;
}

export interface MfgCalendarPreviewDay {
  date: string;
  day_type: MfgCalendarDayType;
  label: string | null;
  available_minutes: number;
  shifts: MfgCalendarPreviewShift[];
}

export interface MfgOperationBomLink {
  bom_component_id: string;
  backflush_on_completion?: boolean;
  notes?: string | null;
}

/** An operation of a routing, as returned by the API and as sent back on save. */
export interface MfgRoutingOperationDetail {
  id?: string;
  sequence?: number | null;
  operation_code: string;
  name: string;
  description?: string | null;
  work_center_id: string;
  machine_center_id?: string | null;
  setup_time_minutes?: number | string | null;
  run_time_minutes_per_unit?: number | string | null;
  labor_time_minutes_per_unit?: number | string | null;
  queue_time_minutes?: number | string | null;
  post_operation_wait_minutes?: number | string | null;
  move_time_minutes?: number | string | null;
  overlap_transfer_batch_qty?: number | string | null;
  required_operators?: number | null;
  operation_type?: MfgOperationType | null;
  is_subcontracted?: boolean;
  subcontract_unit_cost?: number | string | null;
  alternate_work_center_ids?: string[];
  linked_quality_control_point_id?: string | null;
  work_instruction_doc_id?: string | null;
  bom_components?: MfgOperationBomLink[];
}

export interface MfgRoutingDetail {
  id: string;
  routing_number: string;
  mfg_item_id: string;
  item_code?: string;
  item_name?: string;
  name: string;
  revision: string;
  status: string;
  is_default: boolean;
  bom_id?: string | null;
  notes?: string | null;
  operations_count?: number;
  operations?: MfgRoutingOperationDetail[];
}

export interface SaveRoutingPayload {
  mfg_item_id?: string;
  bom_id?: string | null;
  name?: string;
  revision?: string | null;
  status?: 'draft' | 'active' | 'obsolete';
  is_default?: boolean;
  notes?: string | null;
  operations?: MfgRoutingOperationDetail[];
}

export interface CalculateRoutingPayload {
  quantity?: number;
  include_overlap?: boolean;
  start_datetime?: string | null;
}

export interface MfgRoutingStepResult {
  operation_id: string;
  operation_seq: number;
  operation_code: string;
  operation_type: MfgOperationType;
  work_center_id: string;
  queue_minutes: string | number;
  setup_minutes: string | number;
  run_minutes: string | number;
  post_operation_wait_minutes: string | number;
  move_minutes: string | number;
  duration_minutes: string | number;
  start_offset_minutes: string | number;
  end_offset_minutes: string | number;
  overlap_applied: boolean;
  start_at?: string | null;
  end_at?: string | null;
  cost?: unknown;
}

export interface MfgRoutingCostBreakdown {
  total: string | number;
  unit: string | number;
  setup: string | number;
  machine_run: string | number;
  direct_labor: string | number;
  overhead: string | number;
  subcontracting: string | number;
  material: string | number;
}

export interface MfgRoutingSimulation {
  routing_id: string;
  quantity: string | number;
  include_overlap: boolean;
  lead_time: {
    total_minutes: string | number;
    serial_minutes: string | number;
    overlap_saving_minutes: string | number;
    calendar: { start_at: string; finish_at: string; elapsed_minutes: number } | null;
  };
  steps: MfgRoutingStepResult[];
  cost: MfgRoutingCostBreakdown;
}

export interface MfgOeeQuery {
  work_center_id?: string;
  machine_center_id?: string;
  from_datetime: string;
  to_datetime: string;
  granularity?: MfgOeeGranularity;
}

export interface MfgOeeMetrics {
  scheduled_minutes: number;
  planned_production_minutes: number;
  unplanned_downtime_minutes: number;
  operating_minutes: number;
  good_units: number;
  scrap_units: number;
  rework_units: number;
  total_units: number;
  availability_percent: number;
  performance_percent: number;
  quality_percent: number;
  oee_percent: number;
}

export interface MfgOeeSeriesPoint extends Partial<MfgOeeMetrics> {
  from: string;
  to: string;
}

export interface MfgOeeTelemetryRow {
  machine_center_id: string;
  machine_code: string;
  industria_40: boolean;
  transizione_50: boolean;
  telemetry_status: string;
  telemetry_last_seen_at: string | null;
}

export interface MfgOeeResult {
  work_center_id: string;
  machine_center_id: string | null;
  from: string;
  to: string;
  granularity: string;
  summary: MfgOeeMetrics;
  targets_percent: { oee: number; availability: number | null; performance: number | null; quality: number | null };
  meets_target: boolean;
  gap_to_target_percent: number;
  six_big_losses: Record<MfgOeeLossCategory, { minutes: number; factor: string }>;
  series?: MfgOeeSeriesPoint[];
  machines: MfgOeeTelemetryRow[];
}
