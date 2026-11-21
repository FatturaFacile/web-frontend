/**
 * Domain models, DTO contracts, and pure calculation helpers for Mod 044 (Purchase Requisitions / RDA).
 */

export type PurchaseRequisitionStatus =
  | 'draft'
  | 'pending_budget_check'
  | 'pending_approval'
  | 'budget_exceeded_blocked'
  | 'approved'
  | 'rejected'
  | 'partially_converted'
  | 'converted'
  | 'cancelled';

export type PurchaseRequisitionUrgency = 'low' | 'normal' | 'high' | 'critical';

export type PrCurrency = 'CHF' | 'EUR';

export type PrApprovalStepStatus = 'pending' | 'in_progress' | 'approved' | 'rejected' | 'skipped';

export type PrApprovalChannel = 'web' | 'mobile' | 'email_one_click' | 'push_one_click';

export type PrBudgetCheckStatus = 'ok' | 'warning' | 'hard_block';

export type PrDocumentLinkType = 'rfq' | 'po';

export type PrLineMode = 'catalog' | 'free_text';

export type PrListTab = 'mine' | 'department' | 'pending_approval';

export interface PrDocumentLink {
  id: string;
  document_type: PrDocumentLinkType;
  document_id: string;
  document_number: string;
  status: string;
  created_at: string | null;
}

export interface PrBudgetCheckSnapshot {
  cost_center_id: string;
  cost_center_code?: string | null;
  cost_center_name?: string | null;
  fiscal_year?: number | null;
  period_label?: string | null;
  currency: PrCurrency | string;
  allocated_budget: number;
  actual_spent?: number;
  committed_amount: number;
  available_budget: number;
  requisition_amount: number;
  remaining_after_requisition: number;
  utilization_percent: number;
  status: PrBudgetCheckStatus;
  is_warning?: boolean;
  is_hard_blocked?: boolean;
  policy_mode?: 'none' | 'soft_warning' | 'hard_block' | string;
  message?: string | null;
  checked_at?: string | null;
}

export interface PrApprovalStep {
  id: string;
  tier_level: number;
  tier_name: string;
  role_name?: string | null;
  approver_id?: string | null;
  approver_name?: string | null;
  status: PrApprovalStepStatus;
  threshold_amount?: number | null;
  decided_at?: string | null;
  comment?: string | null;
}

export interface PrApprovalLog {
  id: string;
  action:
    | 'created'
    | 'submitted'
    | 'approved'
    | 'rejected'
    | 'budget_blocked'
    | 'converted'
    | 'cancelled'
    | string;
  actor_id?: string | null;
  actor_name: string;
  channel: PrApprovalChannel;
  comment?: string | null;
  created_at: string;
}

export interface PurchaseRequisitionLine {
  id: string;
  line_number: number;
  mode?: PrLineMode;
  catalog_item_id?: string | null;
  item_code?: string | null;
  description: string;
  quantity: number;
  converted_quantity: number;
  remaining_quantity: number;
  uom: string;
  estimated_unit_price: number;
  line_total: number;
  cost_center_id?: string | null;
  cost_center_name?: string | null;
  project_id?: string | null;
  project_name?: string | null;
  notes?: string | null;
}

export interface PurchaseRequisitionSummary {
  id: string;
  requisition_number: string;
  title: string;
  status: PurchaseRequisitionStatus;
  urgency: PurchaseRequisitionUrgency;
  currency: PrCurrency;
  estimated_total: number;
  requested_delivery_date: string;
  requester_id: string;
  requester_name: string;
  cost_center_id: string | null;
  cost_center_code?: string | null;
  cost_center_name?: string | null;
  project_id?: string | null;
  project_code?: string | null;
  project_name?: string | null;
  economic_justification?: string | null;
  current_approval_tier?: number | null;
  can_approve?: boolean;
  document_links?: PrDocumentLink[];
  lines?: PurchaseRequisitionLine[];
  created_at: string;
  updated_at?: string | null;
}

export interface PurchaseRequisitionDetail extends PurchaseRequisitionSummary {
  lines: PurchaseRequisitionLine[];
  budget_check_snapshot: PrBudgetCheckSnapshot | null;
  approval_steps: PrApprovalStep[];
  approval_logs: PrApprovalLog[];
  document_links: PrDocumentLink[];
}

export interface PurchaseRequisitionListFilters {
  status?: PurchaseRequisitionStatus | null;
  cost_center_id?: string | null;
  project_id?: string | null;
  urgency?: PurchaseRequisitionUrgency | null;
  requester_id?: string | null;
  date_from?: string | null;
  date_to?: string | null;
  search?: string | null;
  scope?: 'mine' | 'department';
  page?: number;
  per_page?: number;
}

export interface SavePurchaseRequisitionLinePayload {
  id?: string;
  item_type: 'catalog_item' | 'free_text';
  catalog_item_id?: string | null;
  item_code?: string | null;
  description: string;
  quantity: number;
  unit_of_measure: string;
  estimated_unit_price: number;
  cost_center_id?: string | null;
  project_id?: string | null;
  notes?: string | null;
}

export interface SavePurchaseRequisitionPayload {
  title: string;
  cost_center_id: string;
  project_id?: string | null;
  urgency: PurchaseRequisitionUrgency;
  requested_delivery_date: string;
  currency: PrCurrency;
  economic_justification: string;
  notes?: string | null;
  lines: SavePurchaseRequisitionLinePayload[];
}

export interface BudgetPreviewLinePayload {
  quantity: number;
  estimated_unit_price: number;
  cost_center_id?: string | null;
}

