import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  WR_ACTIVITY_TYPES,
  WR_ALERT_CODES,
  WR_CERT_STATUSES,
  WR_CU_CAUSALS,
  WR_ENASARCO_MANDATES,
  WR_ERROR_CODES,
  WR_INL_FORMATS,
  WR_INL_STATUSES,
  WR_JURISDICTIONS,
  WR_NOTE_CODES,
  WR_REGIMES,
  WR_THRESHOLD_KEYS,
  WR_WARNING_CODES,
} from '@core';
import {
  hasSeededDictionaries,
  SEEDED_LANGUAGES,
  seededDictionaries,
} from '../../../testing/seeded-dictionaries';

/** Prefixes the code completes with a value (an enum value, an API code): derivedKeys() lists the full keys. */
const DYNAMIC_PREFIXES = [
  'withholdingRecipients.activityType',
  'withholdingRecipients.alert',
  'withholdingRecipients.annual.returnType',
  'withholdingRecipients.causal',
  'withholdingRecipients.certStatus',
  'withholdingRecipients.enasarcoMandate',
  'withholdingRecipients.error',
  'withholdingRecipients.f24.code',
  'withholdingRecipients.f24.section',
  'withholdingRecipients.inl.format',
  'withholdingRecipients.inlStatus',
  'withholdingRecipients.jurisdiction',
  'withholdingRecipients.note',
  'withholdingRecipients.regime',
  'withholdingRecipients.settlementStatus',
  'withholdingRecipients.threshold',
  'withholdingRecipients.warning',
];

/** Extra codes of the contract the UI translates that are not enumerated in the wire types. */
const EXTRA_ERROR_CODES = ['generic'];
const F24_SECTIONS = ['erario', 'inps'];
const F24_CODES = ['1040', '1038', 'C10'];
const RETURN_TYPES = ['CU', 'AVS_QST'];
const SETTLEMENT_STATUSES = ['posted'];

/** Keys written in full in the sources of the feature (code and templates, not the specs). */
function literalKeys(): string[] {
  const keys = new Set<string>();

  for (const file of readdirSync(__dirname)) {
    if (
      (!file.endsWith('.ts') && !file.endsWith('.html')) ||
      file.endsWith('.spec.ts') ||
      file.endsWith('.testing.ts')
    ) {
      continue;
    }
    const source = readFileSync(join(__dirname, file), 'utf8');
    for (const match of source.matchAll(/withholdingRecipients\.[A-Za-z0-9_.]*[A-Za-z0-9_]/g)) {
      keys.add(match[0]);
    }
    for (const match of source.matchAll(/(?:NAV|PAGE_TITLE)\.WITHHOLDING_RECIPIENTS[A-Z_]*/g)) {
      keys.add(match[0]);
    }
  }

  return [...keys].filter((key) => !DYNAMIC_PREFIXES.includes(key));
}

/** Keys the code builds from a value, the menu entries and the page titles of the routes. */
function derivedKeys(): string[] {
  const values = (group: string, list: readonly string[]) =>
    list.map((value) => `withholdingRecipients.${group}.${value}`);

  return [
    ...values('regime', WR_REGIMES),
    ...values('jurisdiction', WR_JURISDICTIONS),
    ...values('activityType', WR_ACTIVITY_TYPES),
    ...values('enasarcoMandate', WR_ENASARCO_MANDATES),
    ...values('causal', WR_CU_CAUSALS),
    ...values('certStatus', WR_CERT_STATUSES),
    ...values('inlStatus', WR_INL_STATUSES),
    ...values('alert', WR_ALERT_CODES),
    ...values('warning', WR_WARNING_CODES),
    ...values('note', WR_NOTE_CODES),
    ...values('threshold', WR_THRESHOLD_KEYS),
    ...values('error', [...WR_ERROR_CODES, ...EXTRA_ERROR_CODES]),
    ...values('inl.format', WR_INL_FORMATS),
    ...values('f24.section', F24_SECTIONS),
    ...values('f24.code', F24_CODES),
    ...values('annual.returnType', RETURN_TYPES),
    ...values('settlementStatus', SETTLEMENT_STATUSES),
    'NAV.WITHHOLDING_RECIPIENTS',
    'NAV.WITHHOLDING_RECIPIENTS_DASHBOARD',
    'NAV.WITHHOLDING_RECIPIENTS_SIMULATOR',
    'NAV.WITHHOLDING_RECIPIENTS_SETTLEMENTS',
    'PAGE_TITLE.WITHHOLDING_RECIPIENTS_DASHBOARD',
    'PAGE_TITLE.WITHHOLDING_RECIPIENTS_SIMULATOR',
    'PAGE_TITLE.WITHHOLDING_RECIPIENTS_SETTLEMENTS',
  ];
}

describe('withholding recipients translations', () => {
  it('finds the keys of the feature', () => {
    expect(literalKeys()).toContain('withholdingRecipients.field.regime');
    expect(literalKeys()).toContain('withholdingRecipients.result.netPayable');
    expect(literalKeys()).toContain('PAGE_TITLE.WITHHOLDING_RECIPIENTS_SETTLEMENTS');
    expect(literalKeys().length).toBeGreaterThan(80);
  });

  it('never falls back to a text written in the sources', () => {
    for (const file of readdirSync(__dirname)) {
      if (!file.endsWith('.ts') || file.endsWith('.spec.ts') || file.endsWith('.testing.ts')) {
        continue;
      }
      const source = readFileSync(join(__dirname, file), 'utf8');
      expect(source, file).not.toMatch(/translateOr\(/);
    }
  });

  it.skipIf(!hasSeededDictionaries)(
    'has every key in it, en, de and fr with a non-empty text',
    () => {
      const keys = [...new Set([...literalKeys(), ...derivedKeys()])];

      for (const language of SEEDED_LANGUAGES) {
        const dictionary = seededDictionaries[language] ?? {};
        const missing = keys.filter((key) => (dictionary[key] ?? '').trim() === '');

        expect(missing, `${language} is missing: ${missing.join(', ')}`).toEqual([]);
      }
    },
  );

  it.skipIf(!hasSeededDictionaries)('uses the same placeholders in every language', () => {
    const placeholders = (text: string): string =>
      [...text.matchAll(/\{(\w+)\}/g)]
        .map((match) => match[1])
        .sort()
        .join(',');

    for (const key of [...new Set([...literalKeys(), ...derivedKeys()])]) {
      const variants = new Set(
        SEEDED_LANGUAGES.map((language) => placeholders(seededDictionaries[language]?.[key] ?? '')),
      );

      expect(variants.size, `${key} has different placeholders per language`).toBe(1);
    }
  });
});
