import type { WorkflowDecisionType, WorkflowTask } from '@core';

/** SLA badge states of an inbox row. */
export type ApprovalSlaState = 'none' | 'on_track' | 'due_soon' | 'overdue';

/** Hours before the due date from which a task is flagged as due soon. */
export const DUE_SOON_HOURS = 8;

/** Decisions that the API accepts only with a comment. */
const COMMENT_REQUIRED: readonly WorkflowDecisionType[] = ['rejected', 'request_changes'];

/** True when the decision needs a non-blank comment (reject and request changes). */
export function decisionRequiresComment(decision: WorkflowDecisionType): boolean {
  return COMMENT_REQUIRED.includes(decision);
}

/** Validation outcome of the decision dialog: the translation key of the error, or null when the input is valid. */
export function decisionInputError(
  decision: WorkflowDecisionType,
  comment: string,
  reassignTo: string | null,
): string | null {
  if (decisionRequiresComment(decision) && comment.trim() === '') {
    return 'workflows.decision.error.commentRequired';
  }
  if (decision === 'reassign' && !reassignTo) {
    return 'workflows.decision.error.reassignRequired';
  }
  return null;
}

/** SLA state of a task: overdue flag first, then the hours left before the due date. */
export function slaStateOf(task: Pick<WorkflowTask, 'due_at' | 'is_overdue' | 'hours_remaining'>): ApprovalSlaState {
  if (task.is_overdue) {
    return 'overdue';
  }
  if (!task.due_at) {
    return 'none';
  }
  const hours = Number(task.hours_remaining);
  return Number.isFinite(hours) && hours <= DUE_SOON_HOURS ? 'due_soon' : 'on_track';
}

/** NG-ZORRO tag colour of an SLA state. */
export function slaColor(state: ApprovalSlaState): string {
  switch (state) {
    case 'overdue':
      return 'red';
    case 'due_soon':
      return 'orange';
    case 'on_track':
      return 'green';
    default:
      return 'default';
  }
}

/** Idempotency key of one decision attempt: a retry of the same click must reuse it. */
export function newIdempotencyKey(): string {
  return globalThis.crypto.randomUUID();
}

/** Tag colour of an instance or step status. */
export function statusColor(status: string): string {
  switch (status) {
    case 'approved':
    case 'completed':
      return 'green';
    case 'rejected':
    case 'cancelled':
    case 'withdrawn':
      return 'red';
    case 'request_changes':
    case 'changes_requested':
      return 'orange';
    case 'pending':
    case 'in_progress':
      return 'blue';
    default:
      return 'default';
  }
}
