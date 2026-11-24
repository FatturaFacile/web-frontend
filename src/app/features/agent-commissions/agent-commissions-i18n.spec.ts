import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  AGC_ACCRUAL_BASES,
  AGC_AGENT_TYPES,
  AGC_ENASARCO_MANDATES,
  AGC_ENTRY_ROLES,
  AGC_ENTRY_STATUSES,
  AGC_FISCAL_CODES,
  AGC_FISCAL_REGIMES,
  AGC_MOVEMENT_KINDS,
  AGC_PERIOD_TYPES,
  AGC_RATE_TYPES,
  AGC_SETTLEMENT_CHANNELS,
  AGC_SPLIT_MODES,
  AGC_STATEMENT_STATUSES,
} from '@core';
import {
  hasSeededDictionaries,
  SEEDED_LANGUAGES,
  seededDictionaries,
} from '../../../testing/seeded-dictionaries';

/** Prefixes the code completes with a value (an enum value, a fiscal code, an API code): derivedKeys() lists the full keys. */
const DYNAMIC_PREFIXES = [
  'agentCommissions.accrualBasis',
  'agentCommissions.agentType',
  'agentCommissions.enasarcoMandate',
  'agentCommissions.entryStatus',
  'agentCommissions.error',
  'agentCommissions.fiscal',
  'agentCommissions.fiscalRegime',
  'agentCommissions.movement',
  'agentCommissions.periodType',
  'agentCommissions.rateType',
  'agentCommissions.role',
  'agentCommissions.settlementChannel',
  'agentCommissions.splitMode',
  'agentCommissions.statementStatus',
];

/** Codes of the contract the UI translates (the problem `code` of AgentCommissionException). */
const ERROR_CODES = [
  'nothing_to_settle',
  'invalid_period',
  'period_spans_years',
  'period_overlap',
  'payout_blocked',
  'only_draft_can_be_approved',
  'cannot_void',
  'only_approved_can_be_invoiced',
  'only_approved_can_be_paid',
  'settled_on_salary',
  'no_recipient',
  'invalid_tiers',
  'invalid_parent',
  'rate_required',
  'generic',
];

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
    for (const match of source.matchAll(/agentCommissions\.[A-Za-z0-9_.]*[A-Za-z0-9_]/g)) {
      keys.add(match[0]);
    }
    for (const match of source.matchAll(/(?:NAV|PAGE_TITLE)\.AGENT_COMMISSIONS[A-Z_]*/g)) {
      keys.add(match[0]);
    }
  }

  return [...keys].filter((key) => !DYNAMIC_PREFIXES.includes(key));
}

/** Keys the code builds from a value, the menu entries and the page titles of the routes. */
function derivedKeys(): string[] {
  const values = (group: string, list: readonly string[]) =>
    list.map((value) => `agentCommissions.${group}.${value}`);

  return [
    ...values('agentType', AGC_AGENT_TYPES),
    ...values('fiscalRegime', AGC_FISCAL_REGIMES),
    ...values('enasarcoMandate', AGC_ENASARCO_MANDATES),
    ...values('accrualBasis', AGC_ACCRUAL_BASES),
    ...values('rateType', AGC_RATE_TYPES),
    ...values('splitMode', AGC_SPLIT_MODES),
    ...values('settlementChannel', AGC_SETTLEMENT_CHANNELS),
    ...values('periodType', AGC_PERIOD_TYPES),
    ...values('statementStatus', AGC_STATEMENT_STATUSES),
    ...values('entryStatus', AGC_ENTRY_STATUSES),
    ...values('role', AGC_ENTRY_ROLES),
    ...values('movement', AGC_MOVEMENT_KINDS),
    ...values('fiscal', AGC_FISCAL_CODES),
    ...values('error', ERROR_CODES),
    'NAV.AGENT_COMMISSIONS',
    'NAV.AGENT_COMMISSIONS_AGENTS',
    'NAV.AGENT_COMMISSIONS_RULES',
    'NAV.AGENT_COMMISSIONS_LEDGER',
    'NAV.AGENT_COMMISSIONS_ENASARCO',
    'NAV.AGENT_COMMISSIONS_STATEMENTS',
    'NAV.AGENT_COMMISSIONS_EXPORTS',
    'NAV.AGENT_COMMISSIONS_SETTINGS',
    'PAGE_TITLE.AGENT_COMMISSIONS_AGENTS',
    'PAGE_TITLE.AGENT_COMMISSIONS_RULES',
    'PAGE_TITLE.AGENT_COMMISSIONS_LEDGER',
    'PAGE_TITLE.AGENT_COMMISSIONS_ENASARCO',
    'PAGE_TITLE.AGENT_COMMISSIONS_STATEMENTS',
    'PAGE_TITLE.AGENT_COMMISSIONS_EXPORTS',
    'PAGE_TITLE.AGENT_COMMISSIONS_SETTINGS',
  ];
}

describe('agent commissions translations', () => {
  it('finds the keys of the feature', () => {
    expect(literalKeys()).toContain('agentCommissions.field.agentType');
    expect(literalKeys()).toContain('agentCommissions.statements.massimaleReached');
    expect(literalKeys()).toContain('PAGE_TITLE.AGENT_COMMISSIONS_LEDGER');
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
