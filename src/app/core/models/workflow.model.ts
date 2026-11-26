export type WorkflowNodeType = 'start' | 'approval' | 'condition' | 'notification' | 'end';

export type WorkflowInstanceStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export type WorkflowDecisionType = 'approved' | 'rejected' | 'abstained' | 'request_changes' | 'reassign';

/** A pending approval of the inbox (WorkflowTaskResource of the API). */
export interface WorkflowTask {
  step_id: string;
  workflow_instance_id: string;
  workflow_code: string;
  workflow_name: string;
  node_name?: string | null;
  approvable_type: string;
  approvable_id: string;
  approvable_label?: string | null;
  initiated_by?: string | null;
  initiator_name?: string | null;
  assigned_user_id?: string | null;
  assigned_role?: string | null;
  via_delegation_from?: string | null;
  tier_level?: number | null;
  due_at?: string | null;
  is_overdue?: boolean;
  hours_remaining?: string | null;
  escalation_level?: number;
  escalated_at?: string | null;
  created_at?: string;
}

export interface WorkflowTaskSummary {
  pending_count: number;
  sla_breached_count: number;
  escalated_count: number;
}

export interface WorkflowHistoryEntry {
  step_id: string;
  workflow_instance_id: string;
  workflow_code: string;
  workflow_name: string;
  approvable_label?: string;
  step_name: string;
  decision: WorkflowDecisionType;
  comment?: string | null;
  decided_at: string;
}

export interface WorkflowSlaFigures {
  average_approval_time_hours: number;
  total_completed_instances: number;
  sla_compliance_rate_percent: number;
  breached_steps_count: number;
}

export interface WorkflowSlaReport {
  figures: WorkflowSlaFigures;
  bottlenecks?: {
    step_name: string;
    average_hours: number;
    breached_count: number;
  }[];
}

export interface WorkflowDefinitionResource {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  version: number;
  is_active: boolean;
  /** 'draft' or 'published'. */
  status: string;
  /** Alias of the approvable type the workflow applies to (config/workflow.php). */
  target_entity_type: string;
  nodes?: WorkflowNodeResource[];
  transitions?: WorkflowTransitionResource[];
  created_at?: string;
  updated_at?: string;
}

export interface WorkflowSaveDefinitionRequest {
  code: string;
  name: string;
  description?: string | null;
  target_entity_type: string;
}

export interface WorkflowNodeResource {
  id: string;
  workflow_definition_id: string;
  node_key: string;
  name: string;
  node_type: WorkflowNodeType;
  config?: Record<string, unknown>;
  position_x?: number;
  position_y?: number;
}

export interface WorkflowSaveNodeRequest {
  node_key: string;
  name: string;
  node_type: WorkflowNodeType;
  config?: Record<string, unknown>;
  position_x?: number;
  position_y?: number;
}

export interface WorkflowTransitionResource {
  id: string;
  workflow_definition_id: string;
  from_node_id: string;
  to_node_id: string;
  condition_expression?: string | null;
  label?: string | null;
}

export interface WorkflowSaveTransitionRequest {
  from_node_id: string;
  to_node_id: string;
  condition_expression?: string | null;
  label?: string | null;
}

export interface WorkflowInstanceResource {
  id: string;
  workflow_definition_id: string;
  workflow_definition_version?: number | null;
  approvable_type: string;
  approvable_id: string;
  status: WorkflowInstanceStatus;
  initiator_id?: string | null;
  initiator_name?: string | null;
  current_step_id?: string | null;
  context?: Record<string, unknown>;
  started_at?: string;
  completed_at?: string | null;
  definition?: WorkflowDefinitionResource;
  steps?: WorkflowInstanceStepResource[];
}

export interface WorkflowInstanceStepResource {
  id: string;
  workflow_instance_id: string;
  node_id: string;
  step_index: number;
  name: string;
  status: string;
  assigned_to_user_id?: string | null;
  assigned_to_role?: string | null;
  due_at?: string | null;
  decisions?: WorkflowApprovalDecisionResource[];
}

