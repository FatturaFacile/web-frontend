import * as fs from 'node:fs';
import * as path from 'node:path';
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

type Dict = Record<string, unknown>;

const load = (lang: string): Dict =>
  JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), `public/assets/i18n/${lang}.json`), 'utf8'),
  ) as Dict;

function leafKeys(node: unknown, prefix = ''): string[] {
  if (typeof node !== 'object' || node === null) {
    return [prefix];
  }
  return Object.entries(node as Dict).flatMap(([k, v]) =>
    leafKeys(v, prefix ? `${prefix}.${k}` : k),
  );
}

function resolve(dict: Dict, key: string): unknown {
  return key.split('.').reduce<unknown>((node, part) => (node as Dict | undefined)?.[part], dict);
}

const LANGS = ['en', 'it', 'de', 'fr'];

describe('recruiting & careers translations', () => {
  const en = load('en');
  const enKeys = [
    ...leafKeys(resolve(en, 'hr.recruiting'), 'hr.recruiting'),
    ...leafKeys(resolve(en, 'careers'), 'careers'),
  ];

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
