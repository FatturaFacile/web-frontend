import {
  ConvertRequisitionLinesResponse,
  OneClickActionResponse,
  PrApprovalChannel,
  PrApprovalLog,
  PrApprovalStep,
  PrApprovalStepStatus,
  PrBudgetCheckSnapshot,
  PrBudgetCheckStatus,
  PrCurrency,
  PrDocumentLink,
  PrLineMode,
  PurchaseRequisitionDetail,
  PurchaseRequisitionLine,
  PurchaseRequisitionStatus,
  PurchaseRequisitionSummary,
  PurchaseRequisitionUrgency,
  roundCurrency,
} from '@domain/procurement/purchase-requisition.models';

type JsonRecord = Record<string, unknown>;

const VALID_STATUSES: ReadonlySet<string> = new Set<PurchaseRequisitionStatus>([
  'draft',
  'pending_budget_check',
  'pending_approval',
  'budget_exceeded_blocked',
  'approved',
  'rejected',
  'partially_converted',
  'converted',
  'cancelled',
]);

const VALID_URGENCIES: ReadonlySet<string> = new Set<PurchaseRequisitionUrgency>([
  'low',
  'normal',
  'high',
  'critical',
]);

const VALID_CHANNELS: ReadonlySet<string> = new Set<PrApprovalChannel>([
  'web',
  'mobile',
  'email_one_click',
  'push_one_click',
]);

function asRecord(value: unknown): JsonRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function asOptionalRecord(value: unknown): JsonRecord | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : value === null || value === undefined ? '' : String(value);
}

function nullableStr(value: unknown): string | null {
  if (typeof value === 'string') {
    return value.length > 0 ? value : null;
  }
  return null;
}

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : fallback;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function nullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const parsed = toNumber(value, Number.NaN);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeStatus(value: unknown): PurchaseRequisitionStatus {
  const s = str(value);
  return VALID_STATUSES.has(s) ? (s as PurchaseRequisitionStatus) : 'draft';
}

function normalizeUrgency(value: unknown): PurchaseRequisitionUrgency {
  const u = str(value);
  return VALID_URGENCIES.has(u) ? (u as PurchaseRequisitionUrgency) : 'normal';
}

function normalizeCurrency(value: unknown): PrCurrency {
  return str(value).toUpperCase() === 'CHF' ? 'CHF' : 'EUR';
}

function normalizeChannel(value: unknown): PrApprovalChannel {
  const c = str(value);
  return VALID_CHANNELS.has(c) ? (c as PrApprovalChannel) : 'web';
}

function normalizeStepStatus(
  value: unknown,
  requisitionStatus: PurchaseRequisitionStatus,
  hasExplicitInProgress: boolean,
  isFirstPending: boolean,
): PrApprovalStepStatus {
  const s = str(value);
  if (s === 'approved' || s === 'rejected' || s === 'skipped' || s === 'in_progress') {
    return s;
  }
  if (s === 'upcoming') {
    return 'pending';
  }
  if (s === 'pending' && requisitionStatus === 'pending_approval' && !hasExplicitInProgress && isFirstPending) {
    return 'in_progress';
  }
  return 'pending';
}

