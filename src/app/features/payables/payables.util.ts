import {
  ApAgingBucket,
  ApBatch,
  ApBatchStatus,
  ApExportFormat,
  ApItem,
  ApItemFilters,
  ApItemStatus,
  ApSkonto,
  ApSkontoState,
  AP_DOCUMENT_TYPES,
  AP_ITEM_STATUSES,
  ApDocumentType,
} from '@core';
import { AR_OK, ArOutcome, arFailure, isPositiveAmount } from '../receivables/receivables.util';

// Money, date and error helpers are shared with the receivables feature: same decimal-string contract.
export {
  addAmounts,
  apiErrorMessage,
  barShare,
  compareAmounts,
  dateRange,
  fieldErrors,
  fromIsoDate,
  isPositiveAmount,
  parseAmount,
  subAmounts,
  sumAmounts,
  todayIso,
  toIsoDate,
} from '../receivables/receivables.util';

/** The module key of the access map (`MODULE_ACCESS`) that gates the payables pages. */
export const PAYABLES_MODULE = 'payables';

/** Module key of the roles that approve a payment batch and execute the payment (CFO / owner). */
export const PAYABLES_APPROVAL_MODULE = 'payables_approval';

/** Days left under which a Skonto is shown as expiring. */
export const SKONTO_EXPIRING_DAYS = 3;

/** What a store write answers: the screens show the message and bind the field errors of a 422. */
export type ApOutcome = ArOutcome;
export const AP_OK: ApOutcome = AR_OK;
export const apFailure = arFailure;

// --- Items ---

export function itemStatusColor(status: ApItemStatus): string {
  switch (status) {
    case 'in_batch':
      return 'blue';
    case 'authorized':
      return 'cyan';
    case 'paid':
      return 'green';
    case 'disputed':
      return 'orange';
    case 'blocked':
      return 'red';
    default:
      return 'processing';
  }
}

export function isCreditNote(item: Pick<ApItem, 'document_type'>): boolean {
  return item.document_type === 'credit_note';
}

/** Disputed and administratively blocked items can never be put in a batch or authorised. */
export function isBlockedItem(item: Pick<ApItem, 'status'>): boolean {
  return item.status === 'disputed' || item.status === 'blocked';
}

export function isOpenItem(item: Pick<ApItem, 'status' | 'open_amount'>): boolean {
  return item.status !== 'paid' && isPositiveAmount(item.open_amount.replace(/^-/, ''));
}

/** Whether the item can be ticked for a payment: open, not blocked or disputed, not a credit note. */
export function isPayable(item: Pick<ApItem, 'status' | 'open_amount' | 'document_type'>): boolean {
  return item.status === 'open' && !isCreditNote(item) && isPositiveAmount(item.open_amount);
}

export function canBlockItem(item: Pick<ApItem, 'status'>): boolean {
  return item.status === 'open';
}

export function canReleaseItem(item: Pick<ApItem, 'status'>): boolean {
  return isBlockedItem(item);
}

export function isOverdue(item: Pick<ApItem, 'due_date' | 'status'>, today: string): boolean {
  return item.status !== 'paid' && item.due_date < today;
}

// --- Skonto ---

export function skontoState(skonto: ApSkonto | null | undefined): ApSkontoState {
  if (!skonto) {
    return 'none';
  }
  if (skonto.days_remaining < 0) {
    return 'expired';
  }
  return skonto.days_remaining <= SKONTO_EXPIRING_DAYS ? 'expiring' : 'active';
}

export function skontoColor(state: ApSkontoState): string {
  switch (state) {
    case 'active':
      return 'green';
    case 'expiring':
      return 'orange';
    case 'expired':
      return 'default';
    default:
      return 'default';
  }
}

/** Translation key and params of the days left to capture the Skonto. */
export function skontoDaysParts(skonto: ApSkonto): { key: string; params: Record<string, number> } {
  const days = skonto.days_remaining;
  if (days < 0) {
    return { key: 'AP.SKONTO_EXPIRED_DAYS', params: { days: Math.abs(days) } };
  }
  if (days === 0) {
    return { key: 'AP.SKONTO_LAST_DAY', params: {} };
  }
  return { key: 'AP.SKONTO_DAYS_LEFT', params: { days } };
}

