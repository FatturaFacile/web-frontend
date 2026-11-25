import { describe, expect, it } from 'vitest';
import {
  averageDiscountThreshold,
  bidBond,
  calculateOffer,
  economicScore,
  heldReductionKeys,
  OfferInput,
  offeredAmountFor,
  parseDecimal,
  roundHalfUp,
} from './tender-offer-calculator';

const RATES = { pmi: 0.5, iso9001: 0.3, emas: 0.3, iso14001: 0.2, pdr125: 0.1 };

function input(overrides: Partial<OfferInput> = {}): OfferInput {
  return {
    jurisdiction: 'IT_Dlgs36_2023_ANAC',
    awardCriterion: 'OEPV_MostEconomicallyAdvantageous',
    formula: 'Linear',
    baseAuctionAmount: 1_000_000,
    nonSubjectSafetyCosts: 20_000,
    estimatedLaborCostAmount: 300_000,
    discountPercentage: 10,
    estimatedTotalCost: 800_000,
    otherDirectCosts: 0,
    companySafetyCostsDeclared: 15_000,
    companyLaborCostsDeclared: 320_000,
    technicalMax: 70,
    economicMax: 30,
    technicalScoreEstimate: 60,
    bestCompetitorDiscount: 20,
    competitorDiscounts: [],
    bidBasePercentage: 2,
    bondReductionRates: RATES,
    heldReductionKeys: [],
    ...overrides,
  };
}

