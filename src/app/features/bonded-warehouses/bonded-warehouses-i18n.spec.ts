import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  BW_AEO_STATUSES,
  BW_ALLOCATION_METHODS,
  BW_AUDIT_TYPES,
  BW_CGU_DIRECTIONS,
  BW_CUSTOMS_STATUSES,
  BW_DECLARATION_TYPES,
  BW_DISCHARGE_TYPES,
  BW_DISCREPANCY_STATUSES,
  BW_ERROR_CODES,
  BW_REGIME_TYPES,
  BW_USUAL_HANDLING_OPERATIONS,
  BW_VAT_MOVEMENT_TYPES,
  BW_WAREHOUSE_SUBTYPES,
} from '@core';
import {
  hasSeededDictionaries,
  SEEDED_LANGUAGES,
  seededDictionaries,
} from '../../../testing/seeded-dictionaries';
import { BW_FINDING_CODES } from './bonded-warehouses.util';

/** Keys written in full in the sources (a key that is the start of a family is completed by a value at runtime). */
function literalKeys(): string[] {
  const keys = new Set<string>();

  for (const file of readdirSync(__dirname)) {
    if (!file.endsWith('.ts') || file.endsWith('.spec.ts')) {
      continue;
    }
    const source = readFileSync(join(__dirname, file), 'utf8');
    for (const match of source.matchAll(/bondedWarehouses\.[A-Za-z0-9_.]*[A-Za-z0-9_]/g)) {
      keys.add(match[0]);
    }
    for (const match of source.matchAll(/(?:NAV|PAGE_TITLE)\.BONDED_WAREHOUSES[A-Z_]*/g)) {
      keys.add(match[0]);
    }
  }

  return [...keys];
}

/** Keys the code builds from a value. */
function derivedKeys(): string[] {
  const values = (group: string, list: readonly string[]) =>
    list.map((value) => `bondedWarehouses.${group}.${value}`);

  return [
    ...values('regime', BW_REGIME_TYPES),
    ...values('subtype', BW_WAREHOUSE_SUBTYPES),
    ...values('aeoStatus', BW_AEO_STATUSES),
    ...values('declaration', BW_DECLARATION_TYPES),
    ...values('customsStatus', BW_CUSTOMS_STATUSES),
    ...values('dischargeType', BW_DISCHARGE_TYPES),
    ...values('allocation', BW_ALLOCATION_METHODS),
    ...values('usualHandling', BW_USUAL_HANDLING_OPERATIONS),
    ...values('cguDirection', BW_CGU_DIRECTIONS),
    ...values('cguReference', ['MRN_Inbound', 'MRN_Discharge', 'Manual_Adjustment']),
    ...values('vatMovement', BW_VAT_MOVEMENT_TYPES),
    ...values('sdiType', ['TD22', 'TD23', 'None']),
    ...values('auditType', BW_AUDIT_TYPES),
    ...values('discrepancy', BW_DISCREPANCY_STATUSES),
    ...values('error', BW_ERROR_CODES),
    ...values('finding', BW_FINDING_CODES),
    'NAV.BONDED_WAREHOUSES',
    'NAV.BONDED_WAREHOUSES_DASHBOARD',
    'NAV.BONDED_WAREHOUSES_MRN_LEDGER',
    'NAV.BONDED_WAREHOUSES_VAT_REGISTER',
    'NAV.BONDED_WAREHOUSES_AEO',
    'NAV.BONDED_WAREHOUSES_AUTHORIZATIONS',
    'PAGE_TITLE.BONDED_WAREHOUSES_DASHBOARD',
    'PAGE_TITLE.BONDED_WAREHOUSES_MRN_LEDGER',
    'PAGE_TITLE.BONDED_WAREHOUSES_VAT_REGISTER',
    'PAGE_TITLE.BONDED_WAREHOUSES_AEO',
    'PAGE_TITLE.BONDED_WAREHOUSES_AUTHORIZATIONS',
  ];
}

describe('bonded warehouses translations', () => {
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

  for (const language of SEEDED_LANGUAGES) {
    it.skipIf(!hasSeededDictionaries)(`has every key in the seeded ${language} dictionary`, () => {
      const dictionary = seededDictionaries[language] ?? {};
      const families = Object.keys(dictionary);
      // A literal that only starts a family (`bondedWarehouses.error` + code) is completed at runtime.
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
