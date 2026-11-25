/** Product lifecycle management (Mod 168). Mirrors the API FormRequests, CQRS payloads, and resources of the PLM module. */

export type PlmChangeStatus = 'draft' | 'in_review' | 'approved' | 'rejected' | 'implemented' | 'cancelled';
export type PlmChangeType = 'design' | 'material' | 'process' | 'documentation';
export type PlmPriority = 'low' | 'normal' | 'high' | 'critical';
export type PlmApprovalStatus = 'pending' | 'approved' | 'rejected';
export type PlmRevisionStatus = 'draft' | 'released' | 'obsolete';
export type PlmDecision = 'approve' | 'reject';

export type PlmLifecycleState =
  | 'InDesign_Prototype'
  | 'UnderReview'
  | 'ReleasedForProduction'
  | 'PhaseOut_UseUpStock'
  | 'ObsoleteBlocked';

export type PlmEcoWorkflowStage =
  | 'Draft'
  | 'EcrSubmitted'
  | 'UnderEvaluation'
  | 'EcoApproved'
  | 'EcnReleased'
  | 'Closed'
  | 'Rejected'
  | 'Cancelled';

export type PlmChangeReason =
  | 'CostReduction'
  | 'QualitySafetyFix'
  | 'ComponentObsolescence'
  | 'CustomerRequest'
  | 'RegulatoryCompliance'
  | 'ManufacturingOptimization';

export type PlmStockDispositionRule =
  | 'UseUp_EsaurimentoScorte'
  | 'ReworkInHouse'
  | 'ScrapImmediately';

export type PlmApprovalDepartment = 'Engineering' | 'Quality' | 'Purchasing' | 'Production';

export type PlmCadSourceSystem =
  | 'SolidWorks'
  | 'Inventor'
  | 'Creo'
  | 'NX'
  | 'Eplan'
  | 'Altium'
  | 'GenericXmlCsvStep';

export const PLM_CHANGE_STATUSES: readonly PlmChangeStatus[] = ['draft', 'in_review', 'approved', 'rejected', 'implemented', 'cancelled'];
export const PLM_CHANGE_TYPES: readonly PlmChangeType[] = ['design', 'material', 'process', 'documentation'];
export const PLM_PRIORITIES: readonly PlmPriority[] = ['low', 'normal', 'high', 'critical'];
export const PLM_REVISION_STATUSES: readonly PlmRevisionStatus[] = ['draft', 'released', 'obsolete'];
export const PLM_LIFECYCLE_STATES: readonly PlmLifecycleState[] = [
  'InDesign_Prototype',
  'UnderReview',
  'ReleasedForProduction',
  'PhaseOut_UseUpStock',
  'ObsoleteBlocked',
];
export const PLM_WORKFLOW_STAGES: readonly PlmEcoWorkflowStage[] = [
  'Draft',
  'EcrSubmitted',
  'UnderEvaluation',
  'EcoApproved',
  'EcnReleased',
  'Closed',
  'Rejected',
  'Cancelled',
];
export const PLM_CHANGE_REASONS: readonly PlmChangeReason[] = [
  'CostReduction',
  'QualitySafetyFix',
  'ComponentObsolescence',
  'CustomerRequest',
  'RegulatoryCompliance',
  'ManufacturingOptimization',
];
export const PLM_STOCK_DISPOSITION_RULES: readonly PlmStockDispositionRule[] = [
  'UseUp_EsaurimentoScorte',
  'ReworkInHouse',
  'ScrapImmediately',
];
export const PLM_APPROVAL_DEPARTMENTS: readonly PlmApprovalDepartment[] = [
  'Engineering',
  'Quality',
  'Purchasing',
  'Production',
];
export const PLM_CAD_SOURCE_SYSTEMS: readonly PlmCadSourceSystem[] = [
  'SolidWorks',
  'Inventor',
  'Creo',
  'NX',
  'Eplan',
  'Altium',
  'GenericXmlCsvStep',
];

export interface PlmCadAttachment {
  id: string;
  filename: string;
  format: 'PDF' | 'DXF' | 'STEP' | 'STL';
  version?: string;
  storage_path?: string;
}

export interface PlmDepartmentSignoff {
  department: PlmApprovalDepartment;
  status: 'pending' | 'approved' | 'rejected';
  actor_id: string | null;
  actor_role?: string | null;
  decided_at: string | null;
  comment?: string | null;
  sign_off_hash: string | null;
}

export interface PlmApproval {
  id: string;
  approver_id: string;
  approver_name: string | null;
  sequence: number;
  status: PlmApprovalStatus;
  department?: PlmApprovalDepartment | null;
  actor_role?: string | null;
  sign_off_hash?: string | null;
  decided_at: string | null;
  comment: string | null;
}

export interface PlmAffectedItem {
  id: string;
  mfg_item_id: string;
  item_code: string | null;
  item_name: string | null;
  to_revision: string;
  change_summary: string | null;
  disposition_rule?: PlmStockDispositionRule | null;
  cutover_mode?: string | null;
  effective_date?: string | null;
  lot_serial_cutover?: string | null;
  quarantined_lots_count?: number;
  mes_drawings_obsoleted_count?: number;
}

