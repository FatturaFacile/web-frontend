import {
  InvoiceMatchLine,
  InvoiceMatchLineStatus,
  InvoiceMatchRun,
  InvoiceMatchStatus,
  InvoiceMatchToleranceRule,
  InvoiceMatchType,
  ToleranceRulePayload,
  ToleranceScope,
} from '@domain/procurement/invoice-matching.models';

/** Visual state of a comparison cell: beyond tolerance, a variance inside the tolerance, or exact. */
export type VarianceHighlight = 'out' | 'within' | 'none';

export type VarianceField = 'quantity' | 'price' | 'amount';

export const MIN_OVERRIDE_REASON_LENGTH = 5;

const STATUS_COLORS: Record<InvoiceMatchStatus, string> = {
  matched: 'green',
  within_tolerance: 'cyan',
  blocked_discrepancy: 'red',
  pending_credit_note: 'orange',
  override_approved: 'purple',
  resolved: 'blue',
};

const LINE_STATUS_COLORS: Record<InvoiceMatchLineStatus, string> = {
  matched: 'green',
  within_tolerance: 'cyan',
  price_variance: 'red',
  quantity_variance: 'red',
  not_received: 'red',
  unmatched: 'red',
  accepted: 'blue',
};

const QUANTITY_REASONS = [
  'quantity_above_received',
  'quantity_above_ordered',
  'not_received',
  'duplicate_billing',
];
const QUANTITY_STATUSES: InvoiceMatchLineStatus[] = ['quantity_variance', 'not_received'];

/** NG-ZORRO tag colour of a run status. */
export function matchStatusColor(status: InvoiceMatchStatus): string {
  return STATUS_COLORS[status] ?? 'default';
}

/** NG-ZORRO tag colour of a line status. */
export function lineStatusColor(status: InvoiceMatchLineStatus): string {
  return LINE_STATUS_COLORS[status] ?? 'default';
}

/** Translation key of a run status (full key list: see the i18n spec). */
export const matchStatusKey = (status: string): string => `invoiceMatching.status.${status}`;
export const lineStatusKey = (status: string): string => `invoiceMatching.lineStatus.${status}`;
export const matchTypeKey = (type: string): string => `invoiceMatching.type.${type}`;
export const reasonKey = (reason: string): string => `invoiceMatching.reason.${reason}`;
export const sourceKey = (source: string): string => `invoiceMatching.source.${source}`;
export const triggerKey = (trigger: string): string => `invoiceMatching.trigger.${trigger}`;
export const scopeKey = (scope: string): string => `invoiceMatching.scope.${scope}`;
export const actionKey = (action: string): string => `invoiceMatching.action.${action}`;

const num = (value: number | string | null | undefined): number => {
  const parsed = typeof value === 'number' ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const isZero = (value: number | string | null | undefined): boolean => Math.abs(num(value)) < 1e-9;

/**
 * Highlight of one variance cell of a line.
 * - exact (zero variance): no highlight;
 * - a variance on a blocking line that caused the block: `out` (red, bold);
 * - any other variance (line within tolerance or accepted): `within` (amber).
 */
export function cellHighlight(line: InvoiceMatchLine, field: VarianceField): VarianceHighlight {
  const variance =
    field === 'quantity'
      ? line.quantity_variance
      : field === 'price'
        ? line.price_variance
        : line.amount_variance;

  if (isZero(variance)) {
    return 'none';
  }
  if (!line.is_blocking) {
    return 'within';
  }

  const quantityOut =
    line.reasons.some((reason) => QUANTITY_REASONS.includes(reason)) ||
    QUANTITY_STATUSES.includes(line.status) ||
    (line.allowed_quantity_variance !== null &&
      Math.abs(num(line.quantity_variance)) > num(line.allowed_quantity_variance));
  const priceOut =
    line.reasons.includes('price_above_tolerance') ||
    line.status === 'price_variance' ||
    line.status === 'unmatched';

  switch (field) {
    case 'quantity':
      return quantityOut || line.status === 'unmatched' ? 'out' : 'within';
    case 'price':
      return priceOut ? 'out' : 'within';
    case 'amount':
      return quantityOut ||
        priceOut ||
        (line.allowed_amount_variance !== null &&
          Math.abs(num(line.amount_variance)) > num(line.allowed_amount_variance))
        ? 'out'
        : 'within';
  }
}

/** Highlight of the whole line row (status column and row background). */
export function rowHighlight(line: InvoiceMatchLine): VarianceHighlight {
  if (line.is_blocking) {
    return 'out';
  }
  const hasVariance =
    !isZero(line.quantity_variance) ||
    !isZero(line.price_variance) ||
    !isZero(line.amount_variance);
  return line.status === 'within_tolerance' || (line.status === 'accepted' && hasVariance)
    ? 'within'
    : 'none';
}

/** CSS class of a highlight, empty for exact cells. */
export function highlightClass(highlight: VarianceHighlight): string {
  return highlight === 'out' ? 'variance-out' : highlight === 'within' ? 'variance-within' : '';
}

/** One labelled value of the tolerance snapshot of a run (`valueKey` is set when the value is itself a translation key). */
export interface ToleranceSnapshotItem {
  labelKey: string;
  value: string;
  valueKey?: string;
}

const SNAPSHOT_FIELDS: Record<string, string> = {
  name: 'invoiceMatching.form.name',
  scope: 'invoiceMatching.form.scope',
  price_tolerance_percent: 'invoiceMatching.form.priceTolerancePercent',
  price_tolerance_amount: 'invoiceMatching.form.priceToleranceAmount',
  quantity_tolerance_percent: 'invoiceMatching.form.quantityTolerancePercent',
  quantity_tolerance_amount: 'invoiceMatching.form.quantityToleranceAmount',
};

/** Turns the tolerance snapshot stored with a run into labelled values; unknown or empty fields are skipped. */
export function describeTolerance(
  snapshot: Record<string, unknown>[] | null | undefined,
): ToleranceSnapshotItem[][] {
  return (snapshot ?? []).map((entry) =>
    Object.entries(SNAPSHOT_FIELDS).flatMap(([field, labelKey]) => {
      const value = entry[field];
      if (value === null || value === undefined || typeof value === 'object') {
        return [];
      }
      return [
        field === 'scope'
          ? { labelKey, value: String(value), valueKey: scopeKey(String(value)) }
          : { labelKey, value: String(value) },
      ];
    }),
  );
}

/** Lines the user may select for a partial resolution. */
export function blockingLines(run: InvoiceMatchRun | null): InvoiceMatchLine[] {
  return (run?.lines ?? []).filter((line) => line.is_blocking);
}

/** The resolution actions are offered only while the run blocks the payment. */
export function canResolve(run: InvoiceMatchRun | null): boolean {
  return run?.is_blocking === true;
}

/** Whether a request failed with HTTP 403 (missing permission). */
export function isForbidden(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { status?: unknown }).status === 403;
}