describe('tender offer calculator', () => {
  it('rounds half up', () => {
    expect(roundHalfUp(2.675, 2)).toBe(2.68);
    expect(roundHalfUp(-2.675, 2)).toBe(-2.68);
    expect(roundHalfUp(1.00004, 4)).toBe(1);
  });

  it('parses decimals leniently', () => {
    expect(parseDecimal('12.50')).toBe(12.5);
    expect(parseDecimal(null)).toBe(0);
    expect(parseDecimal('abc')).toBe(0);
  });

  it('keeps the safety costs out of the discount', () => {
    // (1,000,000 - 20,000) * 0.9 + 20,000
    expect(offeredAmountFor(1_000_000, 20_000, 10)).toBe(902_000);
    expect(offeredAmountFor(1_000_000, 20_000, 0)).toBe(1_000_000);
  });

  it('calculates the offered amount and the net margin', () => {
    const result = calculateOffer(input());

    expect(result.discountableBase).toBe(980_000);
    expect(result.offeredAmount).toBe(902_000);
    expect(result.estimatedTotalCost).toBe(800_000);
    expect(result.netMargin).toBe(102_000);
    expect(result.netMarginPercentage).toBe(11.3082);
  });

  it('falls back to the declared costs when no total cost is given', () => {
    const result = calculateOffer(input({ estimatedTotalCost: null, otherDirectCosts: 500_000 }));

    expect(result.estimatedTotalCost).toBe(835_000);
    expect(result.netMargin).toBe(67_000);
  });

  describe('economic score', () => {
    it('is proportional to the best discount in the linear formula', () => {
      expect(economicScore('Linear', 30, 10, 20, [], 0, [])).toBe(15);
      expect(economicScore('Linear', 30, 20, 20, [], 0, [])).toBe(30);
      expect(economicScore('Linear', 30, 0, 0, [], 0, [])).toBe(0);
    });

    it('breaks at the average discount in the bilinear formula', () => {
      const competitors = [10, 20, 30];
      expect(economicScore('Bilinear', 30, 10, 30, competitors, 0, [])).toBeCloseTo(12.75, 6);
      expect(economicScore('Bilinear', 30, 20, 30, competitors, 0, [])).toBeCloseTo(25.5, 6);
      expect(economicScore('Bilinear', 30, 25, 30, competitors, 0, [])).toBeCloseTo(27.75, 6);
      expect(economicScore('Bilinear', 30, 30, 30, competitors, 0, [])).toBeCloseTo(30, 6);
    });

    it('uses half of the best discount as break-point without competitors', () => {
      // Rs = 10: d = 10 sits on the break-point and gets 85 %.
      expect(economicScore('Bilinear', 30, 10, 20, [], 0, [])).toBeCloseTo(25.5, 6);
    });

    it('compares the offered amounts in the interpolation formula', () => {
      expect(economicScore('Interpolation', 30, 10, 20, [], 900_000, [800_000])).toBeCloseTo(26.6667, 3);
      expect(economicScore('Interpolation', 30, 10, 10, [], 900_000, [950_000])).toBe(30);
    });

    it('returns zero without an economic maximum', () => {
      expect(economicScore('Linear', 0, 10, 20, [], 0, [])).toBe(0);
    });
  });

  describe('OEPV scoring and anomaly', () => {
    it('adds the capped technical estimate to the economic score', () => {
      const result = calculateOffer(input({ technicalScoreEstimate: 90 }));

      expect(result.technicalScore).toBe(70);
      expect(result.economicScore).toBe(15);
      expect(result.totalScore).toBe(85);
    });

    it('flags the offer when both scores reach four fifths of their maxima', () => {
      const below = calculateOffer(input());
      expect(below.anomaly.isAnomalous).toBe(false);
      expect(below.anomaly.thresholdType).toBe('oepv_four_fifths');

      const above = calculateOffer(input({ discountPercentage: 25 }));
      expect(above.economicScore).toBe(30);
      expect(above.anomaly.isAnomalous).toBe(true);
      expect(above.issues.map((issue) => issue.code)).toContain('anomaly_threshold_exceeded');
    });

    it('scores nothing for the lowest price criterion', () => {
      const result = calculateOffer(input({ awardCriterion: 'LowestPrice', formula: null }));

      expect(result.technicalScore).toBe(0);
      expect(result.economicScore).toBe(0);
      expect(result.anomaly.thresholdType).toBeNull();
    });
  });

  describe('lowest price anomaly threshold', () => {
    it('adds the mean positive deviation to the mean discount', () => {
      // mean 19, only 40 is above it: deviation 21.
      expect(averageDiscountThreshold([10, 12, 14, 40])).toBe(40);
      expect(averageDiscountThreshold([])).toBeNull();
    });

    it('flags a discount above the threshold', () => {
      const base = input({ awardCriterion: 'LowestPrice', formula: null, competitorDiscounts: [10, 12, 14, 40] });

      expect(calculateOffer({ ...base, discountPercentage: 41 }).anomaly.isAnomalous).toBe(true);
      expect(calculateOffer({ ...base, discountPercentage: 30 }).anomaly.isAnomalous).toBe(false);
      expect(calculateOffer({ ...base, competitorDiscounts: [] }).anomaly).toEqual({
        isAnomalous: false,
        thresholdType: null,
        thresholdValue: null,
      });
    });
  });

  describe('provisional bid bond (Art. 106)', () => {
    it('has no reduction without certificates', () => {
      const bond = bidBond(1_000_000, 2, RATES, []);

      expect(bond.baseAmount).toBe(20_000);
      expect(bond.finalAmount).toBe(20_000);
      expect(bond.reductions).toEqual([]);
      expect(bond.totalReductionPercentage).toBe(0);
    });

    it('multiplies the cumulative reductions', () => {
      const bond = bidBond(1_000_000, 2, RATES, ['pmi', 'iso9001']);

      expect(bond.finalAmount).toBe(7_000);
      expect(bond.totalReductionPercentage).toBe(65);
      expect(bond.reductions.map((reduction) => reduction.key)).toEqual(['pmi', 'iso9001']);
    });

    it('applies only the larger of EMAS and ISO 14001', () => {
      const bond = bidBond(1_000_000, 1, RATES, ['iso14001', 'emas']);

      expect(bond.baseAmount).toBe(10_000);
      expect(bond.finalAmount).toBe(7_000);
      expect(bond.reductions.map((reduction) => reduction.key)).toEqual(['emas']);
    });

    it('ignores keys without a rate', () => {
      expect(bidBond(1_000_000, 2, RATES, ['unknown']).finalAmount).toBe(20_000);
    });

    it('takes the held keys from valid vault documents only', () => {
      const keys = { IT_ISO9001: 'iso9001', IT_DURC: null, IT_EMAS: 'emas' };
      const held = heldReductionKeys(
        [
          { doc_type: 'IT_ISO9001', verification_status: 'Valid' },
          { doc_type: 'IT_EMAS', verification_status: 'Expired' },
          { doc_type: 'IT_DURC', verification_status: 'Valid' },
        ],
        keys,
      );

      expect(held).toEqual(['iso9001']);
    });
  });

  describe('Art. 108 co. 9 D.Lgs. 36/2023', () => {
    it('blocks the submission of an Italian tender without safety costs', () => {
      const result = calculateOffer(input({ companySafetyCostsDeclared: 0 }));

      expect(result.submissionBlocked).toBe(true);
      expect(result.issues).toContainEqual({ code: 'art108_safety_costs_missing', severity: 'blocking' });
    });

    it('blocks the submission without labor costs', () => {
      const result = calculateOffer(input({ companyLaborCostsDeclared: 0 }));

      expect(result.submissionBlocked).toBe(true);
      expect(result.issues.map((issue) => issue.code)).toContain('art108_labor_costs_missing');
    });

    it('warns, without blocking, when the labor costs are below the estimate', () => {
      const result = calculateOffer(input({ companyLaborCostsDeclared: 250_000 }));

      expect(result.submissionBlocked).toBe(false);
      expect(result.issues).toContainEqual({ code: 'art108_labor_costs_below_estimate', severity: 'warning' });
    });

    it('does not apply to Swiss tenders', () => {
      const result = calculateOffer(
        input({ jurisdiction: 'CH_SIMAP_LAPub', companySafetyCostsDeclared: 0, companyLaborCostsDeclared: 0 }),
      );

      expect(result.submissionBlocked).toBe(false);
      expect(result.issues).toEqual([]);
    });

    it('warns about a negative margin', () => {
      const result = calculateOffer(input({ estimatedTotalCost: 950_000 }));

      expect(result.netMargin).toBe(-48_000);
      expect(result.issues).toContainEqual({ code: 'margin_negative', severity: 'warning' });
      expect(result.submissionBlocked).toBe(false);
    });
  });
});
