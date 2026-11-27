import { HttpErrorResponse } from '@angular/common/http';
import { FormControl } from '@angular/forms';
import { describe, expect, it } from 'vitest';
import {
  REJECTION_REASONS,
  besrIdValidator,
  isIsoXmlFile,
  isoValidationKey,
  moneyAmountValidator,
  qrIbanValidator,
  qrIidValidator,
  reasonKey,
  splitApiErrors,
  statusKey,
  uploadErrorMessage,
  uploadTotals,
} from './iso-reconciliation.util';
import { camtResult, painResult } from './iso-reconciliation.testing';

const control = (value: unknown) => new FormControl(value);

describe('ISO 20022 reconciliation utilities', () => {
  it('translates the known rejection reasons and falls back to the generic one', () => {
    expect(REJECTION_REASONS).toHaveLength(19);
    expect(reasonKey('AM04')).toBe('treasuryIso.reason.AM04');
    expect(reasonKey('am04')).toBe('treasuryIso.reason.AM04');
    expect(reasonKey('ZZ99')).toBe('treasuryIso.reason.UNKNOWN');
    expect(reasonKey(null)).toBe('treasuryIso.reason.UNKNOWN');
  });

  it('has a translation key only for the standard pain.002 statuses', () => {
    expect(statusKey('RJCT')).toBe('treasuryIso.status.RJCT');
    expect(statusKey('XXXX')).toBeNull();
    expect(statusKey(null)).toBeNull();
  });

  it('accepts only non-empty XML files within the size limit', () => {
    expect(isIsoXmlFile({ name: 'camt053.XML', size: 1200 })).toBe(true);
    expect(isIsoXmlFile({ name: 'statement.pdf', size: 1200 })).toBe(false);
    expect(isIsoXmlFile({ name: 'empty.xml', size: 0 })).toBe(false);
    expect(isIsoXmlFile({ name: 'big.xml', size: 11 * 1024 * 1024 })).toBe(false);
  });

  it('totals the reconciliation of the files and counts the failed ones', () => {
    const totals = uploadTotals([{ result: camtResult }, { result: painResult }, { result: null }]);

    expect(totals).toEqual({ files: 3, failed: 1, reconciled: 3, unmatched: 1, duplicates: 2 });
  });

  it('separates the per line 422 messages from the general ones', () => {
    const error = new HttpErrorResponse({
      status: 422,
      error: {
        errors: {
          'lines.1.invoice_id': ['Invoice already paid.'],
          'lines.1.end_to_end_id': ['Duplicate end-to-end id.'],
          'lines.0.invoice_id': ['Invoice already in a batch.'],
          execution_date: ['Date required.'],
        },
      },
    });

    expect(splitApiErrors(error)).toEqual({
      general: ['Date required.'],
      lines: { 0: ['Invoice already in a batch.'], 1: ['Invoice already paid.', 'Duplicate end-to-end id.'] },
    });
    expect(splitApiErrors(new Error('x'))).toEqual({ general: [], lines: {} });
  });

  it('reads the upload error from validation errors or Problem Details', () => {
    const validation = new HttpErrorResponse({ status: 422, error: { errors: { file: ['Unknown message type.'] } } });
    const problem = new HttpErrorResponse({ status: 422, error: { detail: 'Invalid XML.' } });

    expect(uploadErrorMessage(validation)).toBe('Unknown message type.');
    expect(uploadErrorMessage(problem)).toBe('Invalid XML.');
    expect(uploadErrorMessage(new HttpErrorResponse({ status: 500 }))).toBe('');
  });
});

describe('bank configuration validators', () => {
  it('lets an empty optional value pass', () => {
    for (const validator of [qrIidValidator, besrIdValidator, qrIbanValidator, moneyAmountValidator]) {
      expect(validator(control(''))).toBeNull();
      expect(validator(control(null))).toBeNull();
    }
  });

  it('keeps the QR-IID within 30000-31999', () => {
    expect(qrIidValidator(control('30000'))).toBeNull();
    expect(qrIidValidator(control('31999'))).toBeNull();
    expect(qrIidValidator(control('29999'))).toEqual({ qrIid: true });
    expect(qrIidValidator(control('32000'))).toEqual({ qrIid: true });
    expect(qrIidValidator(control('3199'))).toEqual({ qrIid: true });
    expect(qrIidValidator(control('3199a'))).toEqual({ qrIid: true });
  });

  it('requires 6 to 9 digits for the BESR-ID', () => {
    expect(besrIdValidator(control('123456'))).toBeNull();
    expect(besrIdValidator(control('123456789'))).toBeNull();
    expect(besrIdValidator(control('12345'))).toEqual({ besrId: true });
    expect(besrIdValidator(control('1234567890'))).toEqual({ besrId: true });
    expect(besrIdValidator(control('12345a'))).toEqual({ besrId: true });
  });

  it('accepts a Swiss QR-IBAN and refuses a regular IBAN or one with a wrong check', () => {
    expect(qrIbanValidator(control('CH44 3199 9123 0008 8901 2'))).toBeNull();
    expect(qrIbanValidator(control('CH9300762011623852957'))).toEqual({ qrIban: true });
    expect(qrIbanValidator(control('IT60X0542811101000000123456'))).toEqual({ qrIban: true });
    expect(qrIbanValidator(control('CH4431999123000889013'))).toEqual({ qrIban: true });
  });

  it('accepts non negative amounts with at most two decimals', () => {
    expect(moneyAmountValidator(control(0))).toBeNull();
    expect(moneyAmountValidator(control(0.05))).toBeNull();
    expect(moneyAmountValidator(control(12.5))).toBeNull();
    expect(moneyAmountValidator(control(-1))).toEqual({ amount: true });
    expect(moneyAmountValidator(control(0.123))).toEqual({ amount: true });
  });

  it('maps a failed control to its translation key', () => {
    const iid = new FormControl('29999', qrIidValidator);
    const amount = new FormControl(-1, moneyAmountValidator);

    expect(isoValidationKey(iid)).toBe('treasuryIso.validation.qrIid');
    expect(isoValidationKey(amount)).toBe('treasuryIso.validation.amount');
    expect(isoValidationKey(new FormControl('31000', qrIidValidator))).toBe('');
  });
});
