import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/** Length of the IBAN per country, from the SWIFT IBAN registry (the same table as the API IbanValidator). */
const IBAN_COUNTRY_LENGTHS: Record<string, number> = {
  AD: 24, AE: 23, AL: 28, AT: 20, AZ: 28, BA: 20, BE: 16, BG: 22, BH: 22,
  BR: 29, BY: 28, CH: 21, CR: 22, CY: 28, CZ: 24, DE: 22, DK: 18, DO: 28,
  EE: 20, EG: 29, ES: 24, FI: 18, FO: 18, FR: 27, GB: 22, GE: 22, GI: 23,
  GL: 18, GR: 27, GT: 28, HR: 21, HU: 28, IE: 22, IL: 23, IQ: 23, IS: 26,
  IT: 27, JO: 30, KW: 30, KZ: 20, LB: 28, LC: 32, LI: 21, LT: 20, LU: 20,
  LV: 21, LY: 25, MC: 27, MD: 24, ME: 22, MK: 19, MR: 27, MT: 31, MU: 30,
  NL: 18, NO: 15, PK: 24, PL: 28, PS: 29, PT: 25, QA: 29, RO: 24, RS: 22,
  SA: 24, SC: 31, SD: 18, SE: 24, SI: 19, SK: 24, SM: 27, ST: 25, SV: 28,
  TL: 23, TN: 24, TR: 26, UA: 29, VA: 22, VG: 24, XK: 20,
};

/** Upper case without spaces and dashes, as the API normalizes it. */
export function normalizeIban(iban: string): string {
  return iban.replace(/[ -]/g, '').toUpperCase();
}

/**
 * IBAN check of ISO 13616, mirror of the API ValidIban rule: alphabet, country, length of the country and the mod-97
 * check digits.
 */
export function isValidIban(iban: string): boolean {
  const normalized = normalizeIban(iban);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(normalized)) {
    return false;
  }
  if (IBAN_COUNTRY_LENGTHS[normalized.slice(0, 2)] !== normalized.length) {
    return false;
  }
  const rearranged = normalized.slice(4) + normalized.slice(0, 4);
  let remainder = 0;
  for (const character of rearranged) {
    const code = character.charCodeAt(0);
    const digits = code >= 65 ? String(code - 55) : character;
    for (const digit of digits) {
      remainder = (remainder * 10 + Number(digit)) % 97;
    }
  }
  return remainder === 1;
}

/**
 * Validator for an IBAN control: an empty value passes (add Validators.required where it is mandatory), a filled one must
 * be a well formed IBAN. The error is `{ iban: true }`; show it with COMMON.VALIDATION.INVALID_IBAN.
 */
export const ibanValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const value = control.value;
  if (value === null || value === undefined || value === '') {
    return null;
  }
  return typeof value === 'string' && isValidIban(value) ? null : { iban: true };
};
