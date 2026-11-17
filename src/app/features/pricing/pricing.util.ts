import { DiscountMode, MarginStatus, PricingRoundingMode } from '@core';

/** Parsed cascade such as "30+5+2": the percentages in order, or null when the notation is not valid. */
export function parseDiscountCascade(notation: string | null | undefined): number[] | null {
  const text = (notation ?? '').replace(/\s+/g, '').replace(/,/g, '.');
  if (text === '') {
    return [];
  }

  const steps: number[] = [];
  for (const part of text.split('+')) {
    if (!/^\d+(\.\d+)?$/.test(part)) {
      return null;
    }
    const value = Number(part);
    if (value > 100) {
      return null;
    }
    steps.push(value);
  }

  return steps;
}

/** Price after a cascade: MULTIPLICATIVE chains the steps (100 - 20% - 5% = 76), ADDITIVE sums them (100 - 25% = 75). */
export function applyDiscountCascade(
  price: number,
  steps: number[],
  mode: DiscountMode = 'MULTIPLICATIVE',
): number {
  if (mode === 'ADDITIVE') {
    const total = Math.min(
      100,
      steps.reduce((sum, step) => sum + step, 0),
    );
    return round(price * (1 - total / 100), 4);
  }

  return round(
    steps.reduce((current, step) => current * (1 - step / 100), price),
    4,
  );
}

/** The single percentage a cascade is worth, e.g. 20+5 multiplicative = 24 %. */
export function effectiveDiscountPercent(
  steps: number[],
  mode: DiscountMode = 'MULTIPLICATIVE',
): number {
  const price = applyDiscountCascade(100, steps, mode);
  return round(100 - price, 4);
}

/** Commercial rounding of a unit price: SWISS_005 rounds to 0.05, HALF_UP_001 to 0.01, NONE keeps 4 decimals. */
export function roundPrice(price: number, mode: PricingRoundingMode): number {
  switch (mode) {
    case 'SWISS_005':
      return round(Math.floor(price * 20 + 0.5 + 1e-9) / 20, 4);
    case 'HALF_UP_001':
      return round(Math.floor(price * 100 + 0.5 + 1e-9) / 100, 4);
    default:
      return round(price, 4);
  }
}

export interface CascadePreview {
  valid: boolean;
  steps: { percent: number; price: number }[];
  net: number;
  rounded: number;
  effectivePercent: number;
}

/** Live preview of a cascade on a base price, as the cascade input shows it while the user types. */
export function previewCascade(
  base: number,
  notation: string,
  mode: DiscountMode,
  rounding: PricingRoundingMode,
): CascadePreview {
  const steps = parseDiscountCascade(notation);
  if (steps === null) {
    return { valid: false, steps: [], net: base, rounded: base, effectivePercent: 0 };
  }

  let current = base;
  const trace = steps.map((percent) => {
    if (mode === 'MULTIPLICATIVE') {
      current = current * (1 - percent / 100);
    }
    return { percent, price: round(current, 4) };
  });
  const net = applyDiscountCascade(base, steps, mode);

  return {
    valid: true,
    steps: trace,
    net,
    rounded: roundPrice(net, rounding),
    effectivePercent: effectiveDiscountPercent(steps, mode),
  };
}

/** Colour of the guardrail badge: green OK, amber WARNING, red BLOCKED. */
export const MARGIN_STATUS_COLORS: Record<MarginStatus, string> = {
  OK: 'green',
  WARNING: 'orange',
  BLOCKED: 'red',
};

/** Worst status of several lines, so a document shows the badge of its weakest line. */
export function worstMarginStatus(statuses: readonly MarginStatus[]): MarginStatus {
  if (statuses.includes('BLOCKED')) {
    return 'BLOCKED';
  }
  return statuses.includes('WARNING') ? 'WARNING' : 'OK';
}

/** A blocked document cannot be confirmed until a supervisor authorizes it. */
export function canConfirmDocument(status: MarginStatus, hasApproval: boolean): boolean {
  return status !== 'BLOCKED' || hasApproval;
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}
