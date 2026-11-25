import {
  DocumentFlowNode,
  DocumentFlowNodeType,
  SupplierRatingComponentKey,
  SupplierTier,
} from '@domain/procurement/srm.models';

/** NG-ZORRO tag colour of a supplier tier. */
export function tierColor(tier: SupplierTier | null): string {
  switch (tier) {
    case 'A':
      return 'success';
    case 'B':
      return 'processing';
    case 'C':
      return 'warning';
    case 'D':
      return 'error';
    default:
      return 'default';
  }
}

/** Progress bar status of a 0-100 score. */
export function scoreStatus(
  score: string | number | null | undefined,
): 'success' | 'normal' | 'exception' {
  const value = toNumber(score);
  if (value === null) {
    return 'normal';
  }
  if (value >= 75) {
    return 'success';
  }
  return value >= 60 ? 'normal' : 'exception';
}

/** Parses a decimal string; null when missing or not a number. Display only, never used for accounting maths. */
export function toNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Translation key of a rating component. */
export function ratingComponentKey(component: SupplierRatingComponentKey): string {
  return `srm.component.${component}`;
}

/** Translation key of a document type. */
export function documentTypeKey(type: DocumentFlowNodeType): string {
  return `srm.flow.type.${type}`;
}

/** Translation key of a relation between two documents. */
export function relationKey(relation: string): string {
  return `srm.flow.relation.${relation}`;
}

/** Document statuses that have a backend-seeded label (`srm.flow.status.*`). */
export const KNOWN_FLOW_STATUSES: readonly string[] = [
  'draft',
  'pending_approval',
  'approved',
  'rejected',
  'sourcing',
  'converted_to_po',
  'cancelled',
  'issued',
  'published',
  'bidding_open',
  'under_evaluation',
  'awarded',
  'active',
  'expired',
  'closed',
  'sent',
  'confirmed',
  'partially_received',
  'received',
  'pending',
  'passed',
  'failed',
  'partial',
  'not_required',
  'accepted',
  'released',
  'completed',
  'matched',
  'within_tolerance',
  'blocked_discrepancy',
  'pending_credit_note',
  'override_approved',
  'resolved',
  'escalated_to_workflow',
];

/** Translation key of the status of a node, or null when the status is missing or has no label. */
export function nodeStatusKey(node: Pick<DocumentFlowNode, 'status'>): string | null {
  if (!node.status || !KNOWN_FLOW_STATUSES.includes(node.status)) {
    return null;
  }
  return `srm.flow.status.${node.status}`;
}

/** NG-ZORRO timeline / tag colour of a node status. */
export function nodeStatusColor(node: Pick<DocumentFlowNode, 'type' | 'status'>): string {
  const status = node.status ?? '';
  if (
    [
      'blocked_discrepancy',
      'pending_credit_note',
      'rejected',
      'cancelled',
      'failed',
      'expired',
    ].includes(status)
  ) {
    return 'red';
  }
  if (
    ['pending_approval', 'pending', 'partial', 'under_evaluation', 'sourcing', 'draft'].includes(
      status,
    )
  ) {
    return 'orange';
  }
  if (
    [
      'approved',
      'matched',
      'within_tolerance',
      'resolved',
      'override_approved',
      'received',
      'closed',
      'awarded',
      'accepted',
      'released',
      'active',
      'completed',
      'converted_to_po',
    ].includes(status)
  ) {
    return 'green';
  }
  return 'blue';
}

/** Router link of a document of the chain, or null when the document has no detail page. */
export function documentLink(node: Pick<DocumentFlowNode, 'type' | 'id'>): string[] | null {
  switch (node.type) {
    case 'requisition':
      return ['/procurement/requisitions', node.id];
    case 'rfq':
      return ['/procurement/rfqs', node.id];
    case 'framework_agreement':
      return ['/procurement/contracts', node.id, 'balance'];
    case 'purchase_order':
      return ['/procurement/purchase-orders', node.id];
    case 'goods_receipt':
      return ['/procurement/goods-receipts', node.id];
    case 'purchase_return':
      return ['/procurement/returns', node.id];
    case 'supplier_invoice':
      return ['/purchases/invoices', node.id];
    default:
      return null;
  }
}

/** Fraction (0-100) of the ordered quantity covered by `part`, capped at 100. */
export function coverage(part: string, ordered: string): number {
  const total = toNumber(ordered);
  const value = toNumber(part);
  if (total === null || total <= 0 || value === null) {
    return 0;
  }
  return Math.min(100, Math.round((value / total) * 100));
}
