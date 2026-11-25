import { HttpErrorResponse } from '@angular/common/http';
import {
  FrnAgreementStatus,
  FrnDecimal,
  FrnFinding,
  FrnPosition,
  FrnProblem,
  FrnPushStatus,
  FrnStatementStatus,
  FrnStoreStatus,
  FrnTargetStatus,
} from '@core';

/** Module keys of the access map (`MODULE_ACCESS`). */
export const FRANCHISE_NETWORK_MODULE = 'franchise_network';
/** The franchise director: agreements, formulas, pushes, billing, stores. */
export const FRANCHISE_NETWORK_MANAGE_MODULE = 'franchise_network_manage';
/** The area manager (and the director): store audits. */
export const FRANCHISE_NETWORK_AUDIT_MODULE = 'franchise_network_audit';
/** The franchisee owner and manager: link the store, acknowledge the pushes. */
export const FRANCHISE_NETWORK_PORTAL_MODULE = 'franchise_network_portal';

// --- Outcomes and errors ---

/** What a store write answers: the screens show the translated error and the field errors of a 422. */
export interface FrnOutcome {
  ok: boolean;
  /** Translation key of the refusal (`franchiseNetwork.error.<code>`), null on success. */
  errorKey: string | null;
  code: string | null;
  /** The text the API sent (validation message or problem detail), for the cases the key does not cover. */
  detail: string | null;
  /** The parameters the API sent with the problem, scalars only (the texts of the dictionary use them). */
  params: Record<string, string | number>;
  errors: Record<string, string[]>;
}

export const FRN_OK: FrnOutcome = {
  ok: true,
  errorKey: null,
  code: null,
  detail: null,
  params: {},
  errors: {},
};

export function errorKey(code: string | null | undefined): string {
  return `franchiseNetwork.error.${code ? code : 'generic'}`;
}

export function problemOf(error: unknown): FrnProblem | null {
  if (!(error instanceof HttpErrorResponse)) {
    return null;
  }
  const body: unknown = error.error;
  return body !== null && typeof body === 'object' ? (body as FrnProblem) : null;
}

function scalarParams(
  params: Record<string, unknown> | undefined,
): Record<string, string | number> {
  const result: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(params ?? {})) {
    if (typeof value === 'string' || typeof value === 'number') {
      result[key] = value;
    }
  }
  return result;
}

/** The outcome of a failed call: the `code` of the problem picks the key, a 422 brings the field errors. */
export function failureOf(error: unknown): FrnOutcome {
  const problem = problemOf(error);
  const errors = problem?.errors ?? {};
  const first = Object.values(errors).flat()[0];
  return {
    ok: false,
    errorKey: errorKey(problem?.code),
    code: problem?.code ?? null,
    detail: first ?? problem?.detail ?? null,
    params: scalarParams(problem?.params),
    errors,
  };
}

// --- Numbers and periods ---

export function toNumber(value: FrnDecimal | null | undefined): number {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(value ?? '');
  return Number.isFinite(parsed) ? parsed : 0;
}

/** The month that just ended, as `YYYY-MM`: the period the billing and the benchmark work on. */
export function defaultPeriod(today: Date = new Date()): string {
  const month = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  return `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;
}

export function isPeriod(value: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

/** `YYYY-MM` of a date picked in the month picker. */
export function periodOf(date: Date | null): string | null {
  return date === null ? null : defaultPeriod(new Date(date.getFullYear(), date.getMonth() + 1, 1));
}

// --- Colours ---

const AGREEMENT_COLORS: Record<FrnAgreementStatus, string> = {
  draft: 'default',
  active: 'green',
  renewed: 'blue',
  terminated: 'red',
  expired: 'orange',
};

export function agreementStatusColor(status: FrnAgreementStatus): string {
  return AGREEMENT_COLORS[status] ?? 'default';
}

const STORE_COLORS: Record<FrnStoreStatus, string> = {
  pipeline: 'default',
  active: 'green',
  suspended: 'orange',
  closed: 'red',
};

export function storeStatusColor(status: FrnStoreStatus): string {
  return STORE_COLORS[status] ?? 'default';
}

const PUSH_COLORS: Record<FrnPushStatus, string> = {
  draft: 'default',
  completed: 'green',
  partial: 'orange',
  failed: 'red',
};

export function pushStatusColor(status: FrnPushStatus): string {
  return PUSH_COLORS[status] ?? 'default';
}

const TARGET_COLORS: Record<FrnTargetStatus, string> = {
  pending: 'default',
  synced: 'blue',
  acknowledged: 'green',
  failed: 'red',
};

export function targetStatusColor(status: FrnTargetStatus): string {
  return TARGET_COLORS[status] ?? 'default';
}

const STATEMENT_COLORS: Record<FrnStatementStatus, string> = {
  calculated: 'blue',
  invoiced: 'green',
  skipped: 'default',
};

export function statementStatusColor(status: FrnStatementStatus): string {
  return STATEMENT_COLORS[status] ?? 'default';
}

export function findingColor(finding: FrnFinding): string {
  return finding.severity === 'error' ? 'red' : 'orange';
}

const POSITION_COLORS: Record<FrnPosition, string> = {
  top_quartile: 'green',
  above_median: 'blue',
  below_median: 'orange',
};

export function positionColor(position: FrnPosition | null): string {
  return position === null ? 'default' : (POSITION_COLORS[position] ?? 'default');
}

/** Colour of an audit score: green at or above the pass threshold, orange within 10 points, red below. */
export function scoreColor(percent: FrnDecimal, threshold: FrnDecimal): string {
  const value = toNumber(percent);
  const limit = toNumber(threshold);
  if (value >= limit) {
    return 'green';
  }
  return value >= limit - 10 ? 'orange' : 'red';
}

// --- Benchmark bars ---

/**
 * The widths (percent of the longest value) of the four bars the benchmark draws for a KPI: the store itself, the median of its
 * size cluster, the network average and the top-quartile threshold. A value that does not exist is null (no bar). Negative values
 * (a falling like-for-like) draw an empty bar: the figure next to it carries the sign.
 */
export function benchmarkBars(
  own: string | null,
  cluster: { median: string | null; p75: string | null } | null,
  network: { average: string | null; p75: string | null } | null,
): { own: number | null; median: number | null; average: number | null; top: number | null } {
  const values = [
    own === null ? null : toNumber(own),
    cluster?.median == null ? null : toNumber(cluster.median),
    network?.average == null ? null : toNumber(network.average),
    (cluster?.p75 ?? network?.p75) == null ? null : toNumber(cluster?.p75 ?? network?.p75),
  ];
  const max = Math.max(...values.map((value) => Math.max(value ?? 0, 0)), 0);
  const width = (value: number | null): number | null =>
    value === null ? null : max === 0 ? 0 : Math.round((Math.max(value, 0) / max) * 100);

  return {
    own: width(values[0]),
    median: width(values[1]),
    average: width(values[2]),
    top: width(values[3]),
  };
}
