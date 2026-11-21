import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MFG_COST_ELEMENTS, MFG_MACHINE_STATES, MFG_STRATEGIES } from '@core';
import { describe, expect, it } from 'vitest';
import { hasSeededDictionaries, SEEDED_LANGUAGES, seededDictionaries } from '../../../../testing/seeded-dictionaries';
import { SCRAP_REASONS } from './shop-floor-kiosk.page';

const DIR = __dirname;
const MENU = join(DIR, '..', '..', '..', 'layout', 'sidebar', 'menu-sections.ts');

/** Keys written in full in the sources, plus the ones built from a prefix and a known set of suffixes. */
function allKeys(): string[] {
  const keys = new Set<string>();
  for (const file of readdirSync(DIR)) {
    if (!file.endsWith('.ts') || file.endsWith('.spec.ts')) {
      continue;
    }
    for (const match of readFileSync(join(DIR, file), 'utf8').matchAll(/MFG_CC\.[A-Z0-9_]+/g)) {
      keys.add(match[0]);
    }
  }
  for (const match of readFileSync(MENU, 'utf8').matchAll(/NAV\.MFG_(?:CONTROL_TOWER|MRP_GANTT|KIOSK|GENEALOGY)/g)) {
    keys.add(match[0]);
  }
  const prefixes = [...keys].filter((key) => key.endsWith('_'));
  const complete = [...keys].filter((key) => !key.endsWith('_'));
  const suffixes: Record<string, readonly string[]> = {
    'MFG_CC.STRATEGY_': MFG_STRATEGIES,
    'MFG_CC.MACHINE_': MFG_MACHINE_STATES,
    'MFG_CC.COST_': MFG_COST_ELEMENTS.map((element) => element.toUpperCase()),
    'MFG_CC.KIOSK_REASON_': SCRAP_REASONS.map((reason) => reason.toUpperCase()),
    'MFG_CC.ISSUE_': ['STATUS', 'RANGE', 'OVERLOAD', 'NO_CAPACITY'],
  };
  for (const prefix of prefixes) {
    const known = suffixes[prefix];
    expect(known, `no suffix list for ${prefix}`).toBeDefined();
    for (const suffix of known ?? []) {
      complete.push(`${prefix}${suffix}`);
    }
  }
  return [...new Set(complete)];
}

describe('manufacturing workspace translations', () => {
  it('finds the keys of the feature', () => {
    expect(allKeys()).toContain('MFG_CC.TOWER_TITLE');
    expect(allKeys()).toContain('MFG_CC.ISSUE_OVERLOAD');
    expect(allKeys()).toContain('NAV.MFG_KIOSK');
    expect(allKeys().length).toBeGreaterThan(100);
  });

  it.skipIf(!hasSeededDictionaries)('has every key in it, en, de and fr with a non-empty text', () => {
    for (const language of SEEDED_LANGUAGES) {
      const dictionary = seededDictionaries[language] ?? {};
      const missing = allKeys().filter((key) => (dictionary[key] ?? '').trim() === '');
      expect(missing, `${language} is missing ${missing.join(', ')}`).toEqual([]);
    }
  });

  it.skipIf(!hasSeededDictionaries)('keeps the placeholders of every language identical', () => {
    const placeholders = (text: string): string =>
      [...text.matchAll(/\{[a-z]+\}/g)]
        .map((m) => m[0])
        .sort()
        .join(',');
    for (const key of allKeys()) {
      const reference = placeholders(seededDictionaries['en']?.[key] ?? '');
      for (const language of SEEDED_LANGUAGES) {
        expect(placeholders(seededDictionaries[language]?.[key] ?? ''), `${language} ${key}`).toBe(reference);
      }
    }
  });
});
