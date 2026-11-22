import { HttpErrorResponse } from '@angular/common/http';
import {
  ArBucket,
  ArDecisionOutcome,
  ArItem,
  ArItemFilters,
  ArItemStatus,
  ArRiskRating,
  ArValidationError,
  AR_ITEM_STATUSES,
} from '@core';

/** The module key of the access map (`MODULE_ACCESS`) that gates the receivables pages. */
export const RECEIVABLES_MODULE = 'receivables';

/** Translate function shape used by the label helpers (`TranslateService.instant`). */
export type Translator = (key: string, params?: Record<string, string | number>) => string;

// --- Decimal strings: money is compared and summed as integer cents, never as a float ---

const AMOUNT_PATTERN = /^(-)?(\d+)(?:\.(\d{1,2}))?$/;

/** Cents of a decimal string with at most two decimals, `null` when it is not a plain amount. */
export function parseAmount(value: string | null | undefined): bigint | null {
  if (value === null || value === undefined) {
    return null;
  }
  const match = AMOUNT_PATTERN.exec(value.trim());
  if (!match) {
    return null;
  }
  const [, sign, whole, fraction = ''] = match;
  const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
  return sign ? -cents : cents;
}

/** Decimal string with two decimals of an amount in cents. */
export function formatAmount(cents: bigint): string {
  const negative = cents < 0n;
  const absolute = negative ? -cents : cents;
  const whole = absolute / 100n;
  const fraction = (absolute % 100n).toString().padStart(2, '0');
  return `${negative ? '-' : ''}${whole.toString()}.${fraction}`;
}

export function addAmounts(a: string, b: string): string {
  return formatAmount((parseAmount(a) ?? 0n) + (parseAmount(b) ?? 0n));
}

export function subAmounts(a: string, b: string): string {
  return formatAmount((parseAmount(a) ?? 0n) - (parseAmount(b) ?? 0n));
}

/** -1, 0 or 1; an unparsable amount counts as zero. */
export function compareAmounts(a: string, b: string): -1 | 0 | 1 {
  const left = parseAmount(a) ?? 0n;
  const right = parseAmount(b) ?? 0n;
  return left < right ? -1 : left > right ? 1 : 0;
}

export function minAmount(a: string, b: string): string {
  return compareAmounts(a, b) <= 0 ? a : b;
}

export function isPositiveAmount(value: string | null | undefined): boolean {
  const cents = parseAmount(value);
  return cents !== null && cents > 0n;
}

export function sumAmounts(values: readonly string[]): string {
  return formatAmount(values.reduce((sum, value) => sum + (parseAmount(value) ?? 0n), 0n));
}

/** Share (0 to 100) of an amount in a maximum, for the width of a bar. Display only. */
export function barShare(amount: string | null | undefined, max: string | null | undefined): number {
  const value = parseAmount(amount);
  const top = parseAmount(max);
  if (value === null || top === null || top <= 0n || value <= 0n) {
    return 0;
  }
  return Math.min(100, Math.round(Number((value * 10000n) / top) / 100));
}

// --- Dates ---

