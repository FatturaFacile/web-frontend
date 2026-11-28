import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  hasSeededDictionaries,
  SEEDED_LANGUAGES,
  seededDictionaries,
} from '../../../testing/seeded-dictionaries';
import {
  CRISIS_APPROACHES,
  CRISIS_BASES,
  CRISIS_CREDITOR_TYPES,
  CRISIS_HORIZONS,
  CRISIS_INTEREST_TREATMENTS,
  CRISIS_JURISDICTIONS,
  CRISIS_LEGAL_FORMS,
  CRISIS_LOAN_SCOPES,
  CRISIS_LOAN_STATUSES,
  CRISIS_LOCALES,
  CRISIS_STATUSES,
  PROFILE_ARREARS_FIELDS,
  PROFILE_MONEY_FIELDS,
  PROFILE_OVERRIDE_FIELDS,
  STRESS_SPECS,
} from './crisis-monitoring.util';

/** Prefixes the code completes with a value: derivedKeys() lists the full keys. */
const DYNAMIC_PREFIXES = [
  'crisis.status',
  'crisis.overall',
  'crisis.jurisdiction',
  'crisis.locale',
  'crisis.basis',
  'crisis.dscr.horizon',
  'crisis.dscr.approach',
  'crisis.loans.creditorType',
  'crisis.loans.scope',
  'crisis.loans.status',
  'crisis.loans.treatment',
  'crisis.legalForm',
  'crisis.profile',
  'crisis.stress.lever',
  'crisis.stress.unit',
];

/** Sources of the workspace, not the specs and not the fixtures (which carry API-owned sample keys). */
function sources(): string[] {
  return readdirSync(__dirname).filter(
    (file) => file.endsWith('.ts') && !file.endsWith('.spec.ts') && !file.endsWith('.fixtures.ts'),
  );
}

function literalKeys(): string[] {
  const keys = new Set<string>();

  for (const file of sources()) {
    for (const match of readFileSync(join(__dirname, file), 'utf8').matchAll(
      /\bcrisis\.[A-Za-z0-9_.]*[A-Za-z0-9_]/g,
    )) {
      keys.add(match[0]);
    }
  }

  return [...keys].filter((key) => !DYNAMIC_PREFIXES.includes(key));
}

function derivedKeys(): string[] {
  const values = (prefix: string, list: readonly string[]) =>
    list.map((value) => `${prefix}.${value}`);

  return [
    ...values('crisis.status', CRISIS_STATUSES),
    ...values('crisis.overall', CRISIS_STATUSES),
    ...values('crisis.jurisdiction', CRISIS_JURISDICTIONS),
    ...values('crisis.locale', CRISIS_LOCALES),
    ...values('crisis.basis', CRISIS_BASES),
    ...values('crisis.dscr.horizon', CRISIS_HORIZONS),
    ...values('crisis.dscr.approach', CRISIS_APPROACHES),
    ...values('crisis.loans.creditorType', CRISIS_CREDITOR_TYPES),
    ...values('crisis.loans.scope', CRISIS_LOAN_SCOPES),
    ...values('crisis.loans.status', CRISIS_LOAN_STATUSES),
    ...values('crisis.loans.treatment', CRISIS_INTEREST_TREATMENTS),
    ...values('crisis.legalForm', CRISIS_LEGAL_FORMS),
    ...values('crisis.profile', [
      ...PROFILE_MONEY_FIELDS,
      ...PROFILE_ARREARS_FIELDS,
      ...PROFILE_OVERRIDE_FIELDS,
    ]),
    ...values(
      'crisis.stress.lever',
      STRESS_SPECS.map((spec) => spec.key),
    ),
    ...values('crisis.stress.unit', ['percent', 'days', 'bps', 'amount']),
    'NAV.CRISIS_MONITORING',
    'PAGE_TITLE.CRISIS_MONITORING',
  ];
}

describe('crisis monitoring translations', () => {
  it('finds the keys of the workspace', () => {
    expect(literalKeys()).toContain('crisis.title');
    expect(literalKeys()).toContain('crisis.calc.requiredClaim');
    expect(literalKeys().length).toBeGreaterThan(80);
  });

  it('never writes a text, or a fallback, in the sources', () => {
    for (const file of sources()) {
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