export interface WorkflowApprovalDecisionResource {
  id: string;
  step_id: string;
  user_id: string;
  user_name?: string;
  decision: WorkflowDecisionType;
  comment?: string | null;
  decided_at: string;
}

export interface WorkflowStartWorkflowRequest {
  workflow_code: string;
  approvable_type: string;
  approvable_id: string;
  context_snapshot?: Record<string, unknown>;
}

export interface WorkflowRecordDecisionRequest {
  decision: WorkflowDecisionType;
  /** Mandatory for `rejected` and `request_changes`. */
  comment?: string | null;
  /** Target of a `reassign` decision. */
  reassign_to_user_id?: string | null;
  idempotency_key?: string | null;
}

export interface WorkflowDelegationModel {
  id: string;
  delegator_user_id: string;
  delegate_user_id: string;
  delegate_user_name?: string | null;
  delegator_user_name?: string | null;
  scope?: string;
  /** Document types the delegation is limited to (empty: all). */
  document_types?: string[] | null;
  /** Largest amount the delegate may approve (empty: no cap). */
  amount_cap?: number | null;
  starts_at?: string | null;
  ends_at?: string | null;
  is_active: boolean;
  reason?: string | null;
  created_at?: string;
}

export interface WorkflowCreateDelegationRequest {
  delegate_user_id: string;
  scope: string;
  document_types?: string[];
  amount_cap?: number | null;
  starts_at: string;
  ends_at: string;
  reason?: string | null;
}

export interface WorkflowEscalationRule {
  id: string;
  name: string;
  reminder_hours: number;
  escalation_hours: number;
  /** 'reporting_manager', 'specific_role' or 'specific_user'. */
  escalate_to_type: string;
  escalate_to_id?: string | null;
  auto_action?: string | null;
}

export interface WorkflowSaveEscalationRuleRequest {
  name: string;
  reminder_hours: number;
  escalation_hours: number;
  escalate_to_type: string;
  escalate_to_id?: string | null;
  auto_action?: string | null;
}

export interface WorkflowAuditVerification {
  is_valid: boolean;
  chain_length: number;
  verified_entries: number;
  last_hash?: string | null;
  errors?: string[];
}

export interface WorkflowAuditEntryResource {
  id: string;
  sequence: number;
  workflow_instance_id: string;
  event_type: string;
  payload?: Record<string, unknown>;
  actor_id?: string | null;
  actor_name?: string | null;
  previous_hash?: string | null;
  hash: string;
  created_at: string;
}

export interface WorkflowTaskParams {
  /** Code of the workflow definition (the API filters by `definition_code`). */
  definition_code?: string;
  /** @deprecated The API ignores it: use `definition_code`. */
  workflow_code?: string;
  state?: 'overdue' | 'delegated' | 'escalated';
  approvable_type?: string;
  status?: string;
  page?: number;
  per_page?: number;
}

export interface WorkflowInstanceParams {
  workflow_definition_id?: string;
  approvable_id?: string;
  status?: WorkflowInstanceStatus;
  approvable_type?: string;
  page?: number;
  per_page?: number;
}

export interface WorkflowDefinitionParams {
  is_active?: boolean;
  search?: string;
  page?: number;
  per_page?: number;
}

// --- Approval engine (Mod 006) ---

export interface WorkflowPendingCount {
  pending_count: number;
  overdue_count: number;
}

export type WorkflowMatrixOperator = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'not_in' | 'between';
export type WorkflowApproverType = 'role' | 'user' | 'reporting_manager';
/** single: one approver; and_parallel: all; or_parallel: any; majority: more than half. */
export type WorkflowApprovalType = 'single' | 'and_parallel' | 'or_parallel' | 'majority';

export interface WorkflowMatrixCondition {
  id?: string;
  field: string;
  operator: WorkflowMatrixOperator;
  /** A scalar, a list for `in` / `not_in`, `[min, max]` for `between`. */
  value: string | number | boolean | (string | number)[];
}

