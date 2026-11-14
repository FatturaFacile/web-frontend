import { FormControl } from '@angular/forms';
import { describe, expect, it } from 'vitest';
import { ibanValidator, isValidIban } from './iban-validator';

describe('iban validator', () => {
  it('accepts well formed IBANs with spaces and lower case', () => {
    expect(isValidIban('IT60X0542811101000000123456')).toBe(true);
    expect(isValidIban('ch93 0076 2011 6238 5295 7')).toBe(true);
    expect(isValidIban('DE89370400440532013000')).toBe(true);
  });

  it('rejects a wrong checksum, length, country and format', () => {
    expect(isValidIban('IT60X0542811101000000123457')).toBe(false);
    expect(isValidIban('IT60X054281110100000012345')).toBe(false);
    expect(isValidIban('ZZ60X0542811101000000123456')).toBe(false);
    expect(isValidIban('1234')).toBe(false);
  });

  it('lets an empty control pass and flags an invalid one', () => {
    expect(ibanValidator(new FormControl(''))).toBeNull();
    expect(ibanValidator(new FormControl(null))).toBeNull();
    expect(ibanValidator(new FormControl('IT00'))).toEqual({ iban: true });
  });
});
