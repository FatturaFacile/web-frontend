import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  GC_BILLING_MODES,
  GC_BILLING_STATUSES,
  GC_CONTRACT_STATUSES,
  GC_DOSAGE_UNITS,
  GC_EQUIPMENT_TYPES,
  GC_ERROR_CODES,
  GC_INSTALLMENT_FREQUENCIES,
  GC_INVOICE_LINE_KINDS,
  GC_KPIS,
  GC_LICENSE_TYPES,
  GC_ROUTE_STATUSES,
  GC_SERVICES,
  GC_WEATHER_ALERTS,
} from '@core';
import { hasSeededDictionaries, SEEDED_LANGUAGES, seededDictionaries } from '../../../testing/seeded-dictionaries';
import { dosageUnitKey } from './green-care.util';

/** Sources that carry keys of the feature: its own files and the menu. */
function sourceFiles(): string[] {
  const own = readdirSync(__dirname)
    .filter((file) => file.endsWith('.ts') && !file.endsWith('.spec.ts'))
    .map((file) => join(__dirname, file));

  return [...own, join(__dirname, '../../layout/sidebar/menu-sections.ts')];
}

/** Keys written in full in the sources (a key that is the start of a family is completed by a value at runtime). */
function literalKeys(): string[] {
  const keys = new Set<string>();

  for (const file of sourceFiles()) {
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(/greenCare\.[A-Za-z0-9_.]*[A-Za-z0-9_]/g)) {
      keys.add(match[0]);
    }
    for (const match of source.matchAll(/(?:NAV|PAGE_TITLE)\.GREEN_CARE[A-Z_]*/g)) {
      keys.add(match[0]);
    }
  }

  return [...keys];
}

/** Keys the code builds from a value. */
function derivedKeys(): string[] {
  const values = (group: string, list: readonly string[]) => list.map((value) => `greenCare.${group}.${value}`);

  return [
    ...values('enum.billingMode', GC_BILLING_MODES),
    ...values('enum.installmentFrequency', GC_INSTALLMENT_FREQUENCIES),
    ...values('enum.contractStatus', GC_CONTRACT_STATUSES),
    ...values('enum.weatherAlert', GC_WEATHER_ALERTS),
    ...values('enum.routeStatus', GC_ROUTE_STATUSES),
    ...values('enum.billingStatus', GC_BILLING_STATUSES),
    ...values('enum.licenseType', GC_LICENSE_TYPES),
    ...values('enum.dosageUnit', GC_DOSAGE_UNITS.map(dosageUnitKey)),
    ...values('enum.equipment', GC_EQUIPMENT_TYPES),
    ...values('enum.service', GC_SERVICES),
    ...values('enum.invoiceLine', GC_INVOICE_LINE_KINDS),
    ...values('error', [...GC_ERROR_CODES, 'unknown']),
    ...values('unassignedReason', ['no_coordinates', 'no_capacity', 'no_equipped_crew']),
    ...values('licenseState', ['valid', 'expiring', 'expired']),
    ...values('kpi', GC_KPIS),
    'NAV.GREEN_CARE',
    'NAV.GREEN_CARE_DASHBOARD',
    'NAV.GREEN_CARE_SITES',
    'NAV.GREEN_CARE_CONTRACTS',
    'NAV.GREEN_CARE_PLANNER',
    'NAV.GREEN_CARE_CREWS',
    'NAV.GREEN_CARE_TREATMENTS',
    'NAV.GREEN_CARE_WASTE',
    'PAGE_TITLE.GREEN_CARE_DASHBOARD',
    'PAGE_TITLE.GREEN_CARE_SITES',
    'PAGE_TITLE.GREEN_CARE_CONTRACTS',
    'PAGE_TITLE.GREEN_CARE_PLANNER',
    'PAGE_TITLE.GREEN_CARE_CREWS',
    'PAGE_TITLE.GREEN_CARE_TREATMENTS',
    'PAGE_TITLE.GREEN_CARE_WASTE',
  ];
}

describe('green care translations', () => {
  it('finds the keys of the feature', () => {
    expect(literalKeys().length).toBeGreaterThan(100);
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

  it('keeps every enum value of the model free of slashes in its translation key', () => {
    for (const unit of GC_DOSAGE_UNITS) {
      expect(dosageUnitKey(unit)).not.toContain('/');
    }
  });

  for (const language of SEEDED_LANGUAGES) {
    it.skipIf(!hasSeededDictionaries)(`has every key in the seeded ${language} dictionary`, () => {
      const dictionary = seededDictionaries[language] ?? {};
      const families = Object.keys(dictionary);
      // A literal that only starts a family (`greenCare.error` + code) is completed at runtime.
      const complete = literalKeys().filter((key) => !families.some((candidate) => candidate.startsWith(`${key}.`)));
      const missing = [...complete, ...derivedKeys()].filter((key) => !(key in dictionary) || dictionary[key].trim() === '');

      expect(missing).toEqual([]);
    });
  }
});