/** Tiers of the same level run in parallel, the levels run in sequence. Bounds are inclusive, null is open. */
export interface WorkflowMatrixTier {
  id?: string;
  tier_level: number;
  threshold_min: number | null;
  threshold_max: number | null;
  approver_type: WorkflowApproverType;
  approver_value: string;
  approval_type: WorkflowApprovalType;
}

export interface WorkflowFallbackApprover {
  approver_type: WorkflowApproverType;
  approver_value: string;
}

/** One approval matrix: the conditions that select it (all must hold) and its tiers. */
export interface WorkflowApprovalMatrix {
  id: string;
  code: string;
  name: string;
  subject_type: string;
  currency: string;
  priority: number;
  is_active: boolean;
  /** The explicit default matrix, used when no other one matches. */
  is_default: boolean;
  auto_approve_below: number | null;
  fallback_approver: WorkflowFallbackApprover | null;
  conditions: WorkflowMatrixCondition[];
  tiers: WorkflowMatrixTier[];
}

export type WorkflowSaveMatrixRequest = Omit<WorkflowApprovalMatrix, 'id'>;

export interface WorkflowSimulateRequest {
  subject_type: string;
  matrix_id?: string | null;
  attributes: {
    amount: number;
    currency: string;
    cost_center_id?: string;
    category?: string;
    new_supplier?: boolean;
    discount_percent?: number;
    company_id?: string;
    [key: string]: string | number | boolean | undefined;
  };
}

export interface WorkflowSimulationResult {
  matrix: { id: string; code: string; name: string } | null;
  used_default: boolean;
  used_fallback: boolean;
  auto_approved: boolean;
  /** No approver could be resolved. */
  blocked: boolean;
  tiers: Pick<WorkflowMatrixTier, 'tier_level' | 'approver_type' | 'approver_value' | 'approval_type'>[];
}

export interface WorkflowBusinessCalendar {
  id: string;
  name: string;
  timezone: string;
  work_monday: boolean;
  work_tuesday: boolean;
  work_wednesday: boolean;
  work_thursday: boolean;
  work_friday: boolean;
  work_saturday: boolean;
  work_sunday: boolean;
  /** `HH:mm`. */
  work_hours_start: string;
  work_hours_end: string;
  is_default: boolean;
}

export type WorkflowSaveCalendarRequest = Omit<WorkflowBusinessCalendar, 'id'>;

export type WorkflowHolidayType = 'national' | 'cantonal' | 'patron_saint' | 'company';

export interface WorkflowHoliday {
  id: string;
  /** `Y-m-d`. */
  holiday_date: string;
  name: string;
  holiday_type: WorkflowHolidayType;
  region?: string | null;
}

export interface WorkflowCreateHolidayRequest {
  holiday_date: string;
  name: string;
  holiday_type: WorkflowHolidayType;
  region?: string | null;
}

export interface WorkflowSeedHolidaysRequest {
  country: 'CH' | 'IT';
  canton?: string;
  patron_saint?: string;
  year: number;
}

/** A document type that can go through approval; its label key is `workflows.subject_types.<code>`. */
export interface WorkflowSubjectType {
  code: string;
  module: string;
  registered: boolean;
}

export interface WorkflowTimelineEntry {
  id: string;
  type: string;
  node_name: string | null;
  status: string;
  actor: string | null;
  decided_at: string | null;
  due_at: string | null;
  comment: string | null;
  channel: string | null;
}

export interface WorkflowRemoteApprovalPreview {
  requires_reauth: boolean;
  subject_label: string;
  subject_type: string;
  amount: number | null;
  currency: string | null;
  requester_name: string | null;
  approver_name: string | null;
  action: 'approve' | 'reject';
  expires_at: string | null;
}

export interface WorkflowRemoteApprovalConfirm {
  action: 'approve' | 'reject';
  confirm: true;
  comment?: string;
  password?: string;
  otp?: string;
}

export interface WorkflowRemoteApprovalResult {
  message: string;
  step_id: string;
  status: string;
}

/** Body of a 409 on a decision: the step was decided already. */
export interface WorkflowAlreadyDecided {
  decision: string;
  decided_by: string;
  decided_at: string;
}
