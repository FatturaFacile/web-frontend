import { QueryFilterParams } from './api.models';

/** Physical inventory, ABC cycle counting and variance reconciliation (Mod 058, FatturaFacile#159). */

export type CountAbcClass = 'A' | 'B' | 'C';
export const COUNT_ABC_CLASSES: readonly CountAbcClass[] = ['A', 'B', 'C'];

export type CountApprovalMode = 'workflow' | 'multi_level';
export const COUNT_APPROVAL_MODES: readonly CountApprovalMode[] = ['workflow', 'multi_level'];

export type CountType = 'full_physical' | 'cycle_count_abc' | 'spot_check' | 'zone_sweep';
export const COUNT_TYPES: readonly CountType[] = ['full_physical', 'cycle_count_abc', 'spot_check', 'zone_sweep'];

export type CountSessionStatus = 'in_progress' | 'pending_approval' | 'reconciled' | 'cancelled';
export const COUNT_SESSION_STATUSES: readonly CountSessionStatus[] = [
  'in_progress',
  'pending_approval',
  'reconciled',
  'cancelled',
];

export type CountApprovalStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';
export type CountApprovalLevel = 1 | 2;
export type CycleCadence = 'monthly' | 'quarterly' | 'semi_annual' | 'annual' | 'custom';

/** `GET/PUT inventory/count-policy`. */
export interface CountPolicy {
  is_default?: boolean;
  abc_a_share: number;
  abc_b_share: number;
  abc_period_days: number;
  interval_days_a: number;
  interval_days_b: number;
  interval_days_c: number;
  new_item_class: CountAbcClass;
  blind_by_default: boolean;
  reveal_first_count_on_recount: boolean;
  recount_threshold_percent: number | null;
  recount_threshold_value: number | null;
  max_recount_rounds: number;
  approval_mode: CountApprovalMode;
  auto_approve_within_tolerance: boolean;
  level1_threshold_percent: number | null;
  level1_threshold_value: number | null;
  level2_threshold_percent: number | null;
  level2_threshold_value: number | null;
  enforce_segregation_of_duties: boolean;
  inventory_account_code: string | null;
  gain_account_code: string | null;
  loss_account_code: string | null;
  cadence_a?: CycleCadence;
  cadence_b?: CycleCadence;
  cadence_c?: CycleCadence;
}

export type CountPolicyPayload = Partial<Omit<CountPolicy, 'is_default' | 'cadence_a' | 'cadence_b' | 'cadence_c'>>;

export interface AbcRunItem {
  stock_item_id: string;
  sku: string;
  name: string;
  rank: number;
  consumption_value: number | string;
  cumulative_share: number | string;
  abc_class: CountAbcClass;
  previous_class: CountAbcClass | null;
  is_manual_override: boolean;
  is_new_item: boolean;
}

export interface AbcRun {
  id: string;
  warehouse_id: string | null;
  period_days: number;
  a_share: number | string;
  b_share: number | string;
  period_start: string;
  period_end: string;
  total_consumption_value: number | string;
  item_count: number;
  class_a_count: number;
  class_b_count: number;
  class_c_count: number;
  applied: boolean;
  created_at?: string;
  items?: AbcRunItem[];
}

export interface AbcRunPayload {
  period_days?: number;
  a_share?: number;
  b_share?: number;
  warehouse_id?: string;
  apply?: boolean;
}

export interface AbcOverride {
  id: string;
  stock_item_id: string;
  sku?: string | null;
  name?: string | null;
  abc_class: CountAbcClass | null;
  previous_class?: CountAbcClass | null;
  reason: string;
  user_id?: string | null;
  created_at?: string;
}

export interface AbcOverridePayload {
  stock_item_id: string;
  abc_class: CountAbcClass | null;
  reason: string;
}