export interface PlmAffectedBom {
  id: string;
  bom_id: string;
  bom_number: string | null;
  bom_name: string | null;
  bom_revision: string | null;
  bom_status: string | null;
  note: string | null;
}

export interface PlmChangeOrder {
  id: string;
  code: string;
  title: string;
  reason: string;
  change_type: PlmChangeType;
  priority: PlmPriority;
  status: PlmChangeStatus;
  workflow_stage?: PlmEcoWorkflowStage;
  change_reason?: PlmChangeReason;
  is_safety_immediate_cutover?: boolean;
  existing_stock_disposition_rule?: PlmStockDispositionRule;
  effective_date_or_lot_cutover?: string | null;
  lot_serial_cutover_code?: string | null;
  approvals_matrix_json?: Record<string, PlmDepartmentSignoff> | null;
  ecn_number?: string | null;
  ecn_released_at?: string | null;
  cutover_summary_json?: Record<string, unknown> | null;
  requested_by: string | null;
  effective_date: string | null;
  submitted_at: string | null;
  decided_at: string | null;
  implemented_at: string | null;
  rejection_reason: string | null;
  notes: string | null;
  approvals?: PlmApproval[];
  affected_items?: PlmAffectedItem[];
  affected_boms?: PlmAffectedBom[];
}

export interface PlmChangeOrderRequest {
  code: string;
  title: string;
  reason: string;
  change_type?: PlmChangeType;
  priority?: PlmPriority;
  change_reason?: PlmChangeReason;
  is_safety_immediate_cutover?: boolean;
  existing_stock_disposition_rule?: PlmStockDispositionRule;
  effective_date_or_lot_cutover?: string | null;
  lot_serial_cutover_code?: string | null;
  effective_date?: string | null;
  notes?: string | null;
  approvers?: string[];
  affected_items?: {
    mfg_item_id: string;
    to_revision: string;
    change_summary?: string | null;
    disposition_rule?: PlmStockDispositionRule | null;
    cutover_mode?: string | null;
    lot_serial_cutover?: string | null;
  }[];
  affected_boms?: { bom_id: string; note?: string | null }[];
}

export interface PlmChangeOrderFilters {
  status?: PlmChangeStatus;
  priority?: PlmPriority;
  change_type?: PlmChangeType;
  search?: string;
  awaiting_me?: boolean;
  per_page?: number;
}

export interface PlmDecisionRequest {
  decision: PlmDecision;
  comment?: string | null;
}

export interface PlmDepartmentSignoffRequest {
  department: PlmApprovalDepartment;
  decision: PlmDecision;
  comment?: string | null;
  actor_role?: string | null;
}

export interface PlmItemRevision {
  id: string;
  mfg_item_id: string;
  item?: { id: string; item_code: string; name: string } | null;
  revision: string;
  status: PlmRevisionStatus;
  lifecycle_state?: PlmLifecycleState;
  parent_revision_id?: string | null;
  engineering_part_number?: string | null;
  description?: string | null;
  ebom_structure_json?: { source?: string; parts?: Record<string, unknown>[] } | null;
  mbom_id?: string | null;
  routing_id?: string | null;
  cad_drawing_pdf_and_step_file_ids?: PlmCadAttachment[];
  rohs_and_reach_compliant?: boolean;
  conflict_minerals_compliant?: boolean;
  technical_file_ref?: string | null;
  mes_drawing_obsolete_watermark?: boolean;
  superseded_by_revision_id?: string | null;
  change_summary: string | null;
  change_order_id: string | null;
  effective_from: string | null;
  released_at: string | null;
  obsoleted_at: string | null;
}

export interface PlmItemRevisionRequest {
  mfg_item_id?: string;
  revision: string;
  engineering_part_number?: string | null;
  description?: string | null;
  lifecycle_state?: PlmLifecycleState;
  mbom_id?: string | null;
  routing_id?: string | null;
  rohs_and_reach_compliant?: boolean;
  conflict_minerals_compliant?: boolean;
  technical_file_ref?: string | null;
  change_summary?: string | null;
  effective_from?: string | null;
}

export interface PlmItemRevisionFilters {
  mfg_item_id?: string;
  status?: PlmRevisionStatus;
  per_page?: number;
}

export interface PlmBomDiffNode {
  key: string;
  level: number;
  component_item_id: string | null;
  item_code: string;
  item_name: string;
  uom: string;
  quantity: string;
  unit_cost: string;
  extended_cost: string;
  path: string[];
  status: 'added' | 'removed' | 'modified' | 'unchanged';
  color: 'green' | 'red' | 'yellow' | 'default';
  before_quantity: string | null;
  after_quantity: string | null;
  before_extended_cost: string;
  after_extended_cost: string;
  cost_delta: string;
}

