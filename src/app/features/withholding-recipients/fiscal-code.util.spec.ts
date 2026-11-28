import { describe, expect, it } from 'vitest';
import {
  birthDateFromFiscalCode,
  isFiscalCodeShape,
  isoDate,
  sexFromFiscalCode,
} from './fiscal-code.util';

const reference = new Date(2026, 5, 15);

describe('fiscal code birth date', () => {
  it('reads the date of a male code in the century that makes the person adult and the youngest', () => {
    expect(birthDateFromFiscalCode('RSSMRA85T10A562S', reference)).toBe('1985-12-10');
    expect(birthDateFromFiscalCode('RSSMRA05C10A562S', reference)).toBe('2005-03-10');
  });

  it('takes 40 off the day of a woman', () => {
    expect(birthDateFromFiscalCode('RSSMRA85T50A562S', reference)).toBe('1985-12-10');
    expect(sexFromFiscalCode('RSSMRA85T50A562S')).toBe('F');
    expect(sexFromFiscalCode('RSSMRA85T10A562S')).toBe('M');
  });

  it('decodes every month letter', () => {
    const letters = 'ABCDEHLMPRST';
    for (let index = 0; index < letters.length; index++) {
      const code = `RSSMRA90${letters[index]}10A562S`;
      expect(birthDateFromFiscalCode(code, reference)).toBe(
        `1990-${String(index + 1).padStart(2, '0')}-10`,
      );
    }
  });

  it('goes back one century when the person would be younger than 14', () => {
    // 15 -> 2015 is 11 years old on the reference date, so the person was born in 1915.
    expect(birthDateFromFiscalCode('RSSMRA15C10A562S', reference)).toBe('1915-03-10');
    // 12 -> 2012 is 14 years old on 15 June 2026 only after the birthday.
    expect(birthDateFromFiscalCode('RSSMRA12C10A562S', reference)).toBe('2012-03-10');
    expect(birthDateFromFiscalCode('RSSMRA12L10A562S', reference)).toBe('1912-07-10');
  });

  it('accepts lower case and surrounding spaces', () => {
    expect(birthDateFromFiscalCode(' rssmra85t10a562s ', reference)).toBe('1985-12-10');
  });

  it('refuses a code that is not well formed or encodes no real day', () => {
    expect(birthDateFromFiscalCode('', reference)).toBeNull();
    expect(birthDateFromFiscalCode(null, reference)).toBeNull();
    expect(birthDateFromFiscalCode('RSSMRA85T10A562', reference)).toBeNull();
    expect(birthDateFromFiscalCode('RSSMRA85Z10A562S', reference)).toBeNull();
    expect(birthDateFromFiscalCode('RSSMRA85B31A562S', reference)).toBeNull();
    expect(birthDateFromFiscalCode('12345678901', reference)).toBeNull();
  });

  it('accepts the 29th of February only in a leap year', () => {
    expect(birthDateFromFiscalCode('RSSMRA84B29A562S', reference)).toBe('1984-02-29');
    expect(birthDateFromFiscalCode('RSSMRA85B29A562S', reference)).toBeNull();
  });

  it('tells a well formed code from a malformed one', () => {
    expect(isFiscalCodeShape('RSSMRA85T10A562S')).toBe(true);
    expect(isFiscalCodeShape('rssmra85t10a562s')).toBe(true);
    expect(isFiscalCodeShape('RSSMRA85T10A562')).toBe(false);
    expect(isFiscalCodeShape(undefined)).toBe(false);
  });

  it('writes a local date as YYYY-MM-DD', () => {
    expect(isoDate(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});
