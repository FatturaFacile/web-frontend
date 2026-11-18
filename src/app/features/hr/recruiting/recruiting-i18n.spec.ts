import { describe, expect, it } from 'vitest';
import {
  APPLICATION_SOURCES,
  CONTRACT_TYPES,
  CV_PARSE_STATUSES,
  EMAIL_STATUSES,
  EMPLOYMENT_TYPES,
  JOB_OPENING_STATUSES,
  OFFER_STATUSES,
  RECOMMENDATIONS,
  RECRUITING_ERROR_CODES,
  RECRUITING_LOCALES,
  RECRUITING_STAGES,
  REJECTION_REASON_CODES,
  SIGNATURE_STATUSES,
} from '@core';
import { hasSeededDictionaries, seededDictionaries } from '../../../../testing/seeded-dictionaries';

type Dict = Record<string, unknown>;

/** The dictionaries live in the API seeders (flat dotted keys); the specs are skipped without the API project. */
const load = (lang: string): Dict => (seededDictionaries as Record<string, Dict>)[lang] ?? {};

const resolve = (dict: Dict, key: string): unknown => dict[key];

const keysUnder = (dict: Dict, prefixes: string[]): string[] =>
  Object.keys(dict).filter((key) => prefixes.some((prefix) => key.startsWith(`${prefix}.`)));

const LANGS = ['en', 'it', 'de', 'fr'];

describe.skipIf(!hasSeededDictionaries)('recruiting & careers translations', () => {
  const en = load('en');
  const enKeys = keysUnder(en, ['hr.recruiting', 'careers']);

  it.each(LANGS)('%s has every recruiting/careers key as a non-empty string', (lang) => {
    const dict = load(lang);
    const missing = enKeys.filter((k) => {
      const value = resolve(dict, k);
      return typeof value !== 'string' || !value.trim();
    });
    expect(missing).toEqual([]);
    expect(dict['NAV.RECRUITING']).toBeTruthy();
  });

  it('covers every enum value rendered through a dynamic key', () => {
    const dynamic: [string, readonly string[]][] = [
      ['hr.recruiting.stages', RECRUITING_STAGES],
      ['hr.recruiting.openingStatus', JOB_OPENING_STATUSES],
      ['hr.recruiting.employmentTypes', EMPLOYMENT_TYPES],
      ['careers.employmentTypes', EMPLOYMENT_TYPES],
      ['hr.recruiting.contractTypes', CONTRACT_TYPES],
      ['hr.recruiting.locales', RECRUITING_LOCALES],
      ['careers.locales', RECRUITING_LOCALES],
      ['hr.recruiting.recommendations', RECOMMENDATIONS],
      ['hr.recruiting.offerStatus', OFFER_STATUSES],
      ['hr.recruiting.signatureStatus', SIGNATURE_STATUSES],
      ['hr.recruiting.cvParse', CV_PARSE_STATUSES],
      ['hr.recruiting.rejectionReasons', REJECTION_REASON_CODES],
      ['hr.recruiting.sources', APPLICATION_SOURCES],
      ['hr.recruiting.emailStatus', EMAIL_STATUSES],
      ['hr.recruiting.errors.codes', RECRUITING_ERROR_CODES],
    ];
    const missing = dynamic.flatMap(([prefix, values]) =>
      values.map((v) => `${prefix}.${v}`).filter((k) => typeof resolve(en, k) !== 'string'),
    );
    expect(missing).toEqual([]);
  });
});