/** `YYYY-MM-DD` of a local date (the date picker hands over local midnight, so no UTC shift). */
export function toIsoDate(date: Date | null | undefined): string | null {
  if (!date) {
    return null;
  }
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function fromIsoDate(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : null;
}

/** The `[from, to]` of a range picker, empty (nothing selected) unless both ends are known. */
export function dateRange(from: string | null | undefined, to: string | null | undefined): Date[] {
  const start = fromIsoDate(from);
  const end = fromIsoDate(to);
  return start && end ? [start, end] : [];
}

export function todayIso(now: Date = new Date()): string {
  return toIsoDate(now) as string;
}

/** The default statement period: from 1 January of the year to today. */
export function defaultStatementPeriod(now: Date = new Date()): { from: string; to: string } {
  return { from: `${now.getFullYear()}-01-01`, to: todayIso(now) };
}

// --- Labels and colours ---

/** Translation key and params of the label of an aging bucket (`current`, `1-30`, `121+`), from the bounds of the response. */
export function bucketLabelParts(bucket: ArBucket): {
  key: string;
  params?: Record<string, number>;
} {
  if (bucket.key === 'current') {
    return { key: 'AR.BUCKET_CURRENT' };
  }
  if (bucket.to === null || bucket.to === undefined) {
    return { key: 'AR.BUCKET_OVER', params: { from: bucket.from ?? 0 } };
  }
  return { key: 'AR.BUCKET_RANGE', params: { from: bucket.from ?? 0, to: bucket.to } };
}

/**
 * Label of a bucket known by its key only (the filter chip of the open items list): the key encodes the bounds
 * (`1_30`, `121_plus`), the pseudo bucket `over_90` is the sum of the oldest ones.
 */
export function bucketPartsFromKey(key: string): { key: string; params?: Record<string, number | string> } {
  if (key === 'current') {
    return { key: 'AR.BUCKET_CURRENT' };
  }
  if (key === 'over_90') {
    return { key: 'AR.BUCKET_OVER_90' };
  }
  const range = /^(\d+)_(\d+)$/.exec(key);
  if (range) {
    return { key: 'AR.BUCKET_RANGE', params: { from: Number(range[1]), to: Number(range[2]) } };
  }
  const over = /^(\d+)_plus$/.exec(key);
  if (over) {
    return { key: 'AR.BUCKET_OVER', params: { from: Number(over[1]) } };
  }
  return { key: 'AR.BUCKET_OTHER', params: { bucket: key } };
}

/** Column label of an aging bucket in the active language. */
export function bucketLabel(bucket: ArBucket, translate: Translator): string {
  const { key, params } = bucketLabelParts(bucket);
  return translate(key, params);
}

/** Bar colour of an aging bucket: the further past due, the warmer. */
export function bucketColor(index: number, count: number): string {
  if (index <= 0) {
    return '#52c41a';
  }
  const ratio = count <= 2 ? 1 : (index - 1) / (count - 2);
  if (ratio < 0.34) {
    return '#faad14';
  }
  if (ratio < 0.67) {
    return '#fa8c16';
  }
  return '#f5222d';
}

export function statusColor(status: ArItemStatus): string {
  switch (status) {
    case 'overdue':
      return 'red';
    case 'disputed':
      return 'orange';
    case 'partially_paid':
      return 'blue';
    case 'paid':
      return 'green';
    case 'written_off':
      return 'default';
    default:
      return 'processing';
  }
}

export function ratingColor(rating: ArRiskRating): string {
  switch (rating) {
    case 'low':
      return 'green';
    case 'medium':
      return 'gold';
    case 'high':
      return 'orange';
    default:
      return 'red';
  }
}

export function outcomeColor(outcome: ArDecisionOutcome): string {
  return outcome === 'block' ? 'red' : outcome === 'warning' ? 'orange' : 'green';
}

/** Numeric percent of the utilisation (the API sends a number or a decimal string), `null` without a limit. */
export function utilizationValue(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function utilizationStatus(percent: number | null): 'success' | 'normal' | 'exception' {
  if (percent === null) {
    return 'normal';
  }
  return percent >= 100 ? 'exception' : 'success';
}

/** Whether an item can still be allocated (money is open on it and it is not written off). */
export function isOpenItem(item: Pick<ArItem, 'status' | 'open_amount'>): boolean {
  return item.status !== 'written_off' && item.status !== 'paid' && isPositiveAmount(item.open_amount);
}

// --- Errors ---

/** The message of a failed API call: the first validation error, else the `message` of the body. */
export function apiErrorMessage(error: unknown): string | null {
  if (!(error instanceof HttpErrorResponse)) {
    return null;
  }
  const body = error.error as (ArValidationError & { detail?: string }) | null;
  const first = body?.errors ? Object.values(body.errors).flat()[0] : undefined;
  return first ?? body?.detail ?? body?.message ?? null;
}

/** Validation errors of a 422 per field name. */
export function fieldErrors(error: unknown): Record<string, string[]> {
  if (error instanceof HttpErrorResponse && error.status === 422) {
    return (error.error as ArValidationError | null)?.errors ?? {};
  }
  return {};
}

// --- Open items query string (drill-down links) ---

const ITEM_QUERY_KEYS = [
  'customer_id',
  'status',
  'document_type',
  'currency',
  'due_from',
  'due_to',
  'issued_from',
  'issued_to',
  'value_from',
  'value_to',
  'bucket',
] as const;

/** The filters of the open items list carried by a router query string (`?bucket=31_60&customer_id=...`). */
export function itemFiltersFromQuery(query: Readonly<Record<string, unknown>>): ArItemFilters {
  const filters: ArItemFilters = {};
  for (const key of ITEM_QUERY_KEYS) {
    const value = query[key];
    if (typeof value === 'string' && value !== '') {
      if (key === 'status') {
        if ((AR_ITEM_STATUSES as readonly string[]).includes(value)) {
          filters.status = value as ArItemStatus;
        }
      } else {
        filters[key] = value;
      }
    }
  }
  if (query['open_only'] === '0' || query['open_only'] === 'false') {
    filters.open_only = false;
  } else if (query['open_only'] === '1' || query['open_only'] === 'true') {
    filters.open_only = true;
  }
  return filters;
}

/** Router query params of the filters: empty values are dropped so the url stays short. */
export function itemFiltersToQuery(filters: ArItemFilters): Record<string, string> {
  const query: Record<string, string> = {};
  for (const key of ITEM_QUERY_KEYS) {
    const value = filters[key];
    if (value !== undefined && value !== '') {
      query[key] = value;
    }
  }
  if (filters.open_only !== undefined) {
    query['open_only'] = filters.open_only ? '1' : '0';
  }
  return query;
}

/** File name of a statement download. */
export function statementFileName(
  customerName: string,
  from: string,
  to: string,
  extension: 'pdf' | 'xlsx',
): string {
  const slug =
    customerName
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'customer';
  return `statement-${slug}-${from}-${to}.${extension}`;
}

/** What a store write answers: the screens show the message and bind the field errors of a 422. */
export interface ArOutcome {
  ok: boolean;
  message: string | null;
  errors: Record<string, string[]>;
}

export const AR_OK: ArOutcome = { ok: true, message: null, errors: {} };

export function arFailure(error: unknown): ArOutcome {
  return { ok: false, message: apiErrorMessage(error), errors: fieldErrors(error) };
}

/**
 * Router query params that open the open items list on a bucket (and a customer): the drill-down of the aging chart and
 * matrix. A `null` bucket opens all the open items of the customer.
 */
export function drilldownQuery(
  bucket: string | null,
  customerId?: string | null,
  currency?: string | null,
): Record<string, string> {
  return itemFiltersToQuery({
    ...(bucket ? { bucket } : {}),
    ...(customerId ? { customer_id: customerId } : {}),
    ...(currency ? { currency } : {}),
    open_only: true,
  });
}
