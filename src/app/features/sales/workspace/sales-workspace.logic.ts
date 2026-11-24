import { CustomerCreditProfile } from '@core';
import {
  AtpCheckResult,
  AtpStatus,
  BlanketAgreementLine,
  CreditExposure,
  FulfillmentSuggestion,
  WorkspaceOrder,
  WorkspaceOrderLine,
} from './sales-workspace.models';

/** Traffic-light badge of an ATP/CTP result: ng-zorro tag colour and the translation key of the label. */
export interface AtpBadge {
  color: 'green' | 'gold' | 'red' | 'blue';
  labelKey: string;
}

/** The badge of a line from its ATP status: in stock, partial, ATP on a later date, CTP required or short. */
export function atpBadge(status: AtpStatus | null | undefined): AtpBadge {
  switch (status) {
    case 'available_on_time':
      return { color: 'green', labelKey: 'SWK.ATP.IN_STOCK' };
    case 'partial_availability':
      return { color: 'gold', labelKey: 'SWK.ATP.PARTIAL' };
    case 'delayed_atp':
      return { color: 'gold', labelKey: 'SWK.ATP.DELAYED' };
    case 'ctp_required':
      return { color: 'blue', labelKey: 'SWK.ATP.CTP' };
    case 'shortage':
      return { color: 'red', labelKey: 'SWK.ATP.SHORTAGE' };
    default:
      return { color: 'blue', labelKey: 'SWK.ATP.UNKNOWN' };
  }
}

/** The date the ATP badge shows: the earliest ATP date, else the capable-to-promise date. */
export function atpPromiseDate(
  check: Pick<AtpCheckResult, 'earliest_atp_date' | 'ctp_estimated_date'>,
): string | null {
  return check.earliest_atp_date ?? check.ctp_estimated_date;
}

/** Translation key of the fulfilment suggestion the ATP check recommends. */
export function suggestionKey(suggestion: FulfillmentSuggestion): string {
  return `SWK.SUGGESTION.${suggestion.toUpperCase()}`;
}

export type CreditLevel = 'ok' | 'warning' | 'blocked';

/** Share of the credit limit the exposure uses from which the user is warned (0.9 = 90%). */
export const CREDIT_WARNING_RATIO = 0.9;

/**
 * How serious the credit position of an order is: blocked when it is over the limit or has overdue invoices, a warning
 * from 90% of the limit, ok otherwise (and when the customer has no limit).
 */
export function creditLevel(exposure: CreditExposure | null | undefined): CreditLevel {
  if (!exposure) {
    return 'ok';
  }
  if (exposure.over_limit || exposure.has_overdue) {
    return 'blocked';
  }
  const limit = Number(exposure.credit_limit);
  if (limit > 0 && Number(exposure.total_exposure) / limit >= CREDIT_WARNING_RATIO) {
    return 'warning';
  }
  return 'ok';
}

export type CallOffCheck = 'ok' | 'invalid' | 'exceeds_balance';

/**
 * Validates a call-off quantity against the remaining balance of an agreement line. The tolerance percent lets a release
 * go over the balance by that share of the target quantity.
 */
export function validateCallOffQuantity(
  line: Pick<BlanketAgreementLine, 'target_quantity' | 'called_off_quantity'>,
  quantity: number,
  tolerancePercent = 0,
): CallOffCheck {
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return 'invalid';
  }
  const target = Number(line.target_quantity);
  const limit = target * (1 + tolerancePercent / 100);
  return Number(line.called_off_quantity) + quantity > limit + 1e-9 ? 'exceeds_balance' : 'ok';
}

export type OrderTab =
  'all' | 'draft' | 'credit_blocked' | 'confirmed' | 'partially_delivered' | 'delivered';

export const ORDER_TABS: readonly OrderTab[] = [
  'all',
  'draft',
  'credit_blocked',
  'confirmed',
  'partially_delivered',
  'delivered',
];

/** The API filters of a list tab. */
export function tabFilters(tab: OrderTab): {
  status?: string;
  credit_blocked?: boolean;
  has_backorders?: boolean;
} {
  switch (tab) {
    case 'draft':
      return { status: 'draft' };
    case 'credit_blocked':
      return { credit_blocked: true };
    case 'confirmed':
      return { status: 'confirmed' };
    case 'partially_delivered':
      return { status: 'in_fulfillment' };
    case 'delivered':
      return { status: 'shipped' };
    default:
      return {};
  }
}

/** Percent of a progress string (`"40.00"`) clamped to 0-100, for a progress bar. */
export function percentOf(value: string | null | undefined): number {
  const percent = Number(value ?? 0);
  return Number.isFinite(percent) ? Math.min(100, Math.max(0, percent)) : 0;
}

/** Quantity still to ship on a line (backorder quantity of the API), as a number. */
export function openQuantity(line: Pick<WorkspaceOrderLine, 'backorder_quantity'>): number {
  return Math.max(0, Number(line.backorder_quantity));
}

/** Lines that can still be shipped: open quantity, not cancelled. */
export function shippableLines(order: Pick<WorkspaceOrder, 'lines'>): WorkspaceOrderLine[] {
  return (order.lines ?? []).filter((line) => openQuantity(line) > 0);
}

/** Whether the order can be shipped: confirmed or in fulfilment (never blocked, draft or cancelled). */
export function canShip(order: Pick<WorkspaceOrder, 'status' | 'lines'>): boolean {
  return (
    ['confirmed', 'approved', 'in_fulfillment', 'in_production'].includes(order.status) &&
    shippableLines(order).length > 0
  );
}

/** Backorder tree: the backorder lines of each original line, in sequence. */
export function backorderTree(
  lines: readonly WorkspaceOrderLine[],
): Map<string, WorkspaceOrderLine[]> {
  const tree = new Map<string, WorkspaceOrderLine[]>();
  for (const line of lines) {
    if (line.parent_line_id) {
      tree.set(line.parent_line_id, [...(tree.get(line.parent_line_id) ?? []), line]);
    }
  }
  for (const children of tree.values()) {
    children.sort((a, b) => a.backorder_sequence - b.backorder_sequence);
  }
  return tree;
}

/**
 * The credit position of a customer for an order not yet saved, from its credit profile: the profile exposure already
 * holds the open receivables and the committed orders, the draft total comes on top.
 */
export function exposureFromProfile(
  profile: CustomerCreditProfile,
  orderTotal: number,
): CreditExposure {
  const limit = Number(profile.credit_limit);
  const exposure = Number(profile.total_exposure) + orderTotal;
  const hasOverdue = profile.credit_status === 'blocked';
  const overLimit = limit > 0 && exposure > limit;
  return {
    credit_limit: profile.credit_limit,
    open_receivables: profile.used_credit,
    committed_orders: profile.pending_orders_amount,
    overdue_amount: profile.overdue_amount,
    overdue_invoices_count: 0,
    max_overdue_days: profile.max_overdue_days,
    order_total: orderTotal.toFixed(2),
    total_exposure: exposure.toFixed(2),
    over_limit: overLimit,
    has_overdue: hasOverdue,
    block_reason:
      overLimit && hasOverdue
        ? 'both'
        : overLimit
          ? 'credit_limit_exceeded'
          : hasOverdue
            ? 'overdue_invoices_present'
            : null,
  };
}
