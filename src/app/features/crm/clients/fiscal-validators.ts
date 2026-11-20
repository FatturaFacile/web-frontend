import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * Offline checks of the Italian and Swiss fiscal identifiers. They mirror the backend `FiscalIdentifiers` class, so a
 * wrong value is reported before the API answers 422.
 */

const CF_ODD = [1, 0, 5, 7, 9, 13, 15, 17, 19, 21, 2, 4, 18, 20, 11, 3, 6, 8, 12, 14, 16, 10, 22, 25, 24, 23];
const OMOCODIA = 'LMNPQRSTUV';
const DIGIT_POSITIONS = [6, 7, 9, 10, 12, 13, 14];
const MONTHS = 'ABCDEHLMPRST';
const DAYS_PER_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** Italian VAT number: optional `IT` prefix, 11 digits, check digit. */
export function isValidItalianVat(value: string): boolean {
  const upper = value.replace(/[\s.-]/g, '').toUpperCase();
  const vat = upper.startsWith('IT') ? upper.slice(2) : upper;
  if (!/^\d{11}$/.test(vat) || Number(vat.slice(0, 7)) === 0) {
    return false;
  }
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    let digit = Number(vat[i]);
    if (i % 2 === 1) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }
    sum += digit;
  }
  return (10 - (sum % 10)) % 10 === Number(vat[10]);
}

/** Italian Codice Fiscale: the 16-character personal code (checksum, omocodia, birth date) or the 11-digit company code. */
export function isValidItalianFiscalCode(value: string): boolean {
  const code = value.replace(/\s+/g, '').toUpperCase();
  if (/^\d{11}$/.test(code)) {
    return isValidItalianVat(code);
  }
  if (!/^[A-Z]{6}[0-9LMNPQRSTUV]{2}[ABCDEHLMPRST][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]$/.test(code)) {
    return false;
  }
  let sum = 0;
  for (let i = 0; i < 15; i++) {
    const char = code[i];
    const index = /\d/.test(char) ? Number(char) : char.charCodeAt(0) - 65;
    sum += i % 2 === 0 ? CF_ODD[index] : index;
  }
  if (String.fromCharCode(65 + (sum % 26)) !== code[15]) {
    return false;
  }
  return hasPlausibleBirthDate(code);
}

function hasPlausibleBirthDate(code: string): boolean {
  const chars = code.split('');
  for (const position of DIGIT_POSITIONS) {
    const index = OMOCODIA.indexOf(chars[position]);
    if (index !== -1) {
      chars[position] = String(index);
    }
  }
  const month = MONTHS.indexOf(chars[8]);
  let day = Number(chars.slice(9, 11).join(''));
  day = day > 40 ? day - 40 : day;
  return day >= 1 && day <= DAYS_PER_MONTH[month];
}

/** Swiss UID `CHE-xxx.xxx.xxx` (optional VAT suffix such as MWST), modulo-11 check digit. */
export function isValidSwissUid(value: string): boolean {
  const match = /^\s*CHE[\s.-]?(\d{3})[\s.-]?(\d{3})[\s.-]?(\d{3})(?:\s*(?:MWST|TVA|IVA|VAT|HR|RC|RF))?\s*$/i.exec(value);
  if (!match) {
    return false;
  }
  const digits = `${match[1]}${match[2]}${match[3]}`;
  const weights = [5, 4, 3, 2, 7, 6, 5, 4];
  const sum = weights.reduce((total, weight, i) => total + Number(digits[i]) * weight, 0);
  let check = 11 - (sum % 11);
  if (check === 11) {
    check = 0;
  }
  return check !== 10 && check === Number(digits[8]);
}

/** SDI recipient code: 7 alphanumeric characters. */
export function isValidSdiCode(value: string): boolean {
  return /^[A-Z0-9]{7}$/.test(value.trim().toUpperCase());
}

/** Applies `isValid` to a filled value; an empty value is left to `required`. */
function whenFilled(error: string, isValid: (value: string) => boolean): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = String(control.value ?? '').trim();
    return value === '' || isValid(value) ? null : { [error]: true };
  };
}

export const italianVatValidator = whenFilled('itVat', isValidItalianVat);
export const italianFiscalCodeValidator = whenFilled('itFiscalCode', isValidItalianFiscalCode);
export const swissUidValidator = whenFilled('chUid', isValidSwissUid);
export const sdiCodeValidator = whenFilled('sdiCode', isValidSdiCode);

/** Fiscal error names set by the validators above. */
export const FISCAL_ERRORS = ['itVat', 'itFiscalCode', 'chUid', 'sdiCode'] as const;

/**
 * VAT number rule of the backend: an Italian contact needs a valid Partita IVA, a Swiss one with a `CHE` number a valid
 * UID, every other country is not checked.
 */
export function vatNumberValidator(country: () => string): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = String(control.value ?? '').trim();
    const code = country().toUpperCase();
    if (code === 'IT') {
      return italianVatValidator(control);
    }
    return code === 'CH' && value.toUpperCase().startsWith('CHE') ? swissUidValidator(control) : null;
  };
}

/** The Codice Fiscale rule applies to Italian contacts only. */
export function fiscalCodeValidator(country: () => string): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null =>
    country().toUpperCase() === 'IT' ? italianFiscalCodeValidator(control) : null;
}