/** Normalizes a backend BudgetCheckResult / PrBudgetCheckSnapshot payload. */
export function mapBudgetCheckSnapshot(raw: unknown): PrBudgetCheckSnapshot {
  const rec = asRecord(raw);
  const costCenters = Array.isArray(rec['cost_centers']) ? rec['cost_centers'] : [];
  const primaryCc = asOptionalRecord(costCenters[0]);

  const allocated = toNumber(rec['allocated_budget']);
  const actualSpent = rec['actual_spent'] !== undefined ? toNumber(rec['actual_spent']) : undefined;
  const rawCommitted = toNumber(rec['committed_amount']);
  const committed =
    actualSpent !== undefined && rec['available_budget'] === undefined
      ? roundCurrency(actualSpent + rawCommitted)
      : rawCommitted;

  const available = toNumber(rec['available_budget'] ?? rec['residual_available']);
  const reqAmount = toNumber(rec['requisition_amount'] ?? rec['requested_amount']);
  const remaining = toNumber(rec['remaining_after_requisition'] ?? rec['projected_residual']);

  const policy = nullableStr(rec['policy_mode'] ?? rec['enforcement_policy']) ?? 'warning';
  const hasConfigured = rec['has_configured_budget'] !== false;
  const isOverBudget = Boolean(
    rec['is_over_budget'] ?? (hasConfigured && allocated > 0 && remaining < 0),
  );

  let utilization = nullableNumber(rec['utilization_percent']);
  if (utilization === null) {
    utilization =
      allocated > 0
        ? Math.max(0, roundCurrency(((allocated - remaining) / allocated) * 100))
        : 0;
  }

  let status: PrBudgetCheckStatus;
  const rawStatus = nullableStr(rec['status']);
  if (rawStatus === 'ok' || rawStatus === 'warning' || rawStatus === 'hard_block') {
    status = rawStatus;
  } else if (Boolean(rec['is_hard_blocked']) || (hasConfigured && isOverBudget && policy === 'hard_block')) {
    status = 'hard_block';
  } else if (
    Boolean(rec['is_warning']) ||
    (hasConfigured && (isOverBudget || (allocated > 0 && utilization >= 85)))
  ) {
    status = 'warning';
  } else {
    status = 'ok';
  }

  const isHardBlocked = Boolean(rec['is_hard_blocked'] ?? status === 'hard_block');
  const isWarning = Boolean(rec['is_warning'] ?? status === 'warning');

  return {
    cost_center_id: str(rec['cost_center_id'] ?? primaryCc?.['cost_center_id']),
    cost_center_code: nullableStr(rec['cost_center_code'] ?? primaryCc?.['cost_center_code']),
    cost_center_name: nullableStr(rec['cost_center_name'] ?? primaryCc?.['cost_center_name']),
    fiscal_year: nullableNumber(rec['fiscal_year'] ?? primaryCc?.['fiscal_year']),
    period_label: nullableStr(rec['period_label']),
    currency: str(rec['currency']) || 'EUR',
    allocated_budget: allocated,
    ...(actualSpent !== undefined ? { actual_spent: actualSpent } : {}),
    committed_amount: committed,
    available_budget: available,
    requisition_amount: reqAmount,
    remaining_after_requisition: remaining,
    utilization_percent: utilization,
    status,
    is_warning: isWarning,
    is_hard_blocked: isHardBlocked,
    policy_mode: policy,
    message: nullableStr(rec['message']),
    checked_at: nullableStr(rec['checked_at']),
  };
}

/** Normalizes a linked RFQ/PO resource into a frontend `PrDocumentLink`. */
export function mapDocumentLink(raw: unknown): PrDocumentLink {
  const rec = asRecord(raw);
  const rawType = str(rec['document_type'] ?? rec['target_document_type']).toLowerCase();
  const docId = str(rec['document_id'] ?? rec['target_document_id']);
  return {
    id: str(rec['id']),
    document_type: rawType === 'po' ? 'po' : 'rfq',
    document_id: docId,
    document_number: str(rec['document_number'] ?? rec['target_document_number']) || docId,
    status: str(rec['status']),
    created_at: nullableStr(rec['created_at']),
  };
}

/** Normalizes approval step items returned by `Mod006ApprovalWorkflowAdapter::getApprovalSteps`. */
export function mapApprovalSteps(
  rawList: unknown,
  requisitionStatus: PurchaseRequisitionStatus,
): PrApprovalStep[] {
  if (!Array.isArray(rawList)) {
    return [];
  }

  const records = rawList.map(asRecord);
  const hasExplicitInProgress = records.some((r) => str(r['status']) === 'in_progress');
  let markedFirstPending = false;

  return records.map((rec, idx) => {
    const rawStepStatus = str(rec['status']);
    const isFirstPending = rawStepStatus === 'pending' && !markedFirstPending;
    if (isFirstPending) {
      markedFirstPending = true;
    }

    const level = toNumber(rec['tier_level'] ?? rec['level'], idx + 1);
    const approverType = str(rec['approver_type']);
    const approverValue = nullableStr(rec['approver_value']);
    const roleName =
      nullableStr(rec['role_name'] ?? rec['assigned_role']) ??
      (approverType === 'role' ? approverValue : null);
    const approverId = nullableStr(
      rec['approver_id'] ?? rec['decided_by_user_id'] ?? rec['assigned_user_id'],
    );
    const approverName = nullableStr(rec['approver_name'] ?? rec['decided_by_name']);

    return {
      id: str(rec['id'] ?? rec['step_id']) || `step-${level}`,
      tier_level: level,
      tier_name: str(rec['tier_name'] ?? rec['label']) || `Level ${level}`,
      role_name: roleName,
      approver_id: approverId,
      approver_name: approverName,
      status: normalizeStepStatus(
        rawStepStatus,
        requisitionStatus,
        hasExplicitInProgress,
        isFirstPending,
      ),
      threshold_amount: nullableNumber(rec['threshold_amount']),
      decided_at: nullableStr(rec['decided_at'] ?? rec['completed_at']),
      comment: nullableStr(rec['comment']),
    };
  });
}

