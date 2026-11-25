import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  EXM_ALLOWANCE_METHODS,
  EXM_AUDIT_ACTIONS,
  EXM_CALCULATION_SOURCES,
  EXM_CATEGORY_CODES,
  EXM_DESTINATION_TYPES,
  EXM_ERROR_CODES,
  EXM_FISCAL_NOTICES,
  EXM_PAYMENT_METHODS,
  EXM_PAYOUT_CHANNELS,
  EXM_RECONCILIATION_STATUSES,
  EXM_REPORT_STATUSES,
  EXM_SEVERITIES,
  EXM_VIOLATION_CODES,
} from '@core';
import {
  hasSeededDictionaries,
  SEEDED_LANGUAGES,
  seededDictionaries,
} from '../../../testing/seeded-dictionaries';

/** Prefixes the code completes with a value: derivedKeys() lists the full keys. */
const DYNAMIC_PREFIXES = [
  'expenseManagement.allowanceMethod',
  'expenseManagement.audit',
  'expenseManagement.calculationSource',
  'expenseManagement.category',
  'expenseManagement.channel',
  'expenseManagement.destinationType',
  'expenseManagement.error',
  'expenseManagement.fiscal',
  'expenseManagement.message',
  'expenseManagement.message.card',
  'expenseManagement.paymentMethod',
  'expenseManagement.reconciliationStatus',
  'expenseManagement.severity',
  'expenseManagement.status',
  'expenseManagement.violation',
];

/** Keys written in full in the sources of the feature (code and templates, not the specs). */
function literalKeys(): string[] {
  const keys = new Set<string>();

  for (const file of readdirSync(__dirname)) {
    if (!file.endsWith('.ts') || file.endsWith('.spec.ts') || file.endsWith('.testing.ts')) {
      continue;
    }
    const source = readFileSync(join(__dirname, file), 'utf8');
    for (const match of source.matchAll(/expenseManagement\.[A-Za-z0-9_.]*[A-Za-z0-9_]/g)) {
      keys.add(match[0]);
    }
    for (const match of source.matchAll(/(?:NAV|PAGE_TITLE)\.EXPENSE_MANAGEMENT[A-Z_]*/g)) {
      keys.add(match[0]);
    }
  }

  return [...keys].filter((key) => !DYNAMIC_PREFIXES.includes(key));
}

/** Keys the code builds from a value, the menu entries and the page titles of the routes. */
function derivedKeys(): string[] {
  const values = (group: string, list: readonly string[]) =>
    list.map((value) => `expenseManagement.${group}.${value}`);

  return [
    ...values('status', EXM_REPORT_STATUSES),
    ...values('paymentMethod', EXM_PAYMENT_METHODS),
    ...values('calculationSource', EXM_CALCULATION_SOURCES),
    ...values('destinationType', EXM_DESTINATION_TYPES),
    ...values('allowanceMethod', EXM_ALLOWANCE_METHODS),
    ...values('reconciliationStatus', EXM_RECONCILIATION_STATUSES),
    ...values('severity', EXM_SEVERITIES),
    ...values('channel', EXM_PAYOUT_CHANNELS),
    ...values('category', EXM_CATEGORY_CODES),
    ...values('violation', EXM_VIOLATION_CODES),
    ...values('fiscal', EXM_FISCAL_NOTICES),
    ...values('error', [...EXM_ERROR_CODES, 'generic']),
    ...values('audit', EXM_AUDIT_ACTIONS),
    ...values('message', [
      'saved',
      'submitted',
      'approved',
      'rejected',
      'payoutExported',
      'reimbursed',
      'cancelled',
      'lineRemoved',
      'perDiemRemoved',
      'reviewStarted',
    ]),
    ...values('message.card', ['matched', 'unmatched', 'ignore', 'dispute', 'imported']),
    'NAV.EXPENSE_MANAGEMENT',
    'NAV.EXPENSE_MANAGEMENT_REPORTS',
    'NAV.EXPENSE_MANAGEMENT_REPORT',
    'NAV.EXPENSE_MANAGEMENT_WORKBENCH',
    'NAV.EXPENSE_MANAGEMENT_CARDS',
    'NAV.EXPENSE_MANAGEMENT_VIOLATIONS',
    'PAGE_TITLE.EXPENSE_MANAGEMENT_REPORTS',
    'PAGE_TITLE.EXPENSE_MANAGEMENT_REPORT',
    'PAGE_TITLE.EXPENSE_MANAGEMENT_WORKBENCH',
    'PAGE_TITLE.EXPENSE_MANAGEMENT_CARDS',
    'PAGE_TITLE.EXPENSE_MANAGEMENT_VIOLATIONS',
  ];
}

describe('expense management translations', () => {
  it('finds the keys of the feature', () => {
    expect(literalKeys()).toContain('expenseManagement.field.paidInCash');
    expect(literalKeys()).toContain('PAGE_TITLE.EXPENSE_MANAGEMENT_WORKBENCH');
    expect(literalKeys().length).toBeGreaterThan(80);
  });

  it('never falls back to a text written in the sources', () => {
    for (const file of readdirSync(__dirname)) {
      if (!file.endsWith('.ts') || file.endsWith('.spec.ts') || file.endsWith('.testing.ts')) {
        continue;
      }
      expect(readFileSync(join(__dirname, file), 'utf8'), file).not.toMatch(/translateOr\(/);
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
});
