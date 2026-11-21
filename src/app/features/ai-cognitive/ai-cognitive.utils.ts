import {
  AiSuggestion,
  AutomationRule,
  ConfidenceBand,
  Priority,
  SuggestionKind,
  SuggestionStatus,
} from './ai-cognitive.models';

/** Confidence from which a score is shown as high (green) and medium (amber); below it is low (red). */
export const HIGH_CONFIDENCE = 0.9;
export const MEDIUM_CONFIDENCE = 0.7;

export const DRAFT_KINDS: readonly SuggestionKind[] = [
  'sales_quote',
  'purchase_order',
  'support_ticket',
  'contact',
];

export const INSIGHT_KINDS: readonly SuggestionKind[] = [
  'late_payment_risk',
  'churn_risk',
  'reorder',
  'cash_flow_alert',
];

/** Every kind, in the order of the filter chips of the workbench. */
export const ALL_KINDS: readonly SuggestionKind[] = [
  ...DRAFT_KINDS,
  'accounting_coding',
  'reconciliation_match',
  'anomaly',
  ...INSIGHT_KINDS,
];

export const STATUSES: readonly SuggestionStatus[] = [
  'pending',
  'auto_approved',
  'approved',
  'edited_approved',
  'rejected',
  'expired',
  'failed',
];

export const PRIORITIES: readonly Priority[] = ['high', 'normal', 'low'];

/** The top level fields of a payload the reviewer sees, so a label exists in every language for each of them. */
export const FIELD_KEYS: readonly string[] = [
  'contact_id',
  'supplier_id',
  'customer_id',
  'customer',
  'supplier',
  'currency',
  'valid_until',
  'order_date',
  'expected_delivery_date',
  'notes',
  'items',
  'lines',
  'description',
  'quantity',
  'quantity_ordered',
  'unit_price',
  'tax_rate',
  'uom',
  'title',
  'priority',
  'contact_email',
  'contact_phone',
  'type',
  'company_name',
  'first_name',
  'last_name',
  'email',
  'phone',
  'vat_number',
  'country',
  'gl_account_id',
  'account_code',
  'vat_code_id',
  'vat_code',
  'vat_rate',
  'cost_center_id',
  'bank_transaction_id',
  'invoice_id',
  'invoice_ids',
  'match_type',
  'amount',
  'open_amount',
  'rule',
  'severity',
  'subject_type',
  'subject_id',
  'details',
  'risk_tier',
  'average_days_late',
  'on_time_probability',
  'recommended_action',
  'invoices_prior_90_days',
  'invoices_last_90_days',
  'revenue_prior',
  'revenue_recent',
  'stock_item_id',
  'sku',
  'name',
  'available',
  'reorder_point',
  'suggested_quantity',
  'lead_time_days',
  'first_negative_date',
  'p10_balance',
  'p50_balance_at_date',
  'horizon_days',
  'run_id',
];

export function confidenceBand(score: number): ConfidenceBand {
  if (score >= HIGH_CONFIDENCE) {
    return 'high';
  }

  return score >= MEDIUM_CONFIDENCE ? 'medium' : 'low';
}

/** NG-ZORRO tag colour of a confidence band. */
export function bandColor(band: ConfidenceBand): string {
  return band === 'high' ? 'green' : band === 'medium' ? 'gold' : 'red';
}

export function priorityColor(priority: Priority): string {
  return priority === 'high' ? 'red' : priority === 'normal' ? 'blue' : 'default';
}

export function percent(score: number): string {
  return `${Math.round(score * 100)}%`;
}

/** A draft that creates an ERP record can be corrected before it is approved. */
export function isDraftKind(kind: SuggestionKind): boolean {
  return DRAFT_KINDS.includes(kind);
}

export function isInsightKind(kind: SuggestionKind): boolean {
  return INSIGHT_KINDS.includes(kind);
}

export function isOpen(status: SuggestionStatus): boolean {
  return status === 'pending' || status === 'failed';
}

/**
 * What the policy of a workflow would do with a result: act without a person (`auto`), send it to the review workbench
 * (`review`) or not run the workflow at all (`off`). The server applies the same rule: automatic approval is on, the confidence
 * reaches the threshold and the amount, when there is one, stays below the limit.
 */
export type PolicyOutcome = 'auto' | 'review' | 'off';

export function policyOutcome(
  rule: Pick<
    AutomationRule,
    'is_enabled' | 'auto_approve_enabled' | 'auto_approve_min_confidence' | 'max_auto_amount'
  >,
  confidence: number,
  amount: number | null,
): PolicyOutcome {
  if (!rule.is_enabled) {
    return 'off';
  }

  if (!rule.auto_approve_enabled || confidence < rule.auto_approve_min_confidence) {
    return 'review';
  }

  return rule.max_auto_amount === null || amount === null || amount < rule.max_auto_amount
    ? 'auto'
    : 'review';
}

/** Client route of the record a decided suggestion produced, or of the subject of an alert. */
export function entityRoute(type: string | null, id: string | null): string | null {
  if (type === null || id === null) {
    return null;
  }

  const routes: Record<string, string> = {
    quotes: '/quotes',
    contacts: '/contacts',
    invoices: '/invoices',
    invoice: '/invoices',
  };

  return routes[type] === undefined ? null : `${routes[type]}/${id}`;
}

/** Where the one-click action of an insight leads: the customer, the invoice or the quote concerned. */
export function actionRoute(suggestion: AiSuggestion): string | null {
  const payload = suggestion.proposed_payload;

  switch (suggestion.kind) {
    case 'late_payment_risk':
    case 'churn_risk':
      return entityRoute('contacts', stringOrNull(payload['customer_id']));
    case 'anomaly':
      return entityRoute(
        stringOrNull(payload['subject_type']),
        stringOrNull(payload['subject_id']),
      );
    default:
      return entityRoute(suggestion.resulting_entity_type, suggestion.resulting_entity_id);
  }
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

/** The fields of a payload that are plain values, in their order, for the read-only summary of an alert. */
export function scalarEntries(
  payload: Record<string, unknown>,
): [string, string | number | boolean][] {
  return Object.entries(payload).filter((entry): entry is [string, string | number | boolean] =>
    ['string', 'number', 'boolean'].includes(typeof entry[1]),
  );
}

/** A copy of the payload with one top level field changed. */
export function withField(
  payload: Record<string, unknown>,
  key: string,
  value: unknown,
): Record<string, unknown> {
  return { ...payload, [key]: value };
}

/** A copy of the payload with one cell of a list of rows (items, lines) changed. */
export function withCell(
  payload: Record<string, unknown>,
  listKey: string,
  row: number,
  column: string,
  value: unknown,
): Record<string, unknown> {
  const rows = Array.isArray(payload[listKey])
    ? (payload[listKey] as Record<string, unknown>[])
    : [];

  return {
    ...payload,
    [listKey]: rows.map((item, index) => (index === row ? { ...item, [column]: value } : item)),
  };
}

/** Whether the reviewer changed the payload: an unchanged one is approved as proposed. */
export function isEdited(
  original: Record<string, unknown>,
  edited: Record<string, unknown>,
): boolean {
  return JSON.stringify(original) !== JSON.stringify(edited);
}

/** The value an input gives back keeps the type of the field it edits (a number stays a number, empty becomes null). */
export function coerceInput(previous: unknown, raw: string): unknown {
  if (raw.trim() === '') {
    return null;
  }

  if (typeof previous === 'number') {
    const parsed = Number(raw);

    return Number.isFinite(parsed) ? parsed : previous;
  }

  return raw;
}
