import { HttpErrorResponse } from '@angular/common/http';
import {
  DstBucketType,
  DstDecimal,
  DstDrpBucket,
  DstDrpCell,
  DstProblem,
  DstProposalStatus,
  DstTransferStatus,
} from '@core';

/** Module key of the access map (`MODULE_ACCESS`). */
export const DISTRIBUTION_MODULE = 'distribution';

// --- Outcomes and errors ---

/** What a write answers: the screens show the translated error and the field errors of a 422. */
export interface DstOutcome {
  ok: boolean;
  /** Translation key of the refusal (`distribution.error.<code>`), null on success. */
  errorKey: string | null;
  code: string | null;
  detail: string | null;
  params: Record<string, string | number>;
  errors: Record<string, string[]>;
}

export const DST_OK: DstOutcome = {
  ok: true,
  errorKey: null,
  code: null,
  detail: null,
  params: {},
  errors: {},
};

export function errorKey(code: string | null | undefined): string {
  return `distribution.error.${code ? code : 'generic'}`;
}

export function problemOf(error: unknown): DstProblem | null {
  if (!(error instanceof HttpErrorResponse)) {
    return null;
  }
  const body: unknown = error.error;
  return body !== null && typeof body === 'object' ? (body as DstProblem) : null;
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
export function failureOf(error: unknown): DstOutcome {
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

// --- Numbers ---

export function toNumber(value: DstDecimal | null | undefined): number {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(value ?? '');
  return Number.isFinite(parsed) ? parsed : 0;
}

/** A quantity without trailing zeros (`12.5000` -> `12.5`). */
export function formatQuantity(value: DstDecimal | null | undefined): string {
  const number = toNumber(value);
  return Number.isInteger(number) ? String(number) : String(Number(number.toFixed(4)));
}

// --- Colours ---

const TRANSFER_COLORS: Record<DstTransferStatus, string> = {
  draft: 'default',
  approved: 'blue',
  in_transit: 'processing',
  partially_received: 'orange',
  received: 'green',
  discrepancy_pending: 'red',
  closed: 'green',
  cancelled: 'default',
};

export function transferStatusColor(status: DstTransferStatus): string {
  return TRANSFER_COLORS[status] ?? 'default';
}

const PROPOSAL_COLORS: Record<DstProposalStatus, string> = {
  pending: 'blue',
  approved: 'cyan',
  rejected: 'default',
  converted: 'green',
  shortfall: 'red',
};

export function proposalStatusColor(status: DstProposalStatus): string {
  return PROPOSAL_COLORS[status] ?? 'default';
}

export function alertColor(type: string): string {
  return type === 'stockout_risk' ? 'red' : type === 'late_inbound' ? 'orange' : 'gold';
}

// --- Transfer workflow ---

/** The tabs of the transfer list: the empty value is "all". */
export const TRANSFER_TABS: readonly (DstTransferStatus | null)[] = [
  null,
  'draft',
  'approved',
  'in_transit',
  'partially_received',
  'received',
  'cancelled',
];

export interface TransferActions {
  approve: boolean;
  dispatch: boolean;
  receive: boolean;
  cancel: boolean;
}

/** What a transfer in a status allows: an order in transit cannot be cancelled, it is received (or returned). */
export function transferActions(status: DstTransferStatus): TransferActions {
  return {
    approve: status === 'draft',
    dispatch: status === 'approved',
    receive: status === 'in_transit' || status === 'partially_received',
    cancel: status === 'draft' || status === 'approved',
  };
}

/** Units of a line still to arrive: shipped minus what was received and damaged. */
export function outstandingQuantity(line: {
  quantity_shipped: DstDecimal;
  quantity_received: DstDecimal;
  quantity_damaged: DstDecimal;
}): number {
  return Math.max(
    0,
    toNumber(line.quantity_shipped) -
      toNumber(line.quantity_received) -
      toNumber(line.quantity_damaged),
  );
}

/** The units a receipt line leaves unaccounted for: outstanding minus good minus damaged. */
export function shortageOf(outstanding: number, received: number, damaged: number): number {
  return Math.max(0, outstanding - received - damaged);
}

/** `final` receipts and the resolution only matter when something is missing or damaged. */
export function needsResolution(shortage: number, damaged: number): boolean {
  return shortage > 0 || damaged > 0;
}

/** Expected arrival: dispatch date plus the lead time of the lane (days, then hours rounded up to whole days). */
export function expectedArrival(from: Date, leadTimeDays: number, leadTimeHours = 0): string {
  const arrival = new Date(from.getTime());
  arrival.setDate(arrival.getDate() + leadTimeDays + Math.ceil(leadTimeHours / 24));
  return `${arrival.getFullYear()}-${String(arrival.getMonth() + 1).padStart(2, '0')}-${String(arrival.getDate()).padStart(2, '0')}`;
}

// --- DRP grid ---

export const DRP_ROWS = [
  'gross_requirements',
  'scheduled_receipts',
  'projected_available',
  'net_requirements',
  'planned_receipts',
  'planned_releases',
] as const;
export type DrpRowKey = (typeof DRP_ROWS)[number];

/** A bucket with a projected balance under the safety stock is highlighted as a stockout risk. */
export function isStockoutCell(cell: DstDrpCell, safetyStock: DstDecimal): boolean {
  return (
    toNumber(cell.projected_available) < toNumber(safetyStock) ||
    toNumber(cell.net_requirements) > 0
  );
}

export function bucketLabel(bucket: DstDrpBucket, type: DstBucketType): string {
  const start = bucket.start.slice(5, 10).split('-').reverse().join('/');
  if (type === 'daily') {
    return start;
  }
  return `${start} - ${bucket.end.slice(5, 10).split('-').reverse().join('/')}`;
}

// --- Misc ---

/** Resolves a name for a warehouse or item reference the API may not have embedded. */
export function refLabel(
  ref: { code?: string; sku?: string; name: string } | null | undefined,
): string {
  if (!ref) {
    return '—';
  }
  return `${ref.code ?? ref.sku ?? ''} ${ref.name}`.trim();
}

export function nullable(value: string | null | undefined): string | null {
  return value ? value : null;
}

export function numberOrNull(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Runs a write call and answers its outcome: success, or the translated refusal of the API. */
export async function attempt(call: () => Promise<unknown>): Promise<DstOutcome> {
  try {
    await call();
    return DST_OK;
  } catch (error) {
    return failureOf(error);
  }
}