/** Normalizes an immutable approval audit log entry. */
export function mapApprovalLog(raw: unknown): PrApprovalLog {
  const rec = asRecord(raw);
  const nestedApprover = asOptionalRecord(rec['approver']);
  return {
    id: str(rec['id']),
    action: str(rec['action']) || 'updated',
    actor_id: nullableStr(rec['actor_id'] ?? rec['approver_user_id']),
    actor_name:
      str(rec['actor_name']) ||
      str(nestedApprover?.['name']) ||
      str(rec['approver_user_id']),
    channel: normalizeChannel(rec['channel']),
    comment: nullableStr(rec['comment']),
    created_at: str(rec['created_at'] ?? rec['acted_at']),
  };
}

/** Normalizes a single purchase requisition line item. */
export function mapRequisitionLine(raw: unknown): PurchaseRequisitionLine {
  const rec = asRecord(raw);
  const nestedProject = asOptionalRecord(rec['project']);
  const quantity = toNumber(rec['quantity']);
  const convertedQty = toNumber(rec['converted_quantity']);
  const remaining =
    rec['remaining_quantity'] !== undefined && rec['remaining_quantity'] !== null
      ? toNumber(rec['remaining_quantity'])
      : rec['remaining_convertible_quantity'] !== undefined &&
          rec['remaining_convertible_quantity'] !== null
        ? toNumber(rec['remaining_convertible_quantity'])
        : Math.max(0, quantity - convertedQty);

  const unitPrice = toNumber(rec['estimated_unit_price']);
  const lineTotal =
    rec['line_total'] !== undefined && rec['line_total'] !== null
      ? toNumber(rec['line_total'])
      : rec['estimated_line_total'] !== undefined && rec['estimated_line_total'] !== null
        ? toNumber(rec['estimated_line_total'])
        : roundCurrency(quantity * unitPrice);

  const catalogItemId = nullableStr(rec['catalog_item_id']);
  const rawMode = str(rec['mode']);
  const rawItemType = str(rec['item_type']);
  const mode: PrLineMode =
    rawMode === 'catalog' || rawMode === 'free_text'
      ? rawMode
      : rawItemType === 'catalog_item' || Boolean(catalogItemId)
        ? 'catalog'
        : 'free_text';

  return {
    id: str(rec['id']),
    line_number: toNumber(rec['line_number'], 1),
    mode,
    catalog_item_id: catalogItemId,
    item_code: nullableStr(rec['item_code']),
    description: str(rec['description']),
    quantity,
    converted_quantity: convertedQty,
    remaining_quantity: remaining,
    uom: str(rec['uom'] ?? rec['unit_of_measure']) || 'PCS',
    estimated_unit_price: unitPrice,
    line_total: lineTotal,
    cost_center_id: nullableStr(rec['cost_center_id']),
    cost_center_name: nullableStr(rec['cost_center_name']),
    project_id: nullableStr(rec['project_id']),
    project_name: nullableStr(rec['project_name'] ?? nestedProject?.['name']),
    notes: nullableStr(rec['notes']),
  };
}

