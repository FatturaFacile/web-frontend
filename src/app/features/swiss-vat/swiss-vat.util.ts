import {
  BezugsteuerEntry,
  InputTaxAdjustmentType,
  QuadraturaReport,
  SwissVatFrequency,
  SwissVatReturnStatus,
} from '@core';

export const RETURN_STATUS_COLORS: Readonly<Record<SwissVatReturnStatus, string>> = {
  draft: 'default',
  calculated: 'processing',
  validated: 'cyan',
  finalized: 'green',
  submitted: 'blue',
};

export const BEZUGSTEUER_STATUS_COLORS: Readonly<Record<BezugsteuerEntry['status'], string>> = {
  detected: 'gold',
  confirmed: 'green',
  excluded: 'default',
  declared: 'blue',
};

/** Swiss commercial rounding to nearest 0.05 CHF. */
export function roundChf005(amount: number): number {
  return Math.round(amount * 20) / 20;
}

/** Validates Swiss UID-MWST format (CHE-XXX.XXX.XXX MWST) and Mod-11 check digit. */
export function isValidSwissUidMwst(raw: string): boolean {
  const digits = raw.replace(/\D/g, '');
  if (digits.length !== 9 || digits === '000000000') {
    return false;
  }
  const weights = [5, 4, 3, 2, 7, 6, 5, 4];
  let sum = 0;
  for (let i = 0; i < 8; i++) {
    sum += Number(digits[i]) * weights[i];
  }
  const expected = (11 - (sum % 11)) % 11;
  return expected !== 10 && expected === Number(digits[8]);
}

/** Returns max period number per reporting frequency. */
export function maxPeriodNumber(freq: SwissVatFrequency): number {
  switch (freq) {
    case 'monthly':
      return 12;
    case 'quarterly':
      return 4;
    case 'semiannual':
      return 2;
  }
}

/** Preview of LIVA Art. 31/32 residual depreciation or Art. 30/33 proportional input tax adjustment. */
export function previewInputTaxAdjustment(params: {
  type: InputTaxAdjustmentType;
  originalCostChf: number;
  originalVatRate: number;
  yearsElapsed: number;
  assetCategory: 'movable' | 'real_estate' | 'service' | 'general';
  privateOrExemptRatio: number;
}): number {
  if (params.originalCostChf <= 0 || params.originalVatRate < 0) {
    return 0;
  }
  const originalVat = (params.originalCostChf * params.originalVatRate) / 100;
  if (params.type === 'mixed_use_reduction' || params.type === 'subsidy_reduction') {
    return Math.round(((originalVat * Math.max(0, Math.min(100, params.privateOrExemptRatio))) / 100) * 100) / 100;
  }
  const usefulLife = params.assetCategory === 'real_estate' ? 20 : 5;
  const remaining = Math.max(0, usefulLife - Math.max(0, params.yearsElapsed));
  const ratioFactor =
    params.privateOrExemptRatio > 0 ? Math.min(100, params.privateOrExemptRatio) / 100 : 1;
  return Math.round(((originalVat * (remaining / usefulLife) * ratioFactor)) * 100) / 100;
}

/** Returns true if a return has zero blocking quadratura errors. */
export function canFinalizeOrExport(report: QuadraturaReport | null | undefined): boolean {
  if (!report) {
    return false;
  }
  return report.passed && report.blockers_count === 0;
}

/** Resolves epoch-specific AFC rate box codes (2024+ vs 2018-2023). */
export function epochRateBoxes(periodTo: string): {
  standard: string;
  reduced: string;
  accommodation: string;
  bezugsteuer: string;
} {
  if (periodTo >= '2024-01-01') {
    return { standard: '303', reduced: '313', accommodation: '343', bezugsteuer: '383' };
  }
  return { standard: '302', reduced: '312', accommodation: '342', bezugsteuer: '382' };
}
