/** Wire models of `/api/v1/mrp` (Mod 063: MRP I & II). Decimal quantities travel as strings, dates as `YYYY-MM-DD`. */

export type MrpRunStatus = 'Pending' | 'Running' | 'Completed' | 'Failed';
export type MrpRunMode = 'RegenerativeFull' | 'NetChange';
export type MrpCapacityMode = 'InfiniteCapacity' | 'FiniteCapacityConstraint';
export type MrpSchedulingDirection = 'BackwardFromDueDate' | 'ForwardFromToday';

export type MrpProposalType =
  | 'PlannedPurchaseRequisition'
  | 'PlannedProductionOrder'
  | 'PlannedSubcontractOrder'
  | 'RescheduleIn_Expedite'
  | 'RescheduleOut_Defer'
  | 'CancelExcessOrder';

export type MrpProposalStatus = 'Proposed' | 'Firm' | 'Released' | 'Dismissed';

export type MrpExceptionCode =
  | 'Expedite'
  | 'Defer'
  | 'PastDueRelease'
  | 'BelowSafetyStock'
  | 'CapacityOverload'
  | 'HolidayShiftApplied'
  | 'CustomsLeadTimeApplied'
  | 'LateDelivery'
  | 'ExcessSupply';

export type MrpDemandSourceType =
  | 'mps_line'
  | 'sales_order_line'
  | 'safety_stock'
  | 'allocated_stock'
  | 'production_order'
  | 'mrp_proposal';

export type MrpProposalAction = 'firm' | 'release' | 'dismiss';

export interface MrpEnvelope<T, M = undefined> {
  success: boolean;
  message: string;
  data: T;
  meta?: M;
}

export interface MrpPageMeta {
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
}

export interface MrpRunSummaryMetrics {
  items_planned: number;
  max_low_level_code: number;
  proposals_total: number;
  proposals_by_type: Record<string, number>;
  exceptions_by_code: Record<string, number>;
  overloaded_buckets: number;
  max_load_percentage: number | string;
  kept_proposals: number;
  firm_carried_over: number;
}

export interface MrpRun {
  id: string;
  run_code: string;
  status: MrpRunStatus;
  run_mode: MrpRunMode;
  planning_horizon_days: number;
  capacity_scheduling_mode: MrpCapacityMode;
  scheduling_direction: MrpSchedulingDirection;
  include_cross_border_customs_lead_time: boolean;
  apply_supplier_shutdown_calendars: boolean;
  started_at: string | null;
  completed_at: string | null;
  execution_duration_ms: number | null;
  summary_metrics: MrpRunSummaryMetrics | null;
  error_message: string | null;
}

export interface MrpRunKpis {
  proposals_total: number;
  by_type: Record<string, number>;
  by_status: Record<string, number>;
  by_exception: Record<string, number>;
  capacity_buckets: number;
  overloaded_buckets: number;
  overloaded_work_centers: number;
  max_load_percentage: number | string;
  execution_duration_ms: number | null;
}

export interface MrpRunDetail {
  run: MrpRun;
  kpis: MrpRunKpis;
}

export interface MrpRunPayload {
  planning_horizon_days: number;
  run_mode?: MrpRunMode;
  capacity_scheduling_mode?: MrpCapacityMode;
  scheduling_direction?: MrpSchedulingDirection;
  include_cross_border_customs_lead_time?: boolean;
  apply_supplier_shutdown_calendars?: boolean;
}

export interface MrpPeggedDemand {
  type: MrpDemandSourceType;
  id: string;
  quantity: string;
}

export interface MrpProposal {
  id: string;
  mrp_run_id: string;
  product_id: string | null;
  mfg_item_id: string | null;
  item_code: string;
  item_name: string;
  bom_version_id: string | null;
  work_center_id: string | null;
  low_level_code: number;
  proposal_type: MrpProposalType;
  status: MrpProposalStatus;
  gross_requirement_qty: string;
  projected_on_hand_qty: string;
  net_requirement_qty: string;
  required_qty: string;
  suggested_order_qty: string;
  need_by_date: string | null;
  release_order_by_date: string | null;
  planned_start_at: string | null;
  planned_end_at: string | null;
  pegged_demand_source_ids: MrpPeggedDemand[];
  exception_messages: MrpExceptionCode[];
  supply_reference: string | null;
  firm_reference_type: string | null;
  firm_reference_id: string | null;
  firmed_at: string | null;
  released_at: string | null;
}

