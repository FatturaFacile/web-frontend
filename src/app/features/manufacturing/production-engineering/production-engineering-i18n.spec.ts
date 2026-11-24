import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { hasSeededDictionaries, SEEDED_LANGUAGES, seededDictionaries } from '../../../../testing/seeded-dictionaries';
import { DAY_TYPES, LOSS_ORDER } from './production-engineering.utils';

const DIR = __dirname;
const MENU = join(DIR, '..', '..', '..', 'layout', 'sidebar', 'menu-sections.ts');

/** Keys written in full in the sources, plus the ones the templates build from a closed set of values. */
function allKeys(): string[] {
  const keys = new Set<string>();
  for (const file of readdirSync(DIR)) {
    if (!file.endsWith('.ts') || file.endsWith('.spec.ts')) {
      continue;
    }
    for (const match of readFileSync(join(DIR, file), 'utf8').matchAll(/MFG_PE\.[A-Z0-9_]+/g)) {
      keys.add(match[0]);
    }
  }
  for (const match of readFileSync(MENU, 'utf8').matchAll(/NAV\.MFG_(?:WORK_CENTERS|WORKING_CALENDARS|ROUTINGS|OEE)\b/g)) {
    keys.add(match[0]);
  }
  // Prefixes that are completed at run time.
  for (const prefix of ['MFG_PE.DAY_', 'MFG_PE.DAY_TYPE_', 'MFG_PE.GRAN_', 'MFG_PE.LOSS_', 'MFG_PE.STATUS_', 'MFG_PE.TELEMETRY_', 'MFG_PE.TYPE_']) {
    keys.delete(prefix);
  }
  for (const n of [1, 2, 3, 4, 5, 6, 7]) {
    keys.add(`MFG_PE.DAY_${n}`);
  }
  for (const type of DAY_TYPES) {
    keys.add(`MFG_PE.DAY_TYPE_${type.toUpperCase()}`);
  }
  for (const loss of LOSS_ORDER) {
    keys.add(`MFG_PE.LOSS_${loss.toUpperCase()}`);
  }
  for (const g of ['REAL_TIME', 'SHIFT', 'DAILY', 'WEEKLY', 'MONTHLY']) {
    keys.add(`MFG_PE.GRAN_${g}`);
  }
  for (const s of ['ACTIVE', 'MAINTENANCE', 'INACTIVE', 'DECOMMISSIONED']) {
    keys.add(`MFG_PE.STATUS_${s}`);
  }
  for (const s of ['ONLINE', 'STALE', 'NEVER']) {
    keys.add(`MFG_PE.TELEMETRY_${s}`);
  }
  for (const t of ['INTERNAL_MACHINING', 'MANUAL_ASSEMBLY', 'EXTERNAL_SUBCONTRACTING']) {
    keys.add(`MFG_PE.TYPE_${t}`);
  }

  return [...keys].sort();
}

describe('production engineering translations', () => {
  it('finds the keys of the feature', () => {
    expect(allKeys()).toContain('MFG_PE.OEE_TITLE');
    expect(allKeys()).toContain('NAV.MFG_ROUTINGS');
    expect(allKeys().length).toBeGreaterThan(120);
  });

  it.skipIf(!hasSeededDictionaries)('has every key in it, en, de and fr with a non-empty text', () => {
    for (const language of SEEDED_LANGUAGES) {
      const dictionary = seededDictionaries[language] ?? {};
      const missing = allKeys().filter((key) => (dictionary[key] ?? '').trim() === '');

      expect(missing, `${language} is missing: ${missing.join(', ')}`).toEqual([]);
    }
  });

  it.skipIf(!hasSeededDictionaries)('uses the same placeholders in every language', () => {
    const placeholders = (text: string): string =>
      [...text.matchAll(/\{(\w+)\}/g)]
        .map((match) => match[1])
        .sort()
        .join(',');

    for (const key of allKeys()) {
      const variants = new Set(SEEDED_LANGUAGES.map((language) => placeholders(seededDictionaries[language]?.[key] ?? '')));

      expect(variants.size, `${key} has different placeholders per language`).toBe(1);
    }
  });
});
