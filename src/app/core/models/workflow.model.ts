export type WorkflowNodeType = 'start' | 'approval' | 'condition' | 'notification' | 'end';

export type WorkflowInstanceStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export type WorkflowDecisionType = 'approved' | 'rejected' | 'abstained';

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
  comment?: string | null;
  idempotency_key?: string | null;
}

export interface WorkflowDelegationModel {
  id: string;
  delegator_user_id: string;
  delegate_user_id: string;
  delegate_user_name?: string | null;
  delegator_user_name?: string | null;
  scope?: string;
  starts_at?: string | null;
  ends_at?: string | null;
  is_active: boolean;
  reason?: string | null;
  created_at?: string;
}

export interface WorkflowCreateDelegationRequest {
  delegate_user_id: string;
  scope: string;
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
