import { HttpErrorResponse } from '@angular/common/http';
import {
  DpChain,
  DpChainDetail,
  DpChainStatus,
  DpDeposit,
  DpDepositStatus,
  DpInstallment,
  DpInstallmentInput,
  DpInstallmentStatus,
  DpInstrument,
  DpJurisdiction,
  DpLink,
  DpLinkStatus,
  DpLinkType,
  DpPlanRow,
  DpProblem,
} from '@core';

/** Module key of the access map (`MODULE_ACCESS`): sales plans and emits; finance resolves deposits, settles and credits. */
export const DOWN_PAYMENTS_MODULE = 'down_payments';

// --- Outcomes and errors ---

/** What a store write answers: the screens show the translated error and the field errors of a 422. */
export interface DpOutcome {
  ok: boolean;
  /** Translation key of the refusal (`down_payments.error.<code>`), null on success. */
  errorKey: string | null;
  code: string | null;
  /** The text the API sent (validation message or problem detail), for the cases the key does not cover. */
  detail: string | null;
  params: Record<string, string | number>;
  errors: Record<string, string[]>;
}

export const DP_OK: DpOutcome = {
  ok: true,
  errorKey: null,
  code: null,
  detail: null,
  params: {},
  errors: {},
};

export function errorKey(code: string | null | undefined): string {
  return `down_payments.error.${code ? code : 'generic'}`;
}

