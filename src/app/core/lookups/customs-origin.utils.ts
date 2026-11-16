import type { CustomsOriginType, TaricCodeLevel } from '../models/customs-codes.model';

/** Codes of the HS (6), CN (8) and TARIC (10) digit levels; the API accepts exactly these lengths. */
export const TARIC_CODE_PATTERN = /^\d{6}(\d{2}(\d{2})?)?$/;

/** Level of a customs code from its digit count, or `null` while the code is not a valid 6/8/10 digit number. */
export function taricLevelOf(code: string | null | undefined): TaricCodeLevel | null {
  const value = (code ?? '').trim();
  if (!TARIC_CODE_PATTERN.test(value)) {
    return null;
  }
  return value.length === 6 ? 'HS6' : value.length === 8 ? 'CN8' : 'TARIC10';
}

/** Short label of a level, as shown in the badge. */
export const TARIC_LEVEL_LABEL: Readonly<Record<TaricCodeLevel, string>> = {
  HS6: 'HS 6',
  CN8: 'CN 8',
  TARIC10: 'TARIC 10',
};

/** Reduces a typed code to its digits (dots and spaces of `8471.30.00` are tolerated). */
export function normalizeTaricCode(raw: string | null | undefined): string {
  return (raw ?? '').replace(/[\s.]/g, '');
}

/** ISO 3166-1 alpha-2 codes. */
export const COUNTRY_CODES: readonly string[] = (
  'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ ' +
  'CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR ' +
  'GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO ' +
  'JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR ' +
  'MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO ' +
  'RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV ' +
  'TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'
).split(' ');

/** English name of a country (falls back to the code when the runtime has no region names). */
export function countryName(code: string, locale = 'en'): string {
  try {
    return new Intl.DisplayNames([locale], { type: 'region' }).of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}

export interface CountryOption {
  code: string;
  name: string;
}

/** Selectable countries sorted by name. */
export function countryOptions(locale = 'en'): CountryOption[] {
  return COUNTRY_CODES.map((code) => ({ code, name: countryName(code, locale) })).sort((a, b) =>
    a.name.localeCompare(b.name, locale),
  );
}

/**
 * Default "Made in" label of a country: `Made in Italy` for IT, `Swiss Made` for CH, otherwise
 * `Made in <English country name>`. Mirrors the label the API derives when none is sent.
 */
export function madeInLabelFor(code: string | null | undefined): string {
  const iso = (code ?? '').trim().toUpperCase();
  if (!iso) {
    return '';
  }
  if (iso === 'IT') {
    return 'Made in Italy';
  }
  if (iso === 'CH') {
    return 'Swiss Made';
  }
  return `Made in ${countryName(iso, 'en')}`;
}

export const CUSTOMS_ORIGIN_TYPES: readonly CustomsOriginType[] = ['preferential', 'non_preferential'];

/** Text of a localized value in the given language, falling back to English, Italian and then any other locale. */
export function pickLocalized(text: Partial<Record<string, string | null>> | null | undefined, language: string): string {
  if (!text) {
    return '';
  }
  for (const locale of [language, 'en', 'it', 'de', 'fr']) {
    const value = text[locale];
    if (value) {
      return value;
    }
  }
  return '';
}