export interface PlmBomDiffCostRollupResult {
  from_bom_id: string | null;
  to_bom_id: string | null;
  from_label: string;
  to_label: string;
  nodes: PlmBomDiffNode[];
  added: PlmBomDiffNode[];
  removed: PlmBomDiffNode[];
  modified: PlmBomDiffNode[];
  summary: { added: number; removed: number; modified: number; unchanged: number };
  cost_rollup: {
    before_total_cost: string;
    after_total_cost: string;
    cost_delta: string;
    cost_delta_percentage: string;
  };
}

export interface PlmCadImportRequest {
  cad_source_system: PlmCadSourceSystem;
  product_code: string;
  revision_code?: string;
  bom_name?: string | null;
  raw_payload?: string | null;
  payload_format?: 'xml' | 'csv' | 'step' | 'stp' | null;
  parts?: {
    item_code: string;
    name?: string;
    quantity: number | string;
    uom?: string;
    unit_cost?: number | string;
    level?: number;
    drawing_number?: string | null;
  }[];
  source_file_metadata?: Record<string, unknown>;
  cad_attachments?: PlmCadAttachment[];
  auto_create_missing_parts?: boolean;
  commit_to_mbom?: boolean;
}

export interface PlmCadImportSession {
  id: string;
  session_code: string;
  product_id: string | null;
  product?: { id: string; item_code: string; name: string } | null;
  target_revision_id: string | null;
  target_mbom_id: string | null;
  cad_source_system: PlmCadSourceSystem;
  source_file_metadata: Record<string, unknown>;
  parsed_part_list_json: Record<string, unknown>[];
  new_parts_to_create_count: number;
  created_parts_json: Record<string, unknown>[];
  changed_quantities_diff_list: PlmBomDiffNode[];
  removed_parts_list: PlmBomDiffNode[];
  side_by_side_diff_json: PlmBomDiffCostRollupResult | null;
  cost_rollup_comparison_json: PlmBomDiffCostRollupResult['cost_rollup'] | null;
  validation_warnings_json: string[];
  status: 'Parsed' | 'Reviewed' | 'Committed' | 'Failed';
  committed_at: string | null;
  created_at: string | null;
}

export interface PlmWhereUsedImpactResult {
  item_id: string;
  item_code: string;
  item_name: string;
  date: string;
  parents: {
    level: number;
    parent_item_id: string;
    parent_item_code: string;
    parent_item_name: string;
    parent_item_type: string;
    bom_id: string;
    bom_number: string;
    revision: string;
    quantity_per: string;
    cumulative_coefficient: string;
    is_top_level: boolean;
    path: string[];
  }[];
  top_level: { item_id: string; item_code: string; item_name: string; cumulative_coefficient: string }[];
  open_purchase_orders: {
    purchase_order_id: string;
    order_number: string;
    status: string;
    item_code: string | null;
    item_name: string | null;
    open_quantity: string;
    delivery_due_date: string | null;
  }[];
  open_production_orders: {
    production_order_id: string;
    order_number: string;
    status: string;
    item_code: string | null;
    item_name: string | null;
    target_quantity: string;
    remaining_quantity: string;
    planned_end_date: string | null;
  }[];
  warehouse_stock_lots: {
    stock_quant_id: string;
    mfg_item_id: string | null;
    item_code: string | null;
    item_name: string | null;
    lot_id: string | null;
    lot_code: string | null;
    is_quarantined: boolean;
    quantity_on_hand: string;
    quantity_reserved: string;
    quantity_available: string;
  }[];
}

export interface PlmRegulatoryComplianceResult {
  strategy_code: string;
  regulations: string[];
  overall_compliant: boolean;
  rohs_compliant: boolean;
  reach_compliant: boolean;
  conflict_minerals_compliant: boolean;
  omacch_mra_ch_eu_compliant: boolean;
  bom_components_checked: number;
  non_compliant_components: {
    mfg_item_id: string;
    item_code: string;
    item_name: string;
    revision: string | null;
    rohs_and_reach_compliant: boolean;
    conflict_minerals_compliant: boolean;
  }[];
  checklist: { code: string; regulation: string; status: string }[];
  iso_audit_readiness: Record<string, { standard: string; ready: boolean; checks: Record<string, boolean> }>;
  evaluated_at: string;
}

export interface PlmViewerManifest {
  revision_id: string;
  item_code: string | null;
  item_name: string | null;
  revision_code: string;
  lifecycle_state: PlmLifecycleState;
  is_obsolete: boolean;
  obsolete_watermark: boolean;
  watermark_label: string | null;
  technical_file_ref: string | null;
  attachments: PlmCadAttachment[];
  ebom_parts: Record<string, unknown>[];
}

/** A manufacturing item or bill of material offered in a select. */
export interface PlmOption {
  id: string;
  label: string;
}

/** The API wraps every record or list in `data`; lists that paginate add the Laravel `meta`. */
export interface PlmResponse<T> {
  data: T;
  meta?: { current_page: number; last_page: number; per_page: number; total: number };
}
