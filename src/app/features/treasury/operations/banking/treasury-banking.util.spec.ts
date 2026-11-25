import { HttpErrorResponse } from '@angular/common/http';
import { describe, expect, it } from 'vitest';
import {
  apiErrorMessages,
  confidenceTone,
  emptyCsvMapping,
  f24Balance,
  fromCents,
  isCsvMappingReady,
  isStatementFile,
  toCents,
  toIsoDate,
} from './treasury-banking.util';

describe('treasury banking utilities', () => {
  it('converts decimal text to exact cents and back', () => {
    expect(toCents('0.10') + toCents('0.20')).toBe(30);
    expect(toCents('1234.5')).toBe(123450);
    expect(toCents('-12,34')).toBe(-1234);
    expect(toCents('')).toBe(0);
    expect(toCents('12.345')).toBeNaN();
    expect(toCents('abc')).toBeNaN();
    expect(fromCents(123450)).toBe('1234.50');
    expect(fromCents(-5)).toBe('-0.05');
    expect(fromCents(7)).toBe('0.07');
  });

  it('balances F24 debits against the credits compensated, without floating point drift', () => {
    const balance = f24Balance([
      { debit_amount: '0.10', credit_amount: '0' },
      { debit_amount: '0.20', credit_amount: '0' },
      { debit_amount: '0', credit_amount: '0.30' },
    ]);

    expect(balance).toMatchObject({
      debit: '0.30',
      credit: '0.30',
      payable: '0.00',
      balanced: true,
      zeroBalance: true,
      creditExceedsDebit: false,
    });
  });

  it('flags credits above the debits, empty F24 and unreadable amounts', () => {
    expect(
      f24Balance([
        { debit_amount: '100.00', credit_amount: '0' },
        { debit_amount: '0', credit_amount: '100.01' },
      ]),
    ).toMatchObject({
      creditExceedsDebit: true,
      balanced: false,
      payable: '-0.01',
    });
    expect(f24Balance([{ debit_amount: '0', credit_amount: '0' }]).balanced).toBe(false);
    expect(f24Balance([{ debit_amount: 'x', credit_amount: '0' }])).toMatchObject({
      invalidAmounts: true,
      balanced: false,
    });
    expect(f24Balance([{ debit_amount: '250.50', credit_amount: '0' }])).toMatchObject({
      balanced: true,
      zeroBalance: false,
      payable: '250.50',
    });
  });

  it('needs the account, a date column and an amount for a CSV mapping', () => {
    const mapping = emptyCsvMapping();
    expect(isCsvMappingReady(mapping)).toBe(false);

    mapping.account_iban = 'IT60X0542811101000000123456';
    mapping.columns = { booking_date: 'Data' };
    expect(isCsvMappingReady(mapping)).toBe(false);

    mapping.columns = { booking_date: 'Data', debit: 'Dare' };
    expect(isCsvMappingReady(mapping)).toBe(true);
  });

  it('grades the confidence of a proposal', () => {
    expect(confidenceTone(100)).toBe('green');
    expect(confidenceTone(95)).toBe('green');
    expect(confidenceTone(85)).toBe('blue');
    expect(confidenceTone(70)).toBe('orange');
    expect(confidenceTone(69)).toBe('red');
  });

  it('accepts only statement files of a supported type and size', () => {
    expect(isStatementFile({ name: 'camt053.XML', size: 100 })).toBe(true);
    expect(isStatementFile({ name: 'export.csv', size: 100 })).toBe(true);
    expect(isStatementFile({ name: 'flusso.cbi', size: 100 })).toBe(true);
    expect(isStatementFile({ name: 'statement.pdf', size: 100 })).toBe(false);
    expect(isStatementFile({ name: 'big.xml', size: 11 * 1024 * 1024 })).toBe(false);
  });

  it('formats a date in the local time zone', () => {
    expect(toIsoDate(new Date(2026, 2, 5, 23, 59))).toBe('2026-03-05');
  });

  it('flattens the messages of a validation response and falls back to the problem detail', () => {
    const validation = new HttpErrorResponse({
      status: 422,
      error: { errors: { cuc: ['The CUC is required.'], 'lines.0.currency': ['Wrong currency.'] } },
    });
    const problem = new HttpErrorResponse({
      status: 422,
      error: { detail: 'Mapping column not found.' },
    });

    expect(apiErrorMessages(validation)).toEqual(['The CUC is required.', 'Wrong currency.']);
    expect(apiErrorMessages(problem)).toEqual(['Mapping column not found.']);
    expect(apiErrorMessages(new Error('x'))).toEqual([]);
  });
});