export interface CycleCountPlan {
  id: string;
  warehouse_id: string;
  warehouse_zone_id: string | null;
  name: string;
  abc_class: CountAbcClass | null;
  cadence: CycleCadence;
  interval_days: number;
  freezes_stock: boolean;
  is_active: boolean;
  last_run_at: string | null;
  next_run_on: string | null;
}

export interface CycleCountPlanPayload {
  warehouse_id?: string;
  name?: string;
  abc_class?: CountAbcClass | null;
  interval_days?: number;
  freezes_stock?: boolean;
  is_active?: boolean;
  warehouse_zone_id?: string | null;
}

export interface GenerateCyclePlansPayload {
  warehouse_id: string;
  warehouse_zone_id?: string;
  freezes_stock?: boolean;
}

export interface CountSession {
  id: string;
  session_number: string;
  warehouse_id: string;
  warehouse_zone_id: string | null;
  count_type: CountType;
  status: CountSessionStatus;
  scheduled_date: string | null;
  snapshot_at: string | null;
  is_blind: boolean;
  freezes_stock: boolean;
  freeze_scope?: string | null;
  frozen_at: string | null;
  assigned_to: string | null;
  inventory_adjustment_id: string | null;
  approval_mode?: CountApprovalMode | null;
  approval_level_required?: number | null;
  approved_by?: string | null;
  approved_at?: string | null;
  lines_count?: number;
  counted_lines_count?: number;
  lines?: CountSheetLine[];
}

export interface CountSessionFilterParams extends QueryFilterParams {
  warehouse_id?: string;
  status?: CountSessionStatus;
}

export interface CreateCountSessionPayload {
  warehouse_id: string;
  count_type: CountType;
  scheduled_date: string;
  freezes_stock?: boolean;
  is_blind?: boolean;
  assigned_to?: string;
  warehouse_zone_id?: string;
  bin_ids?: string[];
  notes?: string;
}

/** Sheet line of a count; never carries system figures when the session is blind. */
export interface CountSheetLine {
  id: string;
  warehouse_bin_id: string;
  bin_barcode: string | null;
  stock_item_id: string;
  sku: string;
  item_name: string;
  barcode: string | null;
  lot_id: string | null;
  counted_quantity: number | string | null;
  is_counted: boolean;
  recount_required: boolean;
  recount_round: number;
  recount_reason: string | null;
  notes: string | null;
  counted_at: string | null;
}

export interface CountSheet {
  session: CountSession;
  data: CountSheetLine[];
}

export interface VarianceLine extends CountSheetLine {
  system_quantity: number | string;
  unit_cost: number | string;
  system_value: number | string;
  first_counted_quantity: number | string | null;
  final_quantity: number | string | null;
  variance_quantity: number | string;
  variance_value: number | string;
  variance_percentage: number | string | null;
  variance_percentage_undefined: boolean;
}

export interface VarianceSummary {
  lines: number;
  counted_lines: number;
  uncounted_lines: number;
  differing_lines: number;
  recount_pending_lines: number;
  system_value_total: number | string;
  gross_variance_value: number | string;
  net_variance_value: number | string;
  approval_mode: CountApprovalMode;
  suggested_approval_level: number | null;
  within_tolerance: boolean;
}

export interface CountApproval {
  id: string;
  level: number;
  required_role: string | null;
  status: CountApprovalStatus;
  decided_by: string | null;
  decided_at: string | null;
  notes: string | null;
}

export interface CountAdjustmentRef {
  id: string;
  adjustment_number: string;
  status: string;
  net_valuation_change: number | string;
  journal_entry_id: string | null;
  gl_posted_at: string | null;
}

export interface CountVariance {
  session: CountSession;
  summary: VarianceSummary;
  lines: VarianceLine[];
  approvals: CountApproval[];
  adjustment: CountAdjustmentRef | null;
}

export interface CountEvent {
  id: string;
  event: string;
  user_id: string | null;
  payload: Record<string, unknown> | null;
  created_at: string;
}

export interface AssignCountPayload {
  assigned_to: string | null;
}
