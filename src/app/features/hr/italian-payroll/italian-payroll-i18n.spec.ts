import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CONSULTANT_FORMATS } from '@core';
import { hasSeededDictionaries, seededDictionaries } from '../../../../testing/seeded-dictionaries';
import { AMOUNT_FIELDS, CheckId, NetsParseError } from './accounting-reconciliation.util';
import { CLOSING_STEPS } from './closing-workflow.util';

type Dict = Record<string, unknown>;

const LANGS = ['it', 'en', 'de', 'fr'] as const;
const load = (lang: string): Dict => (seededDictionaries as Record<string, Dict>)[lang] ?? {};
const text = (lang: string, key: string): string | null => {
  const value = load(lang)[key];

  return typeof value === 'string' && value.trim() !== '' ? value : null;
};

const FOLDER = join(process.cwd(), 'src/app/features/hr/italian-payroll');

/** Every literal `itPayroll.…` key in the sources of the folder; a prefix that ends with a dot is built at run time. */
function staticKeys(): string[] {
  const keys = new Set<string>();

  for (const file of readdirSync(FOLDER).filter(
    (name) => name.endsWith('.ts') && !name.endsWith('.spec.ts'),
  )) {
    for (const match of readFileSync(join(FOLDER, file), 'utf8').matchAll(
      /'(itPayroll\.[A-Za-z0-9_.]+)'/g,
    )) {
      if (!match[1].endsWith('.')) {
        keys.add(match[1]);
      }
    }
  }

  return [...keys].sort();
}

const CHECKS: CheckId[] = ['net', 'tfr', 'employee_nets', 'journal', 'tfr_formula'];
const NETS_ERRORS: NetsParseError['reason'][] = ['format', 'employee', 'amount', 'duplicate'];
const STATUSES = ['attendance_open', 'validated', 'exported_to_cdl', 'cedolini_imported', 'paid'];
const F24_SECTIONS = ['erario', 'regioni', 'enti_locali'];

const placeholders = (value: string): string[] =>
  [...value.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe.skipIf(!hasSeededDictionaries)('Italian payroll closing translations', () => {
  const dynamic = [
    ...CLOSING_STEPS.map((id) => `itPayroll.step.${id}`),
    ...STATUSES.map((status) => `itPayroll.status.${status}`),
    ...CONSULTANT_FORMATS.map((format) => `itPayroll.format.${format}`),
    ...AMOUNT_FIELDS.map((field) => `itPayroll.field.${field.key}`),
    ...CHECKS.map((id) => `itPayroll.check.${id}`),
    ...NETS_ERRORS.map((reason) => `itPayroll.reconciler.netsError.${reason}`),
    ...F24_SECTIONS.map((section) => `itPayroll.f24.sections.${section}`),
  ];

  it('finds the keys of the components, so that this spec cannot pass on an empty list', () => {
    expect(staticKeys().length).toBeGreaterThan(50);
  });

  it.each(LANGS)('%s has every literal and every enum-driven key as a non-empty string', (lang) => {
    const missing = [...staticKeys(), ...dynamic].filter((key) => text(lang, key) === null);

    expect(missing).toEqual([]);
    expect(text(lang, 'NAV.HR_ITALIAN_PAYROLL')).not.toBeNull();
  });

  it('keeps the same {placeholders} in the four languages', () => {
    const mismatched = [...staticKeys(), ...dynamic].filter((key) => {
      const reference = placeholders(text('en', key) ?? '');

      return LANGS.some((lang) => placeholders(text(lang, key) ?? '').join() !== reference.join());
    });

    expect(mismatched).toEqual([]);
  });
});
