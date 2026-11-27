import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FVR_COUNTRIES } from '@core';
import {
  hasSeededDictionaries,
  SEEDED_LANGUAGES,
  seededDictionaries,
} from '../../../testing/seeded-dictionaries';

const CLAIM_STATUSES = [
  'DRAFT',
  'READY_TO_SUBMIT',
  'SUBMITTED',
  'ADDITIONAL_INFO_REQUESTED',
  'PARTIALLY_APPROVED',
  'APPROVED',
  'REFUNDED',
  'REJECTED',
];
const LEDGER_STATUSES = [
  'PENDING_REVIEW',
  'ELIGIBLE_ACCUMULATING',
  'INCLUDED_IN_CLAIM',
  'REFUNDED',
  'PARTIALLY_REJECTED',
  'NON_RECOVERABLE_EXPENSED',
];
const REGIMES = ['EU_DIR_2008_9_CE', 'CH_ESTV_RECIPROCITY', 'IT_ART_38_TER', 'XIII_DIR_86_560_CEE'];
const MANDATE_STATUSES = [
  'NOT_REQUIRED',
  'MISSING',
  'CERTIFICATE_MISSING',
  'CERTIFICATE_EXPIRED',
  'CERTIFICATE_EXPIRING',
  'VALID',
];

/** Sources that carry keys of the feature: its own files and the screens it is plugged into. */
function sourceFiles(): string[] {
  const own = readdirSync(__dirname)
    .filter((file) => file.endsWith('.ts') && !file.endsWith('.spec.ts'))
    .map((file) => join(__dirname, file));
  const screens = [
    '../expense-management/line-form.component.ts',
    '../purchases/invoice-detail/supplier-invoice-detail-page.component.ts',
  ].map((file) => join(__dirname, file));

  return [...own, ...screens];
}

/** Keys written in full in the sources (a key that is the start of a family is completed by a value at runtime). */
function literalKeys(): string[] {
  const keys = new Set<string>();

  for (const file of sourceFiles()) {
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(/foreignVat\.[A-Za-z0-9_.]*[A-Za-z0-9_]/g)) {
      keys.add(match[0]);
    }
    for (const match of source.matchAll(/(?:NAV|PAGE_TITLE)\.FOREIGN_VAT[A-Z_]*/g)) {
      keys.add(match[0]);
    }
  }

  return [...keys];
}

/** Keys the code builds from a value. */
function derivedKeys(): string[] {
  const values = (group: string, list: readonly string[]) =>
    list.map((value) => `foreignVat.${group}.${value}`);

  return [
    ...values('claimStatus', CLAIM_STATUSES),
    ...values('ledgerStatus', LEDGER_STATUSES),
    ...values('regime', REGIMES),
    ...values('mandateStatus', MANDATE_STATUSES),
    ...values('country', FVR_COUNTRIES),
    ...values('category', ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']),
    ...values('alert', ['60', '30', '15', 'EXPIRED']),
    ...values('periodType', ['ANNUAL', 'QUARTERLY']),
    ...values('eligibility', ['THRESHOLD_MET', 'BELOW_THRESHOLD']),
    ...values('source', ['PASSIVE_INVOICE', 'EXPENSE_REPORT', 'MANUAL']),
    ...values('vatBookedOn', ['input_vat', 'expense']),
    'NAV.FOREIGN_VAT_REFUND',
    'NAV.FOREIGN_VAT_DASHBOARD',
    'NAV.FOREIGN_VAT_LEDGER',
    'NAV.FOREIGN_VAT_CLAIMS',
    'NAV.FOREIGN_VAT_CONFIG',
    'PAGE_TITLE.FOREIGN_VAT_DASHBOARD',
    'PAGE_TITLE.FOREIGN_VAT_LEDGER',
    'PAGE_TITLE.FOREIGN_VAT_CLAIMS',
    'PAGE_TITLE.FOREIGN_VAT_CONFIG',
  ];
}

describe('foreign VAT refund translations', () => {
  it('finds the keys of the feature', () => {
    expect(literalKeys().length).toBeGreaterThan(30);
    expect(new Set(derivedKeys()).size).toBe(derivedKeys().length);
  });

  it('adds no string to the frontend: the sources of the feature carry no dictionary', () => {
    for (const file of readdirSync(__dirname)) {
      if (!file.endsWith('.ts') || file.endsWith('.spec.ts')) {
        continue;
      }
      const source = readFileSync(join(__dirname, file), 'utf8');

      expect(source, file).not.toMatch(/translations?\s*[:=]\s*\{\s*['"]?(it|en|de|fr)['"]?\s*:/);
    }
  });

  for (const language of SEEDED_LANGUAGES) {
    it.skipIf(!hasSeededDictionaries)(`has every key in the seeded ${language} dictionary`, () => {
      const dictionary = seededDictionaries[language] ?? {};
      const families = Object.keys(dictionary);
      // A literal that only starts a family (`foreignVat.error` + code) is completed at runtime.
      const complete = literalKeys().filter(
        (key) => !families.some((candidate) => candidate.startsWith(`${key}.`)),
      );
      const missing = [...complete, ...derivedKeys()].filter(
        (key) => !(key in dictionary) || dictionary[key].trim() === '',
      );

      expect(missing).toEqual([]);
    });
  }
});