export interface BudgetPreviewRequest {
  cost_center_id?: string | null;
  currency: PrCurrency;
  fiscal_year?: number | null;
  exclude_requisition_id?: string | null;
  lines: BudgetPreviewLinePayload[];
}

export interface OneClickActionPayload {
  token: string;
  action: 'approve' | 'reject';
  comment?: string | null;
}

export interface OneClickActionResponse {
  requisition_id: string;
  requisition_number: string;
  status: PurchaseRequisitionStatus;
  action: 'approve' | 'reject';
  message?: string | null;
  next_approver_name?: string | null;
  acted_at?: string | null;
}

export interface ConvertRequisitionLineItemPayload {
  requisition_line_id: string;
  quantity: number;
}

export interface ConvertRequisitionLinesPayload {
  target_type: 'rfq' | 'po';
  supplier_id?: string;
  items: ConvertRequisitionLineItemPayload[];
}

export interface ConvertRequisitionLinesResponse {
  target_type: 'rfq' | 'po';
  target_id: string;
  target_document_id?: string | null;
  target_number?: string | null;
  target_document_number?: string | null;
  rfq_id?: string | null;
  purchase_order_id?: string | null;
  converted_line_count?: number;
}

export interface CostCenterTreeNode {
  id: string;
  code: string;
  name: string;
  children?: readonly CostCenterTreeNode[];
}

export interface CostCenterOption {
  id: string;
  code: string;
  name: string;
  depth: number;
  label: string;
}

export interface ProjectOption {
  id: string;
  project_number: string;
  name: string;
  status?: string;
  label: string;
}

export interface CatalogItemOption {
  id: string;
  sku: string;
  name: string;
  description?: string | null;
  unit_measure: string;
  cost_price: number;
  label: string;
}

export interface RequesterOption {
  id: string;
  name: string;
  email?: string | null;
  role?: string | null;
}

export interface SupplierOption {
  id: string;
  supplier_code: string;
  company_name: string;
  vat_number?: string | null;
  currency?: string | null;
  label: string;
}

export interface ConvertiblePrLineRow {
  requisition_id: string;
  requisition_number: string;
  requisition_title: string;
  requisition_status: PurchaseRequisitionStatus;
  urgency: PurchaseRequisitionUrgency;
  currency: PrCurrency;
  requested_delivery_date: string;
  requester_name: string;
  cost_center_id: string | null;
  cost_center_name: string | null;
  project_id: string | null;
  project_name: string | null;
  line_id: string;
  line_number: number;
  catalog_item_id: string | null;
  item_code: string | null;
  description: string;
  uom: string;
  estimated_unit_price: number;
  quantity: number;
  converted_quantity: number;
  remaining_quantity: number;
}

export type ConversionQuantityValidationResult = 'valid' | 'non_positive' | 'exceeds_remaining';

/** Rounds a numeric monetary value cleanly to 2 decimal places. */
export function roundCurrency(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Rounds a quantity value cleanly to 4 decimal places. */
function roundQuantity(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.round((value + Number.EPSILON) * 10000) / 10000;
}

/** Computes a single PR line subtotal from quantity and estimated unit price. */
export function computeLineSubtotal(quantity: number, unitPrice: number): number {
  const safeQty = Number.isFinite(quantity) ? Math.max(0, quantity) : 0;
  const safePrice = Number.isFinite(unitPrice) ? Math.max(0, unitPrice) : 0;
  return roundCurrency(safeQty * safePrice);
}

/** Computes the total estimated value across a collection of PR lines. */
export function computeRequisitionTotal(
  lines: readonly { quantity: number; estimated_unit_price: number }[],
): number {
  const sum = lines.reduce(
    (total, line) =>
      total + computeLineSubtotal(Number(line.quantity ?? 0), Number(line.estimated_unit_price ?? 0)),
    0,
  );
  return roundCurrency(sum);
}

/** Resolves the remaining convertible quantity for a PR line. */
export function computeRemainingQuantity(
  line: Pick<PurchaseRequisitionLine, 'quantity' | 'converted_quantity'> & {
    remaining_quantity?: number | null;
  },
): number {
  if (typeof line.remaining_quantity === 'number' && Number.isFinite(line.remaining_quantity)) {
    return Math.max(0, roundQuantity(line.remaining_quantity));
  }
  const qty = Number.isFinite(line.quantity) ? line.quantity : 0;
  const converted = Number.isFinite(line.converted_quantity) ? line.converted_quantity : 0;
  return Math.max(0, roundQuantity(qty - converted));
}

/** Validates a buyer split-conversion quantity against the line's remaining convertible quantity. */
export function validateConversionQuantity(
  quantity: number,
  remainingQuantity: number,
): ConversionQuantityValidationResult {
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return 'non_positive';
  }
  if (quantity > remainingQuantity + 1e-6) {
    return 'exceeds_remaining';
  }
  return 'valid';
}

/** Flattens a hierarchical cost-center tree into flat dropdown options preserving indentation depth. */
export function flattenCostCenterTree(
  nodes: readonly CostCenterTreeNode[],
  depth = 0,
): CostCenterOption[] {
  const options: CostCenterOption[] = [];
  const prefix = depth > 0 ? `${'— '.repeat(depth)}` : '';
  for (const node of nodes) {
    options.push({
      id: node.id,
      code: node.code,
      name: node.name,
      depth,
      label: `${prefix}${node.code} — ${node.name}`,
    });
    if (node.children && node.children.length > 0) {
      options.push(...flattenCostCenterTree(node.children, depth + 1));
    }
  }
  return options;
}
