import {
  PrApprovalChannel,
  PrDocumentLink,
  PurchaseRequisitionStatus,
  PurchaseRequisitionUrgency,
} from '@domain/procurement/purchase-requisition.models';

const STATUS_LABEL_KEYS: Record<PurchaseRequisitionStatus, string> = {
  draft: 'PR.STATUS_DRAFT',
  pending_budget_check: 'PR.STATUS_PENDING_BUDGET_CHECK',
  pending_approval: 'PR.STATUS_PENDING_APPROVAL',
  budget_exceeded_blocked: 'PR.STATUS_BUDGET_EXCEEDED_BLOCKED',
  approved: 'PR.STATUS_APPROVED',
  rejected: 'PR.STATUS_REJECTED',
  partially_converted: 'PR.STATUS_PARTIALLY_CONVERTED',
  converted: 'PR.STATUS_CONVERTED',
  cancelled: 'PR.STATUS_CANCELLED',
};

const STATUS_TAG_COLORS: Record<PurchaseRequisitionStatus, string> = {
  draft: 'default',
  pending_budget_check: 'processing',
  pending_approval: 'processing',
  budget_exceeded_blocked: 'error',
  approved: 'success',
  rejected: 'error',
  partially_converted: 'cyan',
  converted: 'blue',
  cancelled: 'warning',
};

const URGENCY_LABEL_KEYS: Record<PurchaseRequisitionUrgency, string> = {
  low: 'PR.URGENCY_LOW',
  normal: 'PR.URGENCY_NORMAL',
  high: 'PR.URGENCY_HIGH',
  critical: 'PR.URGENCY_CRITICAL',
};

const URGENCY_TAG_COLORS: Record<PurchaseRequisitionUrgency, string> = {
  low: 'default',
  normal: 'blue',
  high: 'orange',
  critical: 'red',
};

const CHANNEL_LABEL_KEYS: Record<PrApprovalChannel, string> = {
  web: 'PR.CHANNEL_WEB',
  mobile: 'PR.CHANNEL_MOBILE',
  email_one_click: 'PR.CHANNEL_EMAIL_ONE_CLICK',
  push_one_click: 'PR.CHANNEL_PUSH_ONE_CLICK',
};

const LOG_ACTION_LABEL_KEYS: Record<string, string> = {
  created: 'PR.LOG_ACTION_CREATED',
  submitted: 'PR.LOG_ACTION_SUBMITTED',
  budget_checked: 'PR.LOG_ACTION_BUDGET_CHECKED',
  approved: 'PR.LOG_ACTION_APPROVED',
  rejected: 'PR.LOG_ACTION_REJECTED',
  budget_blocked: 'PR.LOG_ACTION_BUDGET_BLOCKED',
  recalled: 'PR.LOG_ACTION_RECALLED',
  converted: 'PR.LOG_ACTION_CONVERTED',
  cancelled: 'PR.LOG_ACTION_CANCELLED',
};

export interface DocumentRouteTarget {
  commands: string[];
  queryParams?: Record<string, string>;
}

/** Returns the i18n translation key for a purchase requisition status. */
export function prStatusLabelKey(status: PurchaseRequisitionStatus): string {
  return STATUS_LABEL_KEYS[status] ?? 'PR.STATUS_DRAFT';
}

/** Returns the NG-ZORRO tag color token for a purchase requisition status. */
export function prStatusTagColor(status: PurchaseRequisitionStatus): string {
  return STATUS_TAG_COLORS[status] ?? 'default';
}

/** Returns the i18n translation key for an urgency level. */
export function prUrgencyLabelKey(urgency: PurchaseRequisitionUrgency): string {
  return URGENCY_LABEL_KEYS[urgency] ?? 'PR.URGENCY_NORMAL';
}

/** Returns the NG-ZORRO tag color token for an urgency level. */
export function prUrgencyTagColor(urgency: PurchaseRequisitionUrgency): string {
  return URGENCY_TAG_COLORS[urgency] ?? 'default';
}

/** Returns the i18n translation key for an approval channel. */
export function prChannelLabelKey(channel: PrApprovalChannel): string {
  return CHANNEL_LABEL_KEYS[channel] ?? 'PR.CHANNEL_WEB';
}

/** Returns the i18n translation key for an immutable audit log action. */
export function prActionLabelKey(action: string): string {
  return LOG_ACTION_LABEL_KEYS[action] ?? 'PR.LOG_ACTION_UPDATED';
}

/** Returns the Angular router destination for a linked RDO (Mod 045) or PO (Mod 046). */
export function prDocumentLinkRoute(link: PrDocumentLink): DocumentRouteTarget {
  if (link.document_type === 'rfq') {
    return { commands: ['/procurement/rfqs', link.document_id, 'matrix'] };
  }
  return {
    commands: ['/procurement/orders'],
    queryParams: { poId: link.document_id },
  };
}

/** Formats a Date or ISO date string to YYYY-MM-DD in local calendar time. */
export function toIsoDateString(date: Date | string | null | undefined): string | null {
  if (!date) {
    return null;
  }
  if (typeof date === 'string') {
    const trimmed = date.trim();
    return trimmed ? trimmed.slice(0, 10) : null;
  }
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Extracts an actionable error message from an Angular HttpErrorResponse or unknown error. */
export function extractApiErrorMessage(err: unknown): string {
  if (typeof err === 'string') {
    return err;
  }
  if (err && typeof err === 'object') {
    const candidate = err as {
      error?: { detail?: string; message?: string; errors?: Record<string, string[]> };
      message?: string;
    };
    const errorObj = candidate.error;
    if (errorObj?.errors) {
      const firstList = Object.values(errorObj.errors)[0];
      if (Array.isArray(firstList) && firstList[0]) {
        return firstList[0];
      }
    }
    if (errorObj?.detail) {
      return errorObj.detail;
    }
    if (errorObj?.message) {
      return errorObj.message;
    }
    if (candidate.message) {
      return candidate.message;
    }
  }
  return '';
}
