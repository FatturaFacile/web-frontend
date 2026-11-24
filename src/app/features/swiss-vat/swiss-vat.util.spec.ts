import { describe, expect, it } from 'vitest';
import {
  canFinalizeOrExport,
  epochRateBoxes,
  isValidSwissUidMwst,
  maxPeriodNumber,
  previewInputTaxAdjustment,
  roundChf005,
} from './swiss-vat.util';

describe('swiss-vat.util', () => {
  it('rounds amounts to nearest 0.05 CHF', () => {
    expect(roundChf005(10.02)).toBe(10);
    expect(roundChf005(10.03)).toBe(10.05);
    expect(roundChf005(773.92)).toBe(773.9);
  });

  it('validates Swiss UID-MWST Mod-11 check digits', () => {
    expect(isValidSwissUidMwst('CHE-116.281.710 MWST')).toBe(true);
    expect(isValidSwissUidMwst('CHE-116.281.711 MWST')).toBe(false);
    expect(isValidSwissUidMwst('CHE-000.000.000 MWST')).toBe(false);
  });

  it('computes max period numbers and epoch AFC boxes', () => {
    expect(maxPeriodNumber('monthly')).toBe(12);
    expect(maxPeriodNumber('quarterly')).toBe(4);
    expect(maxPeriodNumber('semiannual')).toBe(2);

    expect(epochRateBoxes('2026-03-31')).toEqual({
      standard: '303',
      reduced: '313',
      accommodation: '343',
      bezugsteuer: '383',
    });
    expect(epochRateBoxes('2023-12-31')).toEqual({
      standard: '302',
      reduced: '312',
      accommodation: '342',
      bezugsteuer: '382',
    });
  });

  it('previews LIVA Art. 31/32 residual depreciation and Art. 30/33 proportional reduction', () => {
    expect(
      previewInputTaxAdjustment({
        type: 'autoconsumo',
        originalCostChf: 10000,
        originalVatRate: 8.1,
        yearsElapsed: 2,
        assetCategory: 'movable',
        privateOrExemptRatio: 100,
      }),
    ).toBe(486);

    expect(
      previewInputTaxAdjustment({
        type: 'mixed_use_reduction',
        originalCostChf: 10000,
        originalVatRate: 8.1,
        yearsElapsed: 0,
        assetCategory: 'general',
        privateOrExemptRatio: 25,
      }),
    ).toBe(202.5);
  });

  it('enforces quadratura gate before finalization or export', () => {
    expect(canFinalizeOrExport(null)).toBe(false);
    expect(
      canFinalizeOrExport({
        passed: false,
        checks: [],
        blockers_count: 1,
        warnings_count: 0,
        blockers: [],
        warnings: [],
      }),
    ).toBe(false);
    expect(
      canFinalizeOrExport({
        passed: true,
        checks: [],
        blockers_count: 0,
        warnings_count: 1,
        blockers: [],
        warnings: [],
      }),
    ).toBe(true);
  });
});
