import { HttpErrorResponse } from '@angular/common/http';
import {
  IcAnomalyType,
  IcEliminationType,
  IcLinkStatus,
  IcMatchStatus,
  IcNettingStatus,
  IcPaymentStatus,
  IcRunStatus,
  IcStandard,
} from '@core';

export const IC_MODULE = 'intercompany';

export const IC_STANDARDS: readonly IcStandard[] = ['fer30', 'ifrs10', 'oic17'];
export const IC_ANOMALY_FILTERS: readonly Exclude<IcAnomalyType, 'none'>[] = [
  'timing',
  'fx',
  'amount',
  'tax',
  'missing_counterpart',
];
export const IC_MATCH_STATUSES: readonly IcMatchStatus[] = ['unmatched', 'matched', 'disputed', 'written_off', 'adjusted'];
export const IC_LINK_STATUSES: readonly IcLinkStatus[] = ['pending', 'drafted', 'confirmed', 'reversed', 'failed', 'skipped'];
export const IC_PAYMENT_STATUSES: readonly IcPaymentStatus[] = ['unpaid', 'partial', 'paid'];
export const IC_ELIMINATION_TYPES: readonly IcEliminationType[] = [
  'intercompany_balance',
  'intercompany_revenue_cost',
  'unrealised_profit',
  'investment_equity',
  'equity_method',
  'dividend',
  'translation_difference',
  'goodwill',
  'goodwill_amortisation',
  'fair_value_release',
  'provision_release',
  'manual',
];

/** The steps of the guided consolidation run, in order. */
export const IC_RUN_STEPS = ['scope', 'translation', 'eliminations', 'review', 'close'] as const;
export type IcRunStep = (typeof IC_RUN_STEPS)[number];

// --- Outcomes and errors ---

/** What a store write answers: the screens show the translated error and bind the field errors of a 422. */
export interface IcOutcome {
  ok: boolean;
  /** Translation key of the refusal (`intercompany.error.<code>`), null on success. */
  errorKey: string | null;
  /** The text the API sent, for the cases the key does not cover. */
  detail: string | null;
  errors: Record<string, string[]>;
  status: number | null;
}

export const IC_OK: IcOutcome = { ok: true, errorKey: null, detail: null, errors: {}, status: null };

export function icErrorKey(code: string): string {
  return `intercompany.error.${code}`;
}

interface IcProblem {
  code?: string;
  message?: string;
  errors?: Record<string, string[]>;
}

/** The code of a failure: the `code` the API sent, else one picked from the HTTP status. */
export function icErrorCode(status: number | null, code: string | undefined): string {
  if (code) {
    return code;
  }
  switch (status) {
    case 403:
      return 'forbidden';
    case 404:
      return 'not_found';
    case 409:
      return 'conflict';
    case 422:
      return 'validation';
    default:
      return 'generic';
  }
}

export function failureOf(error: unknown): IcOutcome {
  if (!(error instanceof HttpErrorResponse)) {
    return { ok: false, errorKey: icErrorKey('generic'), detail: null, errors: {}, status: null };
  }
  const body: unknown = error.error;
  const problem: IcProblem | null = body !== null && typeof body === 'object' ? (body as IcProblem) : null;
  const errors = problem?.errors ?? {};
  const first = Object.values(errors).flat()[0] ?? problem?.message ?? null;
  return {
    ok: false,
    errorKey: icErrorKey(icErrorCode(error.status, problem?.code)),
    detail: first,
    errors,
    status: error.status,
  };
}

// --- Labels and colours ---

/** Translation key of the label of an enum code (`intercompany.enum.<enumName>.<code>`). */
export function enumKey(enumName: string, code: string | null | undefined): string {
  return `intercompany.enum.${enumName}.${code ?? 'none'}`;
}

export function linkStatusColor(status: IcLinkStatus): string {
  switch (status) {
    case 'confirmed':
      return 'green';
    case 'drafted':
      return 'blue';
    case 'failed':
      return 'red';
    case 'reversed':
      return 'volcano';
    default:
      return 'default';
  }
}

export function paymentStatusColor(status: IcPaymentStatus): string {
  switch (status) {
    case 'paid':
      return 'green';
    case 'partial':
      return 'gold';
    default:
      return 'default';
  }
}

export function matchStatusColor(status: IcMatchStatus): string {
  switch (status) {
    case 'matched':
      return 'green';
    case 'disputed':
      return 'red';
    case 'written_off':
      return 'volcano';
    case 'adjusted':
      return 'purple';
    default:
      return 'gold';
  }
}

export function anomalyColor(type: IcAnomalyType): string {
  switch (type) {
    case 'none':
      return 'green';
    case 'timing':
      return 'blue';
    case 'fx':
      return 'purple';
    case 'amount':
      return 'orange';
    case 'tax':
      return 'magenta';
    default:
      return 'red';
  }
}

export function nettingStatusColor(status: IcNettingStatus): string {
  switch (status) {
    case 'confirmed':
      return 'green';
    case 'cancelled':
      return 'default';
    default:
      return 'blue';
  }
}

export function runStatusColor(status: IcRunStatus): string {
  switch (status) {
    case 'locked':
    case 'posted':
      return 'green';
    case 'review':
      return 'gold';
    case 'calculating':
      return 'blue';
    default:
      return 'default';
  }
}

/** The step of the wizard that matches a workflow status. */
export function stepIndexOf(status: IcRunStatus | null): number {
  switch (status) {
    case 'calculating':
      return 1;
    case 'review':
      return 3;
    case 'locked':
    case 'posted':
      return 4;
    default:
      return 0;
  }
}

/** True when a workflow status no longer accepts edits. */
export function isClosedRun(status: IcRunStatus | null): boolean {
  return status === 'locked' || status === 'posted';
}

/** A decimal string as a number for sums on the screen only; amounts stay strings on the wire. */
export function amountOf(value: string | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** True when the string is an amount that is not zero. */
export function isNonZero(value: string | null | undefined): boolean {
  return amountOf(value) !== 0;
}

/** Total of the anomaly counts of a matrix cell. */
export function anomalyTotal(counts: Record<string, number>): number {
  return Object.values(counts).reduce((sum, count) => sum + count, 0);
}

/** Key of the pair of two entities, the same whichever side is first. */
export function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

export function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

export function packageFileName(standard: IcStandard, runId: string, format: string): string {
  return `consolidated-package-${standard}-${runId.slice(0, 8)}.${format}`;
}

/** Runs a write and turns its failure into an outcome; the value is null when it failed. */
export async function attempt<T>(call: () => Promise<T>): Promise<{ outcome: IcOutcome; value: T | null }> {
  try {
    return { outcome: IC_OK, value: await call() };
  } catch (error) {
    return { outcome: failureOf(error), value: null };
  }
}