export type MrpProposalSortBy =
  | 'need_by_date'
  | 'release_order_by_date'
  | 'suggested_order_qty'
  | 'net_requirement_qty'
  | 'gross_requirement_qty'
  | 'proposal_type'
  | 'status'
  | 'low_level_code'
  | 'created_at';

export interface MrpProposalFilters {
  runId: string | null;
  proposalType: MrpProposalType | null;
  status: MrpProposalStatus | null;
  exceptionCode: MrpExceptionCode | null;
  itemId: string | null;
  workCenterId: string | null;
  needByFrom: string | null;
  needByTo: string | null;
  sortBy: MrpProposalSortBy;
  sortDirection: 'asc' | 'desc';
  page: number;
  perPage: number;
}

export interface MrpProposalActionResult {
  action: MrpProposalAction;
  processed: number;
  purchase_requisition_ids: string[];
  production_order_ids: string[];
  proposals: MrpProposal[];
}

export interface MrpPeggingNode {
  id: string;
  item_id: string | null;
  item_code: string;
  item_name: string;
  proposal_type: MrpProposalType;
  status: MrpProposalStatus;
  quantity: string;
  need_by_date: string | null;
}

export interface MrpPeggingUpstream {
  type: MrpDemandSourceType;
  id: string;
  quantity: string;
  proposal: MrpPeggingNode | null;
  upstream: MrpPeggingUpstream[];
}

export interface MrpPeggingDownstream extends MrpPeggingNode {
  children: MrpPeggingDownstream[];
}

export interface MrpPegging {
  proposal: MrpPeggingNode;
  upstream: MrpPeggingUpstream[];
  downstream: MrpPeggingDownstream[];
  root_demands: MrpPeggedDemand[];
}

export interface MrpGanttSegment {
  date: string;
  minutes: number;
}

export interface MrpGanttBucket {
  bucket_date: string;
  shift_code: string | null;
  available_minutes: number;
  loaded_minutes: number;
  load_percentage: string | number;
  is_overloaded: boolean;
  assigned_proposal_ids: string[];
}

export interface MrpGanttBlock {
  id: string;
  proposal_id: string;
  item_code: string;
  item_name: string;
  proposal_status: MrpProposalStatus;
  exception_messages: MrpExceptionCode[];
  operation_sequence: number | null;
  start_date: string;
  end_date: string;
  minutes: number;
  segments: MrpGanttSegment[];
  is_manual: boolean;
  original_work_center_id: string | null;
}

export interface MrpGanttWorkCenter {
  id: string;
  code: string;
  name: string;
  alternative_work_center_ids: string[];
  buckets: MrpGanttBucket[];
  blocks: MrpGanttBlock[];
}

export interface MrpGantt {
  run_id: string;
  from: string;
  to: string;
  work_centers: MrpGanttWorkCenter[];
}

export interface MrpGanttQuery {
  from: string;
  to: string;
  workCenterIds?: string[];
}

export interface MrpAutoLevelResult {
  run: MrpRun;
  overloaded_buckets_before: number;
  overloaded_buckets_after: number;
  leveled_proposals: number;
}

export interface MrpReschedulePayload {
  start_date?: string;
  end_date?: string;
  work_center_id?: string;
}

export interface MrpRescheduleResult {
  block: {
    id: string;
    mrp_run_id: string;
    proposal_id: string;
    work_center_id: string;
    original_work_center_id: string | null;
    operation_sequence: number | null;
    start_date: string;
    end_date: string;
    minutes: number;
    segments: MrpGanttSegment[];
    is_manual: boolean;
  };
  proposal: MrpProposal;
  capacity: { overloaded_buckets: number; max_load_percentage: number | string; buckets: MrpGanttBucket[] };
}
