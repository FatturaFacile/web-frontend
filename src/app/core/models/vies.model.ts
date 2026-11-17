export type ViesStatus = 'valid' | 'invalid' | 'unavailable';

/** Result of `POST /fiscal/vies/validate`. `is_valid` is null when VIES could not answer. */
export interface ViesValidationResult {
  status: ViesStatus;
  is_valid: boolean | null;
  country_code: string;
  vat_number: string;
  trader_name: string | null;
  trader_address: string | null;
  request_identifier: string | null;
  validated_at: string;
  error_code: string | null;
  from_cache: boolean;
}

export interface ViesValidationRequest {
  vat_number: string;
  country_code?: string | null;
  contact_id?: string | null;
}

/** EU VAT number syntax per VIES country code (Greece is EL); mirrors the backend `EuVatFormat`. */
const VIES_PATTERNS: Record<string, RegExp> = {
  AT: /^U\d{8}$/,
  BE: /^[01]\d{9}$/,
  BG: /^\d{9,10}$/,
  CY: /^\d{8}[A-Z]$/,
  CZ: /^\d{8,10}$/,
  DE: /^\d{9}$/,
  DK: /^\d{8}$/,
  EE: /^\d{9}$/,
  EL: /^\d{9}$/,
  ES: /^[A-Z0-9]\d{7}[A-Z0-9]$/,
  FI: /^\d{8}$/,
  FR: /^[A-Z0-9]{2}\d{9}$/,
  HR: /^\d{11}$/,
  HU: /^\d{8}$/,
  IE: /^\d[A-Z0-9+*]\d{5}[A-Z]{1,2}$/,
  IT: /^\d{11}$/,
  LT: /^(\d{9}|\d{12})$/,
  LU: /^\d{8}$/,
  LV: /^\d{11}$/,
  MT: /^\d{8}$/,
  NL: /^\d{9}B\d{2}$/,
  PL: /^\d{10}$/,
  PT: /^\d{9}$/,
  RO: /^\d{2,10}$/,
  SE: /^\d{12}$/,
  SI: /^\d{8}$/,
  SK: /^\d{10}$/,
};

/** True for an EU Member State (ISO code; GR is accepted for Greece). */
export function isEuMemberState(country: string | null | undefined): boolean {
  const code = (country ?? '').toUpperCase();
  return (code === 'GR' ? 'EL' : code) in VIES_PATTERNS;
}

/**
 * Formal EU VAT check done in the browser before any request. Returns the normalised
 * `[country, number]` or null when the country is not an EU Member State or the syntax is wrong.
 */
export function parseEuVat(value: string, country?: string | null): [string, string] | null {
  let vat = value.toUpperCase().replace(/[\s.\-/]/g, '');
  let code = (country ?? '').toUpperCase();
  code = code === 'GR' ? 'EL' : code;
  if (code && (vat.startsWith(code) || (code === 'EL' && vat.startsWith('GR')))) {
    vat = vat.slice(2);
  } else if (!code && vat.length > 2) {
    code = vat.slice(0, 2) === 'GR' ? 'EL' : vat.slice(0, 2);
    vat = vat.slice(2);
  }
  const pattern = VIES_PATTERNS[code];
  return pattern && pattern.test(vat) ? [code, vat] : null;
}
