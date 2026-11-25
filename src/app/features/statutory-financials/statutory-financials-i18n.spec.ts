import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  SF_ARTIFACT_KINDS,
  SF_CASH_FLOW_METHODS,
  SF_ERROR_CODES,
  SF_INCOME_STATEMENT_METHODS,
  SF_ISSUE_CATEGORIES,
  SF_NOTES_TABLES,
  SF_PDFA_KINDS,
  SF_ROUNDING_MODES,
  SF_STANDARDS,
  SF_STATUSES,
  SF_VALIDATION_STATUSES,
  SF_WHAT_IF_PARAMETERS,
} from '@core';
import {
  hasSeededDictionaries,
  SEEDED_LANGUAGES,
  seededDictionaries,
} from '../../../testing/seeded-dictionaries';
import { WORKSPACE_TABS } from './statutory-financials.routes';
import {
  MATURITY_BUCKETS,
  MATURITY_GROUPS,
  NOTES_TABLE_COLUMNS,
} from './statutory-financials.util';

/** Bare prefixes the code completes with a value (an enum value, an API code): derivedKeys() lists the full keys. */
const DYNAMIC_PREFIXES = [
  'statutoryFinancials.action',
  'statutoryFinancials.artifactKind',
  'statutoryFinancials.cashFlowMethod',
  'statutoryFinancials.check',
  'statutoryFinancials.confirm',
  'statutoryFinancials.eligibility.criterion',
  'statutoryFinancials.error',
  'statutoryFinancials.incomeMethod',
  'statutoryFinancials.indicators.alertLevel',
  'statutoryFinancials.indicators.direction',
  'statutoryFinancials.indicators.status',
  'statutoryFinancials.issueCategory',
  'statutoryFinancials.message',
  'statutoryFinancials.minutes.problem',
  'statutoryFinancials.minutes.step',
  'statutoryFinancials.notes.col',
  'statutoryFinancials.notes.maturity',
  'statutoryFinancials.notes.table',
  'statutoryFinancials.notes.value',
  'statutoryFinancials.pdfaKind',
  'statutoryFinancials.problem',
  'statutoryFinancials.roundingMode',
  'statutoryFinancials.standard',
  'statutoryFinancials.statement',
  'statutoryFinancials.status',
  'statutoryFinancials.tab',
  'statutoryFinancials.validation',
  'statutoryFinancials.whatIf',
  'statutoryFinancials.wizard.step',
];

const FEATURE_DIR = __dirname;
const SOURCES = [
  ...readdirSync(FEATURE_DIR)
    .filter((file) => file.endsWith('.ts') && !file.endsWith('.spec.ts'))
    .map((file) => join(FEATURE_DIR, file)),
  join(FEATURE_DIR, '..', '..', 'layout', 'sidebar', 'menu-sections.ts'),
  join(FEATURE_DIR, '..', '..', 'app.routes.ts'),
];

/** Keys written in full in the sources of the feature (code and templates, not the specs). */
function literalKeys(): string[] {
  const keys = new Set<string>();
  for (const file of SOURCES) {
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(/statutoryFinancials\.[A-Za-z0-9_.]*[A-Za-z0-9_]/g)) {
      keys.add(match[0]);
    }
  }
  return [...keys].filter((key) => !DYNAMIC_PREFIXES.includes(key));
}

const NOTES_COLUMN_FIELDS = [
  ...new Set([
    ...Object.values(NOTES_TABLE_COLUMNS).flatMap((columns) => (columns ?? []).map((c) => c.field)),
    ...MATURITY_BUCKETS,
    'group',
  ]),
];

/** Keys the code builds from a value. */
function derivedKeys(): string[] {
  const values = (group: string, list: readonly (string | number)[]) =>
    list.map((value) => `statutoryFinancials.${group}.${value}`);

  return [
    ...values('status', SF_STATUSES),
    ...values('standard', SF_STANDARDS),
    ...values('roundingMode', SF_ROUNDING_MODES),
    ...values('incomeMethod', SF_INCOME_STATEMENT_METHODS),
    ...values('cashFlowMethod', SF_CASH_FLOW_METHODS),
    ...values('validation', SF_VALIDATION_STATUSES),
    ...values('validation', ['valid', 'warnings', 'invalid']),
    ...values('issueCategory', SF_ISSUE_CATEGORIES),
    ...values('pdfaKind', SF_PDFA_KINDS),
    ...values('artifactKind', SF_ARTIFACT_KINDS),
    ...values('error', SF_ERROR_CODES),
    ...values('tab', WORKSPACE_TABS),
    ...values('whatIf', SF_WHAT_IF_PARAMETERS),
    ...values('notes.table', SF_NOTES_TABLES),
    ...values('notes.col', NOTES_COLUMN_FIELDS),
    ...values('notes.maturity', MATURITY_GROUPS),
    ...values('notes.value', ['directors', 'auditors', 'current', 'deferred']),
    ...values('indicators.status', ['ok', 'warning', 'critical', 'n/a']),
    ...values('indicators.alertLevel', ['ok', 'warning', 'critical']),
    ...values('indicators.direction', ['min', 'max']),
    ...values('eligibility.criterion', ['assets', 'revenue', 'employees']),
    ...values('problem', [
      'fiscal_year_required',
      'comparative_same',
      'standard_required',
      'cogs_allocation_invalid',
      'hidden_item_invalid',
    ]),
    ...values('minutes.problem', ['kind_required', 'date_required']),
    ...values('minutes.step', ['kind', 'meeting', 'review']),
    ...values('wizard.step', ['years', 'standard', 'eligibility', 'options']),
    ...values('confirm', ['delete', 'lock', 'reopen']),
    ...values('action', ['lock', 'reopen', 'file']),
    ...values('message', [
      'saved',
      'deleted',
      'generated',
      'cashFlowGenerated',
      'populated',
      'indicatorsSaved',
      'exported',
      'pdfaGenerated',
      'verified',
      'transitioned',
    ]),
    ...values('statement', [
      'balance_sheet',
      'income_statement',
      'cash_flow',
      'current',
      'comparative',
      'asset_side',
      'liability_side',
      'notes',
      'management_report',
    ]),
  ];
}

describe('statutory financials translations', () => {
  it('finds the keys of the feature', () => {
    expect(literalKeys()).toContain('statutoryFinancials.title');
    expect(literalKeys()).toContain('statutoryFinancials.nav.title');
    expect(literalKeys()).toContain('statutoryFinancials.action.exportXbrl');
    expect(literalKeys().length).toBeGreaterThan(150);
  });

  it('never carries domain prose or a fallback text in the sources', () => {
    for (const file of SOURCES) {
      expect(readFileSync(file, 'utf8'), file).not.toMatch(/translateOr\(/);
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
