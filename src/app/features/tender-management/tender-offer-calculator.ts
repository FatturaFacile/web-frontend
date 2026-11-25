import {
  TndAwardCriterion,
  TndFormulaType,
  TndIssue,
  TndJurisdiction,
  TndVaultDocType,
} from '@core';

/**
 * Pure calculator of the economic offer simulator (Mod 169). It mirrors the server formulas so the screen answers while the
 * user types; the server result (`economic-offer` endpoint) stays authoritative and is what gets persisted.
 */

/** Share of the economic maximum granted at the bilinear break-point. */
export const BILINEAR_FACTOR = 0.85;
/** Share of both maxima above which an OEPV offer is suspected anomalous (Art. 110 D.Lgs. 36/2023). */
export const ANOMALY_SHARE = 0.8;

export interface OfferInput {
  jurisdiction: TndJurisdiction;
  awardCriterion: TndAwardCriterion;
  formula: TndFormulaType | null;
  baseAuctionAmount: number;
  nonSubjectSafetyCosts: number;
  estimatedLaborCostAmount: number;
  discountPercentage: number;
  /** Total internal cost; when null the other direct costs plus the declared labor and safety costs stand in. */
  estimatedTotalCost: number | null;
  otherDirectCosts: number;
  companySafetyCostsDeclared: number;
  companyLaborCostsDeclared: number;
  technicalMax: number;
  economicMax: number;
  technicalScoreEstimate: number;
  bestCompetitorDiscount: number | null;
  competitorDiscounts: number[];
  bidBasePercentage: number;
  /** Rates of the Art. 106 reductions by key (`pmi`, `iso9001`, `emas`, `iso14001`, `pdr125`) as fractions. */
  bondReductionRates: Record<string, number>;
  /** Reduction keys backed by a valid vault certificate. */
  heldReductionKeys: string[];
}

export interface BondReduction {
  key: string;
  percentage: number;
}

export interface OfferCalculation {
  discountableBase: number;
  offeredAmount: number;
  estimatedTotalCost: number;
  netMargin: number;
  netMarginPercentage: number;
  technicalScore: number;
  economicScore: number;
  totalScore: number;
  bestDiscountAssumed: number;
  anomaly: { isAnomalous: boolean; thresholdType: 'oepv_four_fifths' | 'average_discount' | null; thresholdValue: number | null };
  bond: { baseAmount: number; reductions: BondReduction[]; finalAmount: number; totalReductionPercentage: number };
  issues: TndIssue[];
  submissionBlocked: boolean;
}

/** Rounds half up to the given number of decimals. */
export function roundHalfUp(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  const sign = value < 0 ? -1 : 1;
  return (sign * Math.round(Math.abs(value) * factor + 1e-9)) / factor;
}