/** An item shows Skonto savings only while the discount can still be taken. */
export function skontoCapturable(item: Pick<ApItem, 'skonto' | 'status'>): boolean {
  const state = skontoState(item.skonto);
  return (state === 'active' || state === 'expiring') && item.status === 'open';
}

// --- Batches ---

export function batchStatusColor(status: ApBatchStatus): string {
  switch (status) {
    case 'pending_approval':
      return 'gold';
    case 'approved':
      return 'cyan';
    case 'executed':
      return 'green';
    case 'rejected':
      return 'red';
    case 'cancelled':
      return 'default';
    default:
      return 'processing';
  }
}

export function canSubmitBatch(batch: Pick<ApBatch, 'status'>): boolean {
  return batch.status === 'draft' || batch.status === 'rejected';
}

export function canDecideBatch(batch: Pick<ApBatch, 'status'>): boolean {
  return batch.status === 'pending_approval';
}

export function canExecuteBatch(batch: Pick<ApBatch, 'status'>): boolean {
  return batch.status === 'approved';
}

export function canCancelBatch(batch: Pick<ApBatch, 'status'>): boolean {
  return (
    batch.status === 'draft' || batch.status === 'rejected' || batch.status === 'pending_approval'
  );
}

/** `IT60 X054 ...` grouping of an IBAN for display. */
export function formatIban(iban: string | null | undefined): string {
  if (!iban) {
    return '';
  }
  return iban
    .replace(/\s+/g, '')
    .replace(/(.{4})/g, '$1 ')
    .trim();
}

// --- Aging ---

export function bucketLabelParts(bucket: Pick<ApAgingBucket, 'key' | 'from' | 'to'>): {
  key: string;
  params?: Record<string, number>;
} {
  if (bucket.key === 'current') {
    return { key: 'AP.BUCKET_CURRENT' };
  }
  if (bucket.to === null || bucket.to === undefined) {
    return { key: 'AP.BUCKET_OVER', params: { from: bucket.from ?? 0 } };
  }
  return { key: 'AP.BUCKET_RANGE', params: { from: bucket.from ?? 0, to: bucket.to } };
}

export function agingFileName(asOf: string, extension: ApExportFormat): string {
  return `payables-aging-${asOf}.${extension}`;
}

// --- Query string (shareable filters) ---

const ITEM_QUERY_KEYS = [
  'supplier_id',
  'status',
  'document_type',
  'currency',
  'due_from',
  'due_to',
  'search',
] as const;

export function itemFiltersFromQuery(query: Readonly<Record<string, unknown>>): ApItemFilters {
  const filters: ApItemFilters = {};
  for (const key of ITEM_QUERY_KEYS) {
    const value = query[key];
    if (typeof value !== 'string' || value === '') {
      continue;
    }
    if (key === 'status') {
      if ((AP_ITEM_STATUSES as readonly string[]).includes(value)) {
        filters.status = value as ApItemStatus;
      }
    } else if (key === 'document_type') {
      if ((AP_DOCUMENT_TYPES as readonly string[]).includes(value)) {
        filters.document_type = value as ApDocumentType;
      }
    } else {
      filters[key] = value;
    }
  }
  const flag = (name: string): boolean | undefined =>
    query[name] === '1' || query[name] === 'true'
      ? true
      : query[name] === '0' || query[name] === 'false'
        ? false
        : undefined;
  const openOnly = flag('open_only');
  if (openOnly !== undefined) {
    filters.open_only = openOnly;
  }
  const skontoOnly = flag('skonto_only');
  if (skontoOnly !== undefined) {
    filters.skonto_only = skontoOnly;
  }
  return filters;
}

export function itemFiltersToQuery(filters: ApItemFilters): Record<string, string> {
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
  if (filters.skonto_only !== undefined) {
    query['skonto_only'] = filters.skonto_only ? '1' : '0';
  }
  return query;
}
