import { HttpErrorResponse } from '@angular/common/http';
import {
  GdtContractStatus,
  GdtDecimal,
  GdtProblem,
  GdtPromotionStatus,
  GdtScope,
  GdtSettlementStatus,
  GdtTier,
} from '@core';

/** Module key of the access map (`MODULE_ACCESS`): finance and sales roles read, finance and sales managers write. */
export const GDO_TRADE_TERMS_MODULE = 'gdo_trade_terms';

/** Module key of the finance ability: posting and reversing the accrual, settling and reconciling. */
export const GDO_TRADE_TERMS_FINANCE_MODULE = 'gdo_trade_terms_finance';

// --- Outcomes and errors ---

/** What a store write answers: the screens show the translated error and bind the field errors of a 422. */
export interface GdtOutcome {
  ok: boolean;
  /** Translation key of the refusal (`gdoTradeTerms.error.<code>`), null on success. */
  errorKey: string | null;
  /** The text the API sent (validation message or problem detail), for the cases the key does not cover. */
  detail: string | null;
  /** The parameters the API sent with the problem (the code of an overlapping scale, the period of a later run). */
  params: Record<string, string | number>;
  errors: Record<string, string[]>;
}

export const GDT_OK: GdtOutcome = { ok: true, errorKey: null, detail: null, params: {}, errors: {} };

export function errorKey(code: string | null | undefined): string {
  return `gdoTradeTerms.error.${code ? code : 'generic'}`;
}

/** The problem details of a failed call. */
export function problemOf(error: unknown): (GdtProblem & { params?: Record<string, string | number> }) | null {
  if (!(error instanceof HttpErrorResponse)) {
    return null;
  }
  const body: unknown = error.error;
  return body !== null && typeof body === 'object' ? (body as GdtProblem) : null;
}

/** The outcome of a failed call: the `code` of the problem picks the key, a 422 brings the field errors. */
export function failureOf(error: unknown): GdtOutcome {
  const problem = problemOf(error);
  const errors = problem?.errors ?? {};
  const first = Object.values(errors).flat()[0];
  return {
    ok: false,
    errorKey: errorKey(problem?.code),
    detail: first ?? problem?.detail ?? null,
    params: problem?.params ?? {},
    errors,
  };
}

// --- Labels and colours ---

const CONTRACT_COLORS: Record<GdtContractStatus, string> = {
  draft: 'default',
  active: 'green',
  suspended: 'orange',
  closed: 'blue',
  cancelled: 'red',
};

export function contractStatusColor(status: GdtContractStatus): string {
  return CONTRACT_COLORS[status] ?? 'default';
}

const PROMOTION_COLORS: Record<GdtPromotionStatus, string> = {
  draft: 'default',
  active: 'green',
  ended: 'blue',
  cancelled: 'red',
};

export function promotionStatusColor(status: GdtPromotionStatus): string {
  return PROMOTION_COLORS[status] ?? 'default';
}

const SETTLEMENT_COLORS: Record<GdtSettlementStatus, string> = {
  proposed: 'gold',
  disputed: 'red',
  settled: 'green',
  cancelled: 'default',
};

export function settlementStatusColor(status: GdtSettlementStatus): string {
  return SETTLEMENT_COLORS[status] ?? 'default';
}

/** The transitions a contract offers from its status (the API refuses the others with `invalid_transition`). */
export function contractActions(status: GdtContractStatus): readonly ('activate' | 'resume' | 'suspend' | 'close' | 'cancel')[] {
  switch (status) {
    case 'draft':
      return ['activate', 'cancel'];
    case 'active':
      return ['suspend', 'close'];
    case 'suspended':
      return ['resume', 'close', 'cancel'];
    default:
      return [];
  }
}

/** The transitions a promotion offers from its status. */
export function promotionActions(status: GdtPromotionStatus): readonly ('activate' | 'end' | 'cancel')[] {
  switch (status) {
    case 'draft':
      return ['activate', 'cancel'];
    case 'active':
      return ['end', 'cancel'];
    default:
      return [];
  }
}

// --- Numbers and dates ---

/** A decimal string or number as a number for display only (the API does the arithmetic). */
export function num(value: GdtDecimal | null | undefined): number {
  const parsed = typeof value === 'number' ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** A percentage as text, e.g. `3.5000` -> `3.5`. */
export function percentText(value: GdtDecimal | null | undefined): string {
  const parsed = num(value);
  return `${Number.isInteger(parsed) ? parsed : parsed.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')}%`;
}

/** The progress bar value (0-100) of an attainment percentage. */
export function barValue(value: GdtDecimal | null | undefined): number {
  return Math.max(0, Math.min(100, Math.round(num(value))));
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function currentMonthKey(): string {
  return today().slice(0, 7);
}

/** The calendar year as `[first day, last day]`. */
export function currentYear(): { start: string; end: string } {
  const year = new Date().getFullYear();
  return { start: `${year}-01-01`, end: `${year}-12-31` };
}

// --- Forms ---

export function emptyTier(): GdtTier {
  return { threshold: '', rate_percent: '', flat_amount: null, label: null };
}

export function emptyScope(): GdtScope {
  return { category_ids: [], brand_ids: [], product_ids: [], delivery_point_ids: [] };
}

/** The tiers as the API wants them: numbers kept as typed, empty flat amounts and labels as null, sorted by threshold. */
export function cleanTiers(tiers: readonly GdtTier[]): GdtTier[] {
  return tiers
    .filter((tier) => tier.threshold !== '' && tier.threshold !== null && tier.rate_percent !== '' && tier.rate_percent !== null)
    .map((tier) => ({
      threshold: tier.threshold,
      rate_percent: tier.rate_percent,
      flat_amount: tier.flat_amount === '' || tier.flat_amount === null ? null : tier.flat_amount,
      label: tier.label ? tier.label : null,
    }))
    .sort((left, right) => num(left.threshold) - num(right.threshold));
}

/** Whether the brackets rise in threshold and never drop in rate: the rules the API refuses a scale for. */
export function tiersProblem(tiers: readonly GdtTier[]): 'tiers_required' | 'tier_duplicate_threshold' | 'tier_rate_decreasing' | 'tier_invalid' | null {
  const clean = cleanTiers(tiers);
  if (clean.length === 0) {
    return 'tiers_required';
  }
  for (let index = 0; index < clean.length; index++) {
    const tier = clean[index];
    if (num(tier.threshold) < 0 || num(tier.rate_percent) < 0 || num(tier.rate_percent) > 100) {
      return 'tier_invalid';
    }
    if (index > 0 && num(tier.threshold) === num(clean[index - 1].threshold)) {
      return 'tier_duplicate_threshold';
    }
    if (index > 0 && num(tier.rate_percent) < num(clean[index - 1].rate_percent)) {
      return 'tier_rate_decreasing';
    }
  }
  return null;
}

/** The cascade of the on-invoice discounts: 100 - 100 x prod(1 - d/100), for the preview next to the form. */
export function cascadeDiscount(percents: readonly GdtDecimal[]): number {
  const factor = percents.reduce<number>((product, percent) => product * (1 - num(percent) / 100), 1);
  return Math.round((1 - factor) * 100 * 10000) / 10000;
}

/** The standard VAT rate proposed for the credit note by jurisdiction (the API serves the configured rates in the lookups). */
export const GDT_DEFAULT_TAX_RATES: Record<'IT' | 'CH', string> = { IT: '22', CH: '8.1' };
