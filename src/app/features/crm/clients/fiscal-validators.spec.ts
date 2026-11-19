import { FormControl } from '@angular/forms';
import { describe, expect, it } from 'vitest';
import {
  fiscalCodeValidator,
  isValidItalianFiscalCode,
  isValidItalianVat,
  isValidSdiCode,
  isValidSwissUid,
  sdiCodeValidator,
  vatNumberValidator,
} from './fiscal-validators';

describe('fiscal validators', () => {
  it('checks the Partita IVA check digit', () => {
    expect(isValidItalianVat('01234567897')).toBe(true);
    expect(isValidItalianVat('IT 01234567897')).toBe(true);
    expect(isValidItalianVat('01234567890')).toBe(false);
    expect(isValidItalianVat('0123456789')).toBe(false);
    expect(isValidItalianVat('00000000000')).toBe(false);
  });

  it('checks the Codice Fiscale checksum, omocodia and birth date', () => {
    expect(isValidItalianFiscalCode('RSSMRA85T10A562S')).toBe(true);
    expect(isValidItalianFiscalCode('rssmra85t10a562s')).toBe(true);
    expect(isValidItalianFiscalCode('RSSMRA85T10A562X')).toBe(false);
    expect(isValidItalianFiscalCode('RSSMRA85T10A562')).toBe(false);
    expect(isValidItalianFiscalCode('01234567897')).toBe(true);
    expect(isValidItalianFiscalCode('01234567890')).toBe(false);
  });

  it('checks the Swiss UID modulo-11 check digit', () => {
    expect(isValidSwissUid('CHE-116.281.710')).toBe(true);
    expect(isValidSwissUid('CHE116281710 MWST')).toBe(true);
    expect(isValidSwissUid('CHE-116.281.711')).toBe(false);
    expect(isValidSwissUid('116.281.710')).toBe(false);
  });

  it('accepts exactly 7 alphanumeric characters as SDI code', () => {
    expect(isValidSdiCode('ABC1234')).toBe(true);
    expect(isValidSdiCode('0000000')).toBe(true);
    expect(isValidSdiCode('ABC123')).toBe(false);
    expect(isValidSdiCode('ABC-123')).toBe(false);
    expect(sdiCodeValidator(new FormControl(''))).toBeNull();
    expect(sdiCodeValidator(new FormControl('ABC'))).toEqual({ sdiCode: true });
  });

  it('applies the VAT and fiscal code rules by country', () => {
    let country = 'IT';
    const vat = vatNumberValidator(() => country);
    const cf = fiscalCodeValidator(() => country);
    expect(vat(new FormControl('01234567890'))).toEqual({ itVat: true });
    country = 'CH';
    expect(vat(new FormControl('CHE-116.281.711'))).toEqual({ chUid: true });
    expect(vat(new FormControl('123456'))).toBeNull();
    expect(cf(new FormControl('nonsense'))).toBeNull();
    country = 'DE';
    expect(vat(new FormControl('DE123'))).toBeNull();
  });
});