/** Normalizes a PurchaseRequisitionResource into a `PurchaseRequisitionSummary`. */
export function mapRequisitionSummary(raw: unknown): PurchaseRequisitionSummary {
  const rec = asRecord(raw);
  const nestedRequester = asOptionalRecord(rec['requester']);
  const nestedProject = asOptionalRecord(rec['project']);

  return {
    id: str(rec['id']),
    requisition_number: str(rec['requisition_number']),
    title: str(rec['title']),
    status: normalizeStatus(rec['status']),
    urgency: normalizeUrgency(rec['urgency']),
    currency: normalizeCurrency(rec['currency']),
    estimated_total: toNumber(rec['estimated_total'] ?? rec['total_estimated_amount']),
    requested_delivery_date: str(rec['requested_delivery_date'] ?? rec['required_by_date']),
    requester_id: str(rec['requester_id'] ?? rec['requester_user_id']),
    requester_name: str(rec['requester_name']) || str(nestedRequester?.['name']),
    cost_center_id: nullableStr(rec['cost_center_id']),
    cost_center_code: nullableStr(rec['cost_center_code']),
    cost_center_name: nullableStr(rec['cost_center_name']),
    project_id: nullableStr(rec['project_id']),
    project_code: nullableStr(rec['project_code'] ?? nestedProject?.['project_number']),
    project_name: nullableStr(rec['project_name'] ?? nestedProject?.['name']),
    economic_justification: nullableStr(rec['economic_justification']),
    current_approval_tier: nullableNumber(
      rec['current_approval_tier'] ?? rec['current_approval_level'],
    ),
    can_approve: typeof rec['can_approve'] === 'boolean' ? rec['can_approve'] : undefined,
    document_links: Array.isArray(rec['document_links'])
      ? rec['document_links'].map(mapDocumentLink)
      : undefined,
    lines: Array.isArray(rec['lines']) ? rec['lines'].map(mapRequisitionLine) : undefined,
    created_at: str(rec['created_at']),
    updated_at: nullableStr(rec['updated_at']),
  };
}

/** Normalizes a full PurchaseRequisitionResource into a `PurchaseRequisitionDetail`. */
export function mapRequisitionDetail(raw: unknown): PurchaseRequisitionDetail {
  const rec = asRecord(raw);
  const summary = mapRequisitionSummary(rec);

  return {
    ...summary,
    lines: summary.lines ?? [],
    budget_check_snapshot:
      rec['budget_check_snapshot'] !== null && rec['budget_check_snapshot'] !== undefined
        ? mapBudgetCheckSnapshot(rec['budget_check_snapshot'])
        : null,
    approval_steps: mapApprovalSteps(rec['approval_steps'], summary.status),
    approval_logs: Array.isArray(rec['approval_logs'])
      ? rec['approval_logs'].map(mapApprovalLog)
      : [],
    document_links: summary.document_links ?? [],
  };
}

/** Normalizes a 1-click email approval/rejection API response. */
export function mapOneClickActionResponse(
  raw: unknown,
  fallbackAction: 'approve' | 'reject',
  outerMessage?: string | null,
): OneClickActionResponse {
  const rec = asRecord(raw);
  const action =
    rec['action'] === 'approve' || rec['action'] === 'reject' ? rec['action'] : fallbackAction;
  const actedAt =
    nullableStr(rec['acted_at']) ??
    (action === 'approve' ? nullableStr(rec['approved_at']) : nullableStr(rec['rejected_at'])) ??
    nullableStr(rec['updated_at']);

  return {
    requisition_id: str(rec['requisition_id'] ?? rec['id']),
    requisition_number: str(rec['requisition_number']),
    status: normalizeStatus(rec['status']),
    action,
    message: nullableStr(rec['message']) ?? nullableStr(outerMessage),
    next_approver_name: nullableStr(rec['next_approver_name']),
    acted_at: actedAt,
  };
}

/** Normalizes a buyer conversion result resource into `ConvertRequisitionLinesResponse`. */
export function mapConversionResult(raw: unknown): ConvertRequisitionLinesResponse {
  const rec = asRecord(raw);
  const targetType = str(rec['target_type']).toLowerCase() === 'po' ? 'po' : 'rfq';
  const targetId = str(
    rec['target_document_id'] ?? rec['target_id'] ?? rec['rfq_id'] ?? rec['purchase_order_id'],
  );
  const targetNumber = nullableStr(rec['target_document_number'] ?? rec['target_number']);
  const links = Array.isArray(rec['links']) ? rec['links'] : null;

  return {
    target_type: targetType,
    target_id: targetId,
    target_document_id: targetId || null,
    target_number: targetNumber,
    target_document_number: targetNumber,
    rfq_id: nullableStr(rec['rfq_id']) ?? (targetType === 'rfq' && targetId ? targetId : null),
    purchase_order_id:
      nullableStr(rec['purchase_order_id']) ?? (targetType === 'po' && targetId ? targetId : null),
    converted_line_count:
      typeof rec['converted_line_count'] === 'number'
        ? rec['converted_line_count']
        : (links?.length ?? undefined),
  };
}
