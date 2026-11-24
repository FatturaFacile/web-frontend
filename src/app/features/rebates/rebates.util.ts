import { HttpErrorResponse } from '@angular/common/http';
import { AbstractControl, ValidationErrors } from '@angular/forms';
import {
  ContactResource,
  CrmApiService,
  RebateAccrualRun,
  RebateBonusProgress,
  RebateContribution,
  RebateContributionRequest,
  RebateDirection,
  RebateProposalAction,
  RebateProposalStatus,
  RebateTierProgress,
  RebateType,
  SupplierInvoice,
} from '@core';
import { catchError, map, Observable, of } from 'rxjs';

/** First validation message of a Laravel 422 (or its summary message) so the user sees the real reason. */
export function apiErrorText(error: unknown): string | null {
  if (!(error instanceof HttpErrorResponse)) {
    return null;
  }

  const body = error.error as { message?: unknown; errors?: Record<string, unknown> } | null;
  const first = Object.values(body?.errors ?? {})[0];
  if (Array.isArray(first) && typeof first[0] === 'string') {
    return first[0];
  }

  return typeof body?.message === 'string' && body.message !== '' ? body.message : null;
}

/** Today as Y-m-d in the browser time zone, the default of the date inputs. */
export function todayIso(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

/** An empty text input is sent to the API as null. */
export function blankToNull(value: string | null | undefined): string | null {
  const text = (value ?? '').trim();
  return text === '' ? null : text;
}

/** A decimal input is sent to the API as a string, an empty one as null. */
export function decimalOrNull(value: number | string | null | undefined): string | null {
  return value === null || value === undefined || value === '' ? null : String(value);
}

/** Display name of a contact (customer or supplier). */
export function contactLabel(contact: Pick<ContactResource, 'company_name' | 'first_name' | 'last_name'>): string {
  const company = (contact.company_name ?? '').trim();
  return company !== '' ? company : `${contact.first_name ?? ''} ${contact.last_name ?? ''}`.trim();
}

/** Customers of the company for a sales agreement, suppliers for a purchase one. */
export function loadContacts(crm: CrmApiService, direction: RebateDirection): Observable<ContactResource[]> {
  const request = direction === 'sales' ? crm.getClients({ per_page: 100 }) : crm.getSuppliers({ per_page: 100 });
  return request.pipe(
    map((response) => response.data),
    catchError(() => of([])),
  );
}

export const AGREEMENT_STATUS_COLORS: Readonly<Record<string, string>> = {
  draft: 'default',
  active: 'green',
  closed: 'blue',
  cancelled: 'red',
};

export const PROMOTION_STATE_COLORS: Readonly<Record<string, string>> = {
  active: 'green',
  scheduled: 'blue',
  expired: 'default',
  inactive: 'orange',
};

export const PROPOSAL_STATUS_COLORS: Readonly<Record<RebateProposalStatus, string>> = {
  draft: 'default',
  pending_approval: 'orange',
  approved: 'blue',
  settled: 'green',
  cancelled: 'red',
};

export const RUN_STATUS_COLORS: Readonly<Record<string, string>> = {
  posted: 'green',
  reversed: 'default',
};

export const BLANKET_ALERT_COLORS: Readonly<Record<string, string>> = {
  ceiling_near: 'orange',
  ceiling_exceeded: 'red',
  minimum_at_risk: 'orange',
  minimum_not_met: 'red',
};

// --- Supplier rebate programs (Mod 049) ---

/** A decimal string of the API as a number; anything that is not a finite number counts as zero. */
export function toNumber(value: string | number | null | undefined): number {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(value ?? '');
  return Number.isFinite(parsed) ? parsed : 0;
}

/** A progress percentage kept inside the 0-100 range of a progress bar. */
export function clampPercent(value: string | number | null | undefined): number {
  return Math.min(100, Math.max(0, toNumber(value)));
}

export interface TierProgressView {
  /** `no_tier`: below the first threshold; `in_tier`: a next tier exists; `top_tier`: the highest tier is reached. */
  state: 'no_tier' | 'in_tier' | 'top_tier';
  currentRate: string | null;
  nextRate: string | null;
  nextThreshold: string | null;
  /** Spend still missing to reach the next tier; null on the top tier. */
  distance: number | null;
  percent: number;
  projectedGain: number | null;
}

/** What the tier progress card shows: where the spend stands, the distance to the next tier and the gain it would bring. */
export function describeTierProgress(tier: RebateTierProgress | null | undefined): TierProgressView | null {
  if (!tier) {
    return null;
  }

  const state = tier.next_tier === null ? 'top_tier' : tier.current_tier === null ? 'no_tier' : 'in_tier';
  return {
    state,
    currentRate: tier.current_tier?.rate_percent ?? null,
    nextRate: tier.next_tier?.rate_percent ?? null,
    nextThreshold: tier.next_tier?.threshold_amount ?? null,
    distance: tier.next_tier === null || tier.distance_to_next === null ? null : Math.max(0, toNumber(tier.distance_to_next)),
    percent: state === 'top_tier' ? 100 : clampPercent(tier.progress_percent),
    projectedGain: tier.projected_gain === null ? null : toNumber(tier.projected_gain),
  };
}

export interface BonusProgressView {
  reached: boolean;
  percent: number;
  distance: number;
  bonus: number;
}

/** The fixed bonus progress: the bar is full once the target is reached, the distance never goes below zero. */
export function describeBonusProgress(bonus: RebateBonusProgress | null | undefined): BonusProgressView | null {
  if (!bonus) {
    return null;
  }

  return {
    reached: bonus.reached,
    percent: bonus.reached ? 100 : clampPercent(bonus.progress_percent),
    distance: bonus.reached ? 0 : Math.max(0, toNumber(bonus.distance_to_target)),
    bonus: toNumber(bonus.bonus),
  };
}

/** True when no two tiers share a threshold; blank rows are ignored (the required check covers them). */
export function hasDistinctThresholds(thresholds: readonly (string | number | null | undefined)[]): boolean {
  const filled = thresholds.filter((value) => value !== null && value !== undefined && String(value).trim() !== '').map((value) => toNumber(value));
  return new Set(filled).size === filled.length;
}

/** FormArray validator of the tier editor: the thresholds must be distinct. */
export function distinctThresholdsValidator(control: AbstractControl): ValidationErrors | null {
  const rows = (control.value ?? []) as { threshold_amount?: string | number | null }[];
  return hasDistinctThresholds(rows.map((row) => row.threshold_amount)) ? null : { distinctThresholds: true };
}

/**
 * Read-only upper bound of every tier row, in the order of the rows: the next higher threshold, null for the highest
 * (open-ended) one and for a row without a threshold.
 */
export function tierUpperBounds(thresholds: readonly (string | number | null | undefined)[]): (number | null)[] {
  const values = thresholds.map((value) => (value === null || value === undefined || String(value).trim() === '' ? null : toNumber(value)));
  return values.map((value) => {
    if (value === null) {
      return null;
    }
    const higher = values.filter((other): other is number => other !== null && other > value);
    return higher.length === 0 ? null : Math.min(...higher);
  });
}

/** Form fields that must be filled for each rebate type (tiers are validated separately). */
export function requiredFieldsFor(type: RebateType): readonly ('fixed_bonus_target' | 'fixed_bonus_amount')[] {
  return type === 'fixed_bonus' ? ['fixed_bonus_target', 'fixed_bonus_amount'] : [];
}

/** Workflow actions a settlement proposal offers in each status. */
export function proposalAllowedActions(status: RebateProposalStatus): RebateProposalAction[] {
  switch (status) {
    case 'draft':
      return ['submit', 'cancel'];
    case 'pending_approval':
      return ['approve', 'cancel'];
    case 'approved':
      return ['execute', 'cancel'];
    default:
      return [];
  }
}

/** Only a posted accrual run can be reversed. */
export function canReverseRun(run: Pick<RebateAccrualRun, 'status'>): boolean {
  return run.status === 'posted';
}

export interface JournalPreviewLine {
  side: 'debit' | 'credit';
  accountId: string | null;
  amount: number;
}

/**
 * Journal of an accrual run: Dr accrued income account / Cr rebate income account for the delta of the run. Shown even
 * when the run is not posted yet (journal_entry_id is null); `posted` tells the two cases apart.
 */
export function journalPreview(
  agreement: { accrual_account_id?: string | null; income_account_id?: string | null },
  run: Pick<RebateAccrualRun, 'delta_amount' | 'journal_entry_id'>,
): { posted: boolean; lines: JournalPreviewLine[] } {
  const amount = toNumber(run.delta_amount);
  return {
    posted: run.journal_entry_id !== null,
    lines: [
      { side: 'debit', accountId: agreement.accrual_account_id ?? null, amount },
      { side: 'credit', accountId: agreement.income_account_id ?? null, amount },
    ],
  };
}

/** Open balance of a supplier invoice: what is still to be paid, the base of an AP set-off. */
export function invoiceOpenBalance(invoice: Pick<SupplierInvoice, 'total_amount' | 'total_paid'>): number {
  return Math.max(0, toNumber(invoice.total_amount) - toNumber(invoice.total_paid));
}

export interface ContributionRow {
  id: string | null;
  kind: RebateContributionRequest['kind'];
  description: string;
  amount: string;
  due_on: string;
}

export interface ContributionSyncPlan {
  create: RebateContributionRequest[];
  update: { id: string; payload: RebateContributionRequest }[];
  remove: string[];
}

/** What to call after saving an agreement so the contributions of the API match the rows of the editor. */
export function planContributionSync(original: readonly RebateContribution[], rows: readonly ContributionRow[]): ContributionSyncPlan {
  const payload = (row: ContributionRow): RebateContributionRequest => ({ kind: row.kind, description: row.description.trim(), amount: String(row.amount), due_on: row.due_on });
  const kept = new Set(rows.map((row) => row.id).filter((id): id is string => id !== null));
  const changed = (row: ContributionRow & { id: string }): boolean => {
    const before = original.find((contribution) => contribution.id === row.id);
    return !before || before.kind !== row.kind || before.description !== row.description.trim() || toNumber(before.amount) !== toNumber(row.amount) || before.due_on !== row.due_on;
  };

  return {
    create: rows.filter((row) => row.id === null).map(payload),
    update: rows.filter((row): row is ContributionRow & { id: string } => row.id !== null && changed(row as ContributionRow & { id: string })).map((row) => ({ id: row.id, payload: payload(row) })),
    remove: original.filter((contribution) => !kept.has(contribution.id) && contribution.status === 'planned').map((contribution) => contribution.id),
  };
}

/** Percentage of a bar already used, kept inside 0-100; `null` (no limit) draws no bar. */
export function barPercent(part: string | number | null | undefined, total: string | number | null | undefined): number | null {
  const whole = toNumber(total);
  return whole <= 0 ? null : clampPercent((toNumber(part) / whole) * 100);
}

export interface ContractOption {
  id: string;
  label: string;
}

/** A supplier contract row of the generic procurement API as a select option (number and title). */
export function toContractOption(row: Record<string, unknown>): ContractOption | null {
  const id = typeof row['id'] === 'string' ? row['id'] : null;
  if (id === null) {
    return null;
  }

  const parts = [row['contract_number'], row['title']].filter((part): part is string => typeof part === 'string' && part !== '');
  return { id, label: parts.length > 0 ? parts.join(' - ') : id };
}