export function parseDecimal(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === '') {
    return 0;
  }
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function mean(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function offeredAmountFor(
  baseAuctionAmount: number,
  nonSubjectSafetyCosts: number,
  discountPercentage: number,
): number {
  const discountable = baseAuctionAmount - nonSubjectSafetyCosts;
  return roundHalfUp(discountable * (1 - discountPercentage / 100) + nonSubjectSafetyCosts);
}

/** Economic score by formula; `own`/`competitors` are offered amounts, used by the price based interpolation. */
export function economicScore(
  formula: TndFormulaType | null,
  economicMax: number,
  discount: number,
  bestDiscount: number,
  competitorDiscounts: number[],
  ownOffer: number,
  competitorOffers: number[],
): number {
  if (economicMax <= 0) {
    return 0;
  }
  switch (formula) {
    case 'Bilinear': {
      const threshold = competitorDiscounts.length > 0 ? mean(competitorDiscounts) : bestDiscount / 2;
      if (threshold <= 0) {
        return discount > 0 ? economicMax : 0;
      }
      if (discount <= threshold) {
        return economicMax * BILINEAR_FACTOR * (discount / threshold);
      }
      const span = bestDiscount - threshold;
      return span <= 0
        ? economicMax
        : economicMax * (BILINEAR_FACTOR + (1 - BILINEAR_FACTOR) * ((discount - threshold) / span));
    }
    case 'Interpolation': {
      const lowest = Math.min(ownOffer, ...competitorOffers);
      return ownOffer > 0 ? economicMax * (lowest / ownOffer) : 0;
    }
    default:
      return bestDiscount > 0 ? economicMax * (discount / bestDiscount) : 0;
  }
}

/** Provisional bid bond with the cumulative Art. 106 reductions; ISO 14001 and EMAS are alternatives. */
export function bidBond(
  baseAuctionAmount: number,
  basePercentage: number,
  rates: Record<string, number>,
  held: string[],
): OfferCalculation['bond'] {
  const baseAmount = roundHalfUp((baseAuctionAmount * basePercentage) / 100);
  const keys = new Set(held.filter((key) => rates[key] !== undefined));

  if (keys.has('emas') && keys.has('iso14001')) {
    keys.delete((rates['emas'] ?? 0) >= (rates['iso14001'] ?? 0) ? 'iso14001' : 'emas');
  }

  const order = ['pmi', 'iso9001', 'emas', 'iso14001', 'pdr125'];
  const reductions = order
    .filter((key) => keys.has(key))
    .map((key) => ({ key, percentage: rates[key] ?? 0 }));
  const factor = reductions.reduce((acc, reduction) => acc * (1 - reduction.percentage), 1);

  return {
    baseAmount,
    reductions,
    finalAmount: roundHalfUp(baseAmount * factor),
    totalReductionPercentage: roundHalfUp((1 - factor) * 100, 2),
  };
}

/** Threshold of the lowest-price criterion: mean discount plus the mean positive deviation above it. */
export function averageDiscountThreshold(discounts: number[]): number | null {
  if (discounts.length === 0) {
    return null;
  }
  const average = mean(discounts);
  const above = discounts.filter((value) => value > average).map((value) => value - average);
  return average + mean(above);
}

export function calculateOffer(input: OfferInput): OfferCalculation {
  const discount = input.discountPercentage;
  const offeredAmount = offeredAmountFor(input.baseAuctionAmount, input.nonSubjectSafetyCosts, discount);
  const cost =
    input.estimatedTotalCost ??
    input.otherDirectCosts + input.companyLaborCostsDeclared + input.companySafetyCostsDeclared;
  const netMargin = roundHalfUp(offeredAmount - cost);
  const netMarginPercentage = offeredAmount > 0 ? roundHalfUp((netMargin / offeredAmount) * 100, 4) : 0;

  const bestCompetitor =
    input.bestCompetitorDiscount ??
    (input.competitorDiscounts.length > 0 ? Math.max(...input.competitorDiscounts) : 0);
  const bestDiscountAssumed = Math.max(discount, bestCompetitor);
  const oepv = input.awardCriterion === 'OEPV_MostEconomicallyAdvantageous';

  const competitorOffers = input.competitorDiscounts.map((value) =>
    offeredAmountFor(input.baseAuctionAmount, input.nonSubjectSafetyCosts, value),
  );
  const technicalScore = oepv ? Math.min(input.technicalScoreEstimate, input.technicalMax) : 0;
  const economic = oepv
    ? economicScore(
        input.formula,
        input.economicMax,
        discount,
        bestDiscountAssumed,
        input.competitorDiscounts,
        offeredAmount,
        competitorOffers,
      )
    : 0;

  let anomaly: OfferCalculation['anomaly'] = { isAnomalous: false, thresholdType: null, thresholdValue: null };
  if (oepv) {
    anomaly = {
      isAnomalous:
        technicalScore >= ANOMALY_SHARE * input.technicalMax &&
        economic >= ANOMALY_SHARE * input.economicMax,
      thresholdType: 'oepv_four_fifths',
      thresholdValue: ANOMALY_SHARE,
    };
  } else {
    const threshold = averageDiscountThreshold(input.competitorDiscounts);
    anomaly = {
      isAnomalous: threshold !== null && discount > threshold,
      thresholdType: threshold === null ? null : 'average_discount',
      thresholdValue: threshold === null ? null : roundHalfUp(threshold, 4),
    };
  }

  const issues = offerIssues(input, netMargin, anomaly.isAnomalous);

  return {
    discountableBase: roundHalfUp(input.baseAuctionAmount - input.nonSubjectSafetyCosts),
    offeredAmount,
    estimatedTotalCost: roundHalfUp(cost),
    netMargin,
    netMarginPercentage,
    technicalScore: roundHalfUp(technicalScore),
    economicScore: roundHalfUp(economic),
    totalScore: roundHalfUp(technicalScore + economic),
    bestDiscountAssumed,
    anomaly,
    bond: bidBond(input.baseAuctionAmount, input.bidBasePercentage, input.bondReductionRates, input.heldReductionKeys),
    issues,
    submissionBlocked: issues.some((issue) => issue.severity === 'blocking'),
  };
}

/** Art. 108 co. 9 D.Lgs. 36/2023: company safety and labor costs must be declared (Italian public tenders). */
function offerIssues(input: OfferInput, netMargin: number, anomalous: boolean): TndIssue[] {
  const issues: TndIssue[] = [];

  if (input.jurisdiction === 'IT_Dlgs36_2023_ANAC') {
    if (input.companySafetyCostsDeclared <= 0) {
      issues.push({ code: 'art108_safety_costs_missing', severity: 'blocking' });
    }
    if (input.companyLaborCostsDeclared <= 0) {
      issues.push({ code: 'art108_labor_costs_missing', severity: 'blocking' });
    } else if (
      input.estimatedLaborCostAmount > 0 &&
      input.companyLaborCostsDeclared < input.estimatedLaborCostAmount
    ) {
      issues.push({ code: 'art108_labor_costs_below_estimate', severity: 'warning' });
    }
  }
  if (netMargin < 0) {
    issues.push({ code: 'margin_negative', severity: 'warning' });
  }
  if (anomalous) {
    issues.push({ code: 'anomaly_threshold_exceeded', severity: 'warning' });
  }

  return issues;
}

/** Reduction keys that the held vault documents back, from their document types and the type catalogue. */
export function heldReductionKeys(
  documents: { doc_type: TndVaultDocType; verification_status: string }[],
  typeKeys: Record<string, string | null>,
): string[] {
  return documents
    .filter((doc) => doc.verification_status === 'Valid' || doc.verification_status === 'ExpiringSoon')
    .map((doc) => typeKeys[doc.doc_type] ?? null)
    .filter((key): key is string => key !== null);
}