/** Whether the scope targets a supplier (`supplier` and `rule` scopes). */
export const scopeUsesSupplier = (scope: ToleranceScope | null | undefined): boolean =>
  scope === 'supplier' || scope === 'rule';

/** Whether the scope targets an item category (`item_category` and `rule` scopes). */
export const scopeUsesCategory = (scope: ToleranceScope | null | undefined): boolean =>
  scope === 'item_category' || scope === 'rule';

/** Normalises a form value into the API body: irrelevant targets are dropped, blanks become null. */
export function toRulePayload(value: {
  name: string;
  scope: ToleranceScope;
  supplier_id: string;
  item_category: string;
  /** `any` (or null) means the rule applies to both 2-way and 3-way matching. */
  match_type: InvoiceMatchType | 'any' | null;
  priority: number;
  price_tolerance_percent: number;
  price_tolerance_amount: number;
  quantity_tolerance_percent: number | null;
  quantity_tolerance_amount: number | null;
  currency: string;
  is_active: boolean;
  notes: string;
}): ToleranceRulePayload {
  const supplier = value.supplier_id.trim();
  const category = value.item_category.trim();
  const currency = value.currency.trim().toUpperCase();
  const notes = value.notes.trim();

  return {
    name: value.name.trim(),
    scope: value.scope,
    supplier_id: scopeUsesSupplier(value.scope) && supplier ? supplier : null,
    item_category: scopeUsesCategory(value.scope) && category ? category : null,
    match_type: value.match_type === 'any' ? null : value.match_type,
    priority: value.priority,
    price_tolerance_percent: value.price_tolerance_percent,
    price_tolerance_amount: value.price_tolerance_amount,
    quantity_tolerance_percent: value.quantity_tolerance_percent,
    quantity_tolerance_amount: value.quantity_tolerance_amount,
    currency: currency || null,
    is_active: value.is_active,
    notes: notes || null,
  };
}

/** Form defaults of an existing rule. */
export function ruleToFormValue(rule: InvoiceMatchToleranceRule) {
  return {
    name: rule.name,
    scope: rule.scope,
    supplier_id: rule.supplier_id ?? '',
    item_category: rule.item_category ?? '',
    match_type: (rule.match_type ?? 'any') as InvoiceMatchType | 'any',
    priority: rule.priority,
    price_tolerance_percent: rule.price_tolerance_percent,
    price_tolerance_amount: rule.price_tolerance_amount,
    quantity_tolerance_percent: rule.quantity_tolerance_percent,
    quantity_tolerance_amount: rule.quantity_tolerance_amount,
    currency: rule.currency ?? '',
    is_active: rule.is_active,
    notes: rule.notes ?? '',
  };
}
