import { HttpErrorResponse } from '@angular/common/http';
import {
  DcBatchStatus,
  DcDossierStatus,
  DcExclusionReason,
  DcLevel,
  DcMoneyTotal,
  DcNoticeStatus,
  DcPlanStatus,
  DcProblem,
  DcProposalGroup,
  DcProposalItem,
  DcProposalStatus,
} from '@core';

/** Module key of the access map (`MODULE_ACCESS`) and of the feature flag. */
export const DEBT_COLLECTION_MODULE = 'debt_collection';

// --- Outcomes and errors ---

/** What a store write answers: the screens show the translated error and bind the field errors of a 422. */
export interface DcOutcome {
  ok: boolean;
  /** Translation key of the refusal (`debtCollection.error.<code>`), null on success. */
  errorKey: string | null;
  /** The text the API sent (validation message or problem detail), for the cases the key does not cover. */
  detail: string | null;
  errors: Record<string, string[]>;
}

export const DC_OK: DcOutcome = { ok: true, errorKey: null, detail: null, errors: {} };

export function errorKey(code: string | null | undefined): string {
  return `debtCollection.error.${code ? code : 'generic'}`;
}

function readBlobText(blob: Blob): Promise<string> {
  if (typeof blob.text === 'function') {
    return blob.text();
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

/** The problem details of a failed call; a failed download answers a Blob that holds the JSON. */
export async function problemOf(error: unknown): Promise<DcProblem | null> {
  if (!(error instanceof HttpErrorResponse)) {
    return null;
  }
  const body: unknown = error.error;
  if (typeof Blob !== 'undefined' && body instanceof Blob) {
    try {
      return JSON.parse(await readBlobText(body)) as DcProblem;
    } catch {
      return null;
    }
  }
  return body !== null && typeof body === 'object' ? (body as DcProblem) : null;
}

/** The outcome of a failed call: the `code` of the problem picks the key, a 422 brings the field errors. */
export async function failureOf(error: unknown): Promise<DcOutcome> {
  const problem = await problemOf(error);
  const errors = problem?.errors ?? {};
  const first = Object.values(errors).flat()[0];
  return {
    ok: false,
    errorKey: errorKey(problem?.code),
    detail: first ?? problem?.detail ?? null,
    errors,
  };
}

// --- Labels and colours ---

export function levelKey(level: DcLevel | number | null | undefined): string {
  return `debtCollection.level.${level ?? 'none'}`;
}

export function levelColor(level: DcLevel | null | undefined): string {
  switch (level) {
    case 0:
      return 'blue';
    case 1:
      return 'gold';
    case 2:
      return 'orange';
    case 3:
      return 'red';
    default:
      return 'default';
  }
}

export function noticeStatusColor(status: DcNoticeStatus): string {
  switch (status) {
    case 'sent':
      return 'blue';
    case 'delivered':
      return 'green';
    case 'failed':
      return 'red';
    case 'queued':
      return 'gold';
    default:
      return 'default';
  }
}

export function batchStatusColor(status: DcBatchStatus): string {
  switch (status) {
    case 'completed':
      return 'green';
    case 'partial':
      return 'orange';
    case 'failed':
      return 'red';
    case 'processing':
      return 'blue';
    default:
      return 'default';
  }
}

export function proposalStatusColor(status: DcProposalStatus): string {
  switch (status) {
    case 'proposed':
      return 'green';
    case 'excluded':
      return 'red';
    default:
      return 'default';
  }
}

export function exclusionReasonColor(reason: DcExclusionReason | null): string {
  switch (reason) {
    case 'dispute':
    case 'legal_hold':
      return 'red';
    case 'payment_plan':
      return 'purple';
    case 'settled':
      return 'green';
    default:
      return 'default';
  }
}

export function planStatusColor(status: DcPlanStatus): string {
  switch (status) {
    case 'active':
      return 'blue';
    case 'completed':
      return 'green';
    case 'defaulted':
      return 'red';
    default:
      return 'default';
  }
}

export function dossierStatusColor(status: DcDossierStatus): string {
  switch (status) {
    case 'submitted':
      return 'blue';
    case 'closed':
      return 'default';
    default:
      return 'gold';
  }
}

// --- Notices and batches ---

/** A notice that was not sent yet (or failed) can be sent; a cancelled or delivered one cannot. */
export function canSendNotice(status: DcNoticeStatus): boolean {
  return status === 'draft' || status === 'failed' || status === 'queued';
}

export function canCancelNotice(status: DcNoticeStatus): boolean {
  return status === 'draft' || status === 'queued' || status === 'failed';
}

/** PEC receipts are registered for a PEC notice that left. */
export function canRegisterReceipt(notice: { channel: string; status: DcNoticeStatus }): boolean {
  return notice.channel === 'pec' && (notice.status === 'sent' || notice.status === 'delivered');
}

export function canRetryBatch(batch: { status: DcBatchStatus; failed: number }): boolean {
  return (batch.status === 'partial' || batch.status === 'failed') && batch.failed > 0;
}

/** Share of a batch that was processed (sent or failed), 0 to 100. */
export function batchProgress(batch: { total: number; sent: number; failed: number }): number {
  if (batch.total <= 0) {
    return 0;
  }
  return Math.min(100, Math.round(((batch.sent + batch.failed) / batch.total) * 100));
}

// --- Proposals and groups ---

/** Only a proposed item with a level can go into a notice. */
export function isSelectable(item: Pick<DcProposalItem, 'status' | 'proposed_level'>): boolean {
  return item.status === 'proposed' && item.proposed_level !== null;
}

export function groupSelectionKey(
  group: Pick<DcProposalGroup, 'customer_id' | 'currency' | 'level'>,
): string {
  return `${group.customer_id}|${group.currency}|${group.level}`;
}

/** Sum of decimal strings, exact in cents; the result is a decimal string with two decimals. */
export function sumDecimals(values: readonly string[]): string {
  const cents = values.reduce((total, value) => total + Math.round(Number(value) * 100), 0);
  return (cents / 100).toFixed(2);
}

/** Totals per currency of the selected groups. */
export function totalsByCurrency(groups: readonly DcProposalGroup[]): DcMoneyTotal[] {
  const byCurrency = new Map<string, string[]>();
  for (const group of groups) {
    byCurrency.set(group.currency, [...(byCurrency.get(group.currency) ?? []), group.total]);
  }
  return [...byCurrency.entries()].map(([currency, values]) => ({
    currency,
    amount: sumDecimals(values),
  }));
}

/** The channels the customer can be reached on, among the channels of the group. */
export function reachableChannels(group: DcProposalGroup): string[] {
  return group.channels.filter((channel) => {
    switch (channel) {
      case 'pec':
        return group.has_pec;
      case 'email':
        return group.has_email;
      case 'sms':
      case 'whatsapp':
        return group.has_phone;
      default:
        return true;
    }
  });
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** The ids of an `ngModel` that may carry null from a cleared select. */
export function orUndefined<T>(value: T | null | undefined): T | undefined {
  return value === null || value === undefined || (value as unknown) === '' ? undefined : value;
}

// --- Payment plans ---

/** Adds months to a `YYYY-MM-DD` date, keeping the day (or the last day of a shorter month). */
export function addMonths(date: string, months: number): string {
  const [year, month, day] = date.split('-').map(Number) as [number, number, number];
  const target = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target.toISOString().slice(0, 10);
}

/** Splits a total into equal monthly instalments from the start date; the cents left over go to the last one. */
export function buildInstallments(
  total: string,
  count: number,
  start: string,
): { due_date: string; amount: string }[] {
  if (count < 1 || !start) {
    return [];
  }
  const totalCents = Math.round(Number(total) * 100);
  const base = Math.floor(totalCents / count);
  return Array.from({ length: count }, (_, index) => {
    const cents = index === count - 1 ? totalCents - base * (count - 1) : base;
    return { due_date: addMonths(start, index), amount: (cents / 100).toFixed(2) };
  });
}
