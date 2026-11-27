import { HttpErrorResponse } from '@angular/common/http';
import { describe, expect, it } from 'vitest';
import {
  alertColor,
  claimStatusColor,
  countryOfVatNumber,
  errorKey,
  exportFilename,
  exportTypesOf,
  failureOf,
  isoDay,
  mandateColor,
  progressStatus,
  stepIndex,
  toNumber,
} from './foreign-vat-refund.util';

describe('foreign VAT refund util', () => {
  it('builds the error key from the code of the problem and falls back to unknown', () => {
    expect(errorKey('deadline_expired')).toBe('foreignVat.error.deadline_expired');
    expect(errorKey(null)).toBe('foreignVat.error.unknown');
  });

  it('turns a failed call into a translated outcome with the placeholders', () => {
    const outcome = failureOf(
      new HttpErrorResponse({
        status: 422,
        error: { code: 'below_threshold', context: { threshold: 500, currency: 'CHF', note: null } },
      }),
    );

    expect(outcome).toEqual({
      ok: false,
      errorKey: 'foreignVat.error.below_threshold',
      code: 'below_threshold',
      params: { threshold: '500', currency: 'CHF', note: '' },
    });
    expect(failureOf(new Error('boom')).errorKey).toBe('foreignVat.error.unknown');
  });

  it('colours the statuses and the countdown', () => {
    expect(claimStatusColor('REFUNDED')).toBe('green');
    expect(claimStatusColor('REJECTED')).toBe('red');
    expect(claimStatusColor('SUBMITTED')).toBe('blue');
    expect(claimStatusColor(null)).toBe('default');
    expect(alertColor('EXPIRED')).toBe('red');
    expect(alertColor(15)).toBe('red');
    expect(alertColor(30)).toBe('volcano');
    expect(alertColor(60)).toBe('orange');
    expect(alertColor(null)).toBe('default');
    expect(mandateColor('VALID')).toBe('green');
    expect(mandateColor('CERTIFICATE_EXPIRING')).toBe('orange');
    expect(mandateColor('MISSING')).toBe('red');
    expect(progressStatus('THRESHOLD_MET')).toBe('success');
    expect(progressStatus('BELOW_THRESHOLD')).toBe('active');
  });

  it('places a claim on the steps of its timeline', () => {
    expect(stepIndex('DRAFT')).toBe(0);
    expect(stepIndex('READY_TO_SUBMIT')).toBe(1);
    expect(stepIndex('ADDITIONAL_INFO_REQUESTED')).toBe(2);
    expect(stepIndex('PARTIALLY_APPROVED')).toBe(3);
    expect(stepIndex('REFUNDED')).toBe(4);
  });

  it('picks the official file of each regime and names the download', () => {
    expect(exportTypesOf({ regime_type: 'EU_DIR_2008_9_CE' })).toEqual(['eu-xml']);
    expect(exportTypesOf({ regime_type: 'CH_ESTV_RECIPROCITY' })).toEqual(['estv-package']);
    expect(exportTypesOf({ regime_type: 'IT_ART_38_TER' })).toEqual(['iva79-package']);
    expect(exportFilename('FVR-2026-DE-0001', 'eu-xml')).toBe('FVR-2026-DE-0001-eu-portal.xml');
    expect(exportFilename('FVR-2026-CH-0001', 'estv-package')).toBe('FVR-2026-CH-0001-estv.zip');
    expect(exportFilename('FVR-2026-IT-0001', 'iva79-package')).toBe('FVR-2026-IT-0001-iva79.zip');
  });

  it('reads the country of a VAT number like the API does', () => {
    expect(countryOfVatNumber('CHE-123.456.788 MWST')).toBe('CH');
    expect(countryOfVatNumber('de123456789')).toBe('DE');
    expect(countryOfVatNumber('EL123456789')).toBe('GR');
    expect(countryOfVatNumber('12345')).toBeNull();
    expect(countryOfVatNumber(null)).toBeNull();
  });

  it('formats days and amounts', () => {
    expect(isoDay(new Date(2027, 5, 3))).toBe('2027-06-03');
    expect(toNumber('12.50')).toBe(12.5);
    expect(toNumber(null)).toBe(0);
    expect(toNumber('')).toBe(0);
  });
});
