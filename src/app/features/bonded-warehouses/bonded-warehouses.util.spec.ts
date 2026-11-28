import { HttpErrorResponse } from '@angular/common/http';
import { describe, expect, it } from 'vitest';
import {
  aeoColor,
  customsStatusColor,
  discrepancyColor,
  errorKey,
  extractionBase,
  extractionVat,
  failureOf,
  findingKey,
  isExtraction,
  isValidMrn,
  isValidTaric,
  normalizeMrn,
  toNumber,
  utilizationColor,
  utilizationStatus,
} from './bonded-warehouses.util';

describe('bonded warehouses util', () => {
  it('builds the error key from the code of the problem and falls back to unknown', () => {
    expect(errorKey('cgu_ceiling_exceeded')).toBe('bondedWarehouses.error.cgu_ceiling_exceeded');
    expect(errorKey(null)).toBe('bondedWarehouses.error.unknown');
  });

  it('turns a failed call into a translated outcome with the placeholders of the CGU ceiling', () => {
    const outcome = failureOf(
      new HttpErrorResponse({
        status: 422,
        error: {
          code: 'cgu_ceiling_exceeded',
          context: { available: '300.00', requested: '342.00', currency: 'EUR', missing: null },
        },
      }),
    );

    expect(outcome.ok).toBe(false);
    expect(outcome.errorKey).toBe('bondedWarehouses.error.cgu_ceiling_exceeded');
    expect(outcome.params).toEqual({
      available: '300.00',
      requested: '342.00',
      currency: 'EUR',
      missing: '',
    });
    expect(failureOf(new Error('offline')).errorKey).toBe('bondedWarehouses.error.unknown');
  });

  it('colours the guarantee gauge: green below 80 %, orange from 80 %, red from 95 %', () => {
    expect(utilizationStatus(79.9)).toBe('success');
    expect(utilizationStatus(80)).toBe('normal');
    expect(utilizationStatus(95)).toBe('exception');
    expect(utilizationColor(10)).toBe('#52c41a');
    expect(utilizationColor(85)).toBe('#fa8c16');
    expect(utilizationColor(99)).toBe('#f5222d');
  });

  it('colours the statuses of the lots, the audits and the AEO certificates', () => {
    expect(customsStatusColor('NonUnion_Suspended')).toBe('blue');
    expect(customsStatusColor('UsualHandling_InProgress')).toBe('purple');
    expect(customsStatusColor('PartiallyDischarged')).toBe('orange');
    expect(customsStatusColor('FullyDischarged')).toBe('green');
    expect(customsStatusColor(null)).toBe('default');
    expect(discrepancyColor('Matched')).toBe('green');
    expect(discrepancyColor('Minor_Variance')).toBe('orange');
    expect(discrepancyColor('Critical_Alert_ADM_UDSC')).toBe('red');
    expect(aeoColor('None')).toBe('default');
    expect(aeoColor('AEOS')).toBe('geekblue');
  });

  it('validates the MRN and the TARIC code like the API', () => {
    expect(isValidMrn('26IT000123456789AB')).toBe(true);
    expect(isValidMrn(' 26it000123456789ab ')).toBe(true);
    expect(isValidMrn('26IT0001234')).toBe(false);
    expect(isValidMrn('IT26000123456789AB')).toBe(false);
    expect(normalizeMrn(' 26it 0001 2345 6789 ab')).toBe('26IT000123456789AB');
    expect(isValidTaric('09011100')).toBe(true);
    expect(isValidTaric('0901110012')).toBe(true);
    expect(isValidTaric('090111')).toBe(false);
  });

  it('takes the taxable base of an extraction as the goods plus the services and computes the VAT', () => {
    expect(extractionBase(1000, 200)).toBe(1200);
    expect(extractionVat(1200, 22)).toBe(264);
    expect(extractionVat(33.34, 22)).toBe(7.33);
    expect(extractionVat(1200, 0)).toBe(0);
    expect(isExtraction('Extraction_TD23')).toBe(true);
    expect(isExtraction('Inbound_IntraEU')).toBe(false);
  });

  it('reads the decimal strings of the API and finds the codes the system writes in the findings', () => {
    expect(toNumber('342.00')).toBe(342);
    expect(toNumber(null)).toBe(0);
    expect(toNumber('abc')).toBe(0);
    expect(findingKey('physical_shortfall')).toBe('bondedWarehouses.finding.physical_shortfall');
    expect(findingKey('Seal broken at the gate')).toBeNull();
    expect(findingKey(null)).toBeNull();
  });
});