export function problemOf(error: unknown): DpProblem | null {
  if (!(error instanceof HttpErrorResponse)) {
    return null;
  }
  const body: unknown = error.error;
  return body !== null && typeof body === 'object' ? (body as DpProblem) : null;
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
export function failureOf(error: unknown): DpOutcome {
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

// --- Colours of the badges ---

const CHAIN_COLORS: Record<DpChainStatus, string> = {
  draft: 'default',
  active: 'blue',
  partially_settled: 'gold',
  settled: 'green',
  cancelled: 'red',
  forfeited: 'volcano',
};

export function chainStatusColor(status: DpChainStatus): string {
  return CHAIN_COLORS[status] ?? 'default';
}

const INSTALLMENT_COLORS: Record<DpInstallmentStatus, string> = {
  planned: 'default',
  requested: 'gold',
  invoiced: 'blue',
  paid: 'green',
  converted: 'cyan',
  forfeited: 'volcano',
  refunded: 'purple',
  cancelled: 'red',
};

export function installmentStatusColor(status: DpInstallmentStatus): string {
  return INSTALLMENT_COLORS[status] ?? 'default';
}

const LINK_COLORS: Record<DpLinkStatus, string> = {
  open: 'gold',
  issued: 'blue',
  partially_credited: 'orange',
  credited: 'red',
  settled: 'green',
  converted: 'cyan',
  cancelled: 'default',
};

export function linkStatusColor(status: DpLinkStatus): string {
  return LINK_COLORS[status] ?? 'default';
}

const DEPOSIT_COLORS: Record<DpDepositStatus, string> = {
  issued_unpaid: 'gold',
  held_active: 'blue',
  converted_to_advance: 'cyan',
  deducted_in_final_invoice: 'green',
  forfeited_on_breach: 'volcano',
  refunded_single: 'purple',
  refunded_double_art1385: 'magenta',
};

export function depositStatusColor(status: DpDepositStatus): string {
  return DEPOSIT_COLORS[status] ?? 'default';
}

export function jurisdictionColor(jurisdiction: DpJurisdiction): string {
  return jurisdiction === 'CH' ? 'red' : 'green';
}

// --- Dates and amounts ---

/** `YYYY-MM-DD` of a date picked in the UI, null when nothing was picked. */
export function isoDay(value: Date | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${value.getFullYear()}-${month}-${day}`;
}

/** Amount of the API (decimal string) in cents, for the cent-exact checks of the previews. */
export function toCents(value: string | number | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
}

export function sumCents(values: readonly (string | number | null | undefined)[]): number {
  return values.reduce<number>((sum, value) => sum + toCents(value), 0);
}

export function fromCents(cents: number): string {
  return (cents / 100).toFixed(2);
}

/** Percent of a part over a whole, clamped to 0..100 and rounded to one decimal. */
export function percentOf(part: number, whole: number): number {
  if (!(whole > 0) || !(part > 0)) {
    return 0;
  }
  return Math.min(100, Math.round((part / whole) * 1000) / 10);
}

// --- Cent-exact verification of a plan row ---

export interface DpRowCheck {
  netOk: boolean;
  vatOk: boolean;
  grossOk: boolean;
  /** The slices of the VAT rates add up to the installment, to the cent. */
  exact: boolean;
  netDelta: string;
  vatDelta: string;
  grossDelta: string;
}

/** Compares the sum of the slices per VAT rate with the totals of an installment of the plan. */
export function checkRow(
  row: Pick<DpPlanRow, 'amount_net' | 'amount_vat' | 'amount_gross' | 'vat_breakdown'>,
): DpRowCheck {
  const net = sumCents(row.vat_breakdown.map((slice) => slice.net)) - toCents(row.amount_net);
  const vat = sumCents(row.vat_breakdown.map((slice) => slice.vat)) - toCents(row.amount_vat);
  const gross = sumCents(row.vat_breakdown.map((slice) => slice.gross)) - toCents(row.amount_gross);
  // A deposit of the plan has no VAT split: its breakdown is empty and there is nothing to verify
  const empty = row.vat_breakdown.length === 0;
  return {
    netOk: empty || net === 0,
    vatOk: empty || vat === 0,
    grossOk: empty || gross === 0,
    exact: empty || (net === 0 && vat === 0 && gross === 0),
    netDelta: fromCents(net),
    vatDelta: fromCents(vat),
    grossDelta: fromCents(gross),
  };
}

// --- Progress bar of a chain ---

export interface DpProgress {
  total: number;
  deposits: number;
  advances: number;
  residual: number;
  /** Width of each segment of the bar, in percent of the bar. */
  depositsPercent: number;
  advancesPercent: number;
  residualPercent: number;
}

/** Contract total against the deposits held, the advances invoiced (net of their credit notes) and the residual balance. */
export function progressOf(chain: DpChain): DpProgress {
  const deposits = Math.max(
    0,
    toCents(chain.total_earnest_deposits_held) + toCents(chain.total_security_deposits_held),
  );
  const advances = Math.max(
    0,
    toCents(chain.total_advance_invoiced_gross) - toCents(chain.total_credited_advances_gross),
  );
  const residual = Math.max(0, toCents(chain.residual_order_gross));
  const contract = Math.max(0, toCents(chain.total_contract_gross));
  const span = Math.max(contract, deposits + advances + residual);
  return {
    total: contract,
    deposits,
    advances,
    residual,
    depositsPercent: percentOf(deposits, span),
    advancesPercent: percentOf(advances, span),
    residualPercent: percentOf(residual, span),
  };
}

// --- Timeline: order -> deposit / pro-forma -> TD02 -> TD04 -> final TD01 ---

export interface DpTimelineItem {
  key: string;
  kind: 'source' | 'link' | 'deposit';
  /** Translation key of the step. */
  labelKey: string;
  /** Translation key of the status, null for the order. */
  statusKey: string | null;
  statusColor: string;
  number: string | null;
  date: string | null;
  gross: string | null;
  /** Position of the document type in the chain, to order the documents of one day. */
  rank: number;
}

const LINK_ORDER: Record<DpLinkType, number> = {
  earnest_money_deposit: 1,
  security_deposit: 1,
  proforma_advance_request: 2,
  advance_invoice_td02: 3,
  credit_note_td04: 4,
  final_settlement_td01: 5,
};

/** The documents of the chain in chronological order, the order of the source first and the final invoice last on equal dates. */
export function buildTimeline(chain: DpChainDetail): DpTimelineItem[] {
  const depositIds = new Set(chain.deposits.map((deposit) => deposit.id));
  const items: DpTimelineItem[] = [];

  for (const link of chain.links) {
    // The deposit receipts are listed from the deposits themselves when the API also lists them as links
    if (link.document_id !== null && depositIds.has(link.document_id)) {
      continue;
    }
    items.push({
      key: `link-${link.id}`,
      kind: 'link',
      labelKey: `down_payments.linkType.${link.link_type}`,
      statusKey: `down_payments.linkStatus.${link.status}`,
      statusColor: linkStatusColor(link.status),
      number: link.document_number,
      date: link.document_date,
      gross: link.gross_amount,
      rank: LINK_ORDER[link.link_type] ?? 3,
    });
  }

  for (const deposit of chain.deposits) {
    items.push({
      key: `deposit-${deposit.id}`,
      kind: 'deposit',
      labelKey: `down_payments.depositType.${deposit.deposit_type}`,
      statusKey: `down_payments.depositStatus.${deposit.status}`,
      statusColor: depositStatusColor(deposit.status),
      number: deposit.receipt_number,
      date: deposit.issue_date,
      gross: deposit.amount,
      rank: 1,
    });
  }

  items.sort((a, b) => {
    const byDate = (a.date ?? '9999-12-31').localeCompare(b.date ?? '9999-12-31');
    return byDate !== 0 ? byDate : a.rank - b.rank;
  });

  return [
    {
      key: 'source',
      kind: 'source',
      labelKey: `down_payments.sourceType.${chain.source_type}`,
      statusKey: null,
      statusColor: 'default',
      number: chain.source_number,
      date: chain.created_at ? chain.created_at.slice(0, 10) : null,
      gross: chain.total_contract_gross,
      rank: 0,
    },
    ...items,
  ];
}

// --- What a row of the chain can do ---

export function isChainClosed(chain: Pick<DpChain, 'status'>): boolean {
  return chain.status === 'settled' || chain.status === 'cancelled' || chain.status === 'forfeited';
}

export function canEmit(chain: DpChain, installment: DpInstallment): boolean {
  return !isChainClosed(chain) && installment.status === 'planned';
}

export function canConfirmProforma(chain: DpChain, link: DpLink): boolean {
  return (
    !isChainClosed(chain) && link.link_type === 'proforma_advance_request' && link.status === 'open'
  );
}

/** Open of an advance invoice that a credit note can still take back (gross). */
export function creditableGross(link: DpLink): string {
  return fromCents(
    toCents(link.gross_amount) -
      toCents(link.credited_gross_amount) -
      toCents(link.settled_gross_amount),
  );
}

export function canCreditNote(chain: DpChain, link: DpLink): boolean {
  return (
    chain.final_invoice_id === null &&
    link.link_type === 'advance_invoice_td02' &&
    (link.status === 'issued' || link.status === 'partially_credited') &&
    toCents(creditableGross(link)) > 0
  );
}

export function isHeld(deposit: DpDeposit): boolean {
  return deposit.status === 'held_active';
}

export function needsPayment(deposit: DpDeposit): boolean {
  return deposit.status === 'issued_unpaid';
}

export function canSettle(chain: DpChain): boolean {
  return chain.final_invoice_id === null && !isChainClosed(chain);
}

export function isDepositInstrument(instrument: DpInstrument): boolean {
  return instrument === 'earnest_money_deposit' || instrument === 'security_deposit';
}

export function isEarnestMoney(deposit: DpDeposit): boolean {
  return deposit.deposit_type === 'earnest_money_caparra_confirmatoria';
}

/** The deposit receipt of an installment, when it was emitted. */
export function depositOf(chain: DpChainDetail, installment: DpInstallment): DpDeposit | null {
  return chain.deposits.find((deposit) => deposit.installment_id === installment.id) ?? null;
}

/** Held earnest money: it blocks the final settlement until it is imputed, forfeited or refunded. */
export function heldEarnest(chain: DpChainDetail): DpDeposit[] {
  return chain.deposits.filter(
    (deposit) => isEarnestMoney(deposit) && (isHeld(deposit) || needsPayment(deposit)),
  );
}

// --- Wizard rows ---

export interface DpMilestoneRow {
  key: number;
  label: string;
  trigger: DpInstallmentInput['trigger_type'];
  mode: DpInstallmentInput['calculation_mode'];
  /** Percentage (mode percentage) or amount (modes fixed net / gross). */
  value: number | null;
  instrument: DpInstrument;
  dueDate: Date | null;
}

/** The installment the API receives for a row of the wizard. */
export function inputOf(row: DpMilestoneRow): DpInstallmentInput {
  const due = isoDay(row.dueDate);
  return {
    trigger_type: row.trigger,
    calculation_mode: row.mode,
    instrument_type: row.instrument,
    ...(row.label.trim() ? { milestone_label: row.label.trim() } : {}),
    ...(due ? { due_date: due } : {}),
    ...(row.mode === 'percentage'
      ? { percentage: String(row.value ?? 0) }
      : { amount: Number(row.value ?? 0).toFixed(2) }),
  };
}

/** Whether a row states what the API needs: a positive percentage (at most 100) or a positive amount. */
export function rowIsValid(row: DpMilestoneRow): boolean {
  const value = row.value ?? 0;
  if (!(value > 0)) {
    return false;
  }
  if (row.mode === 'percentage' && value > 100) {
    return false;
  }
  return row.trigger !== 'custom_date' || row.dueDate !== null;
}
