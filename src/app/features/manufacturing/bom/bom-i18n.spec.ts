import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  hasSeededDictionaries,
  SEEDED_LANGUAGES,
  seededDictionaries,
} from '../../../testing/seeded-dictionaries';
import { BOM_IMPORT_FIELDS } from './bom.utils';

const DIR = __dirname;
const MENU = join(DIR, '..', '..', '..', 'layout', 'sidebar', 'menu-sections.ts');

/** Keys written in full in the sources (templates and code, not the specs). */
function literalKeys(): string[] {
  const keys = new Set<string>();

  for (const file of readdirSync(DIR)) {
    if (!file.endsWith('.ts') || file.endsWith('.spec.ts')) {
      continue;
    }
    for (const match of readFileSync(join(DIR, file), 'utf8').matchAll(/MFG_BOM\.[A-Z0-9_]+/g)) {
      keys.add(match[0]);
    }
  }
  for (const match of readFileSync(MENU, 'utf8').matchAll(
    /NAV\.MFG_(?:BOM_DESIGNER|WHERE_USED|BOM_DIFF|BOM_IMPORT)/g,
  )) {
    keys.add(match[0]);
  }

  return [...keys].filter((key) => !key.endsWith('_'));
}

const allKeys = (): string[] => [
  ...new Set([
    ...literalKeys(),
    ...BOM_IMPORT_FIELDS.map((field) => `MFG_BOM.IMPORT_FIELD_${field.toUpperCase()}`),
  ]),
];

describe('BOM management translations', () => {
  it('finds the keys of the feature', () => {
    expect(literalKeys()).toContain('MFG_BOM.DESIGNER_TITLE');
    expect(literalKeys()).toContain('NAV.MFG_BOM_IMPORT');
    expect(literalKeys().length).toBeGreaterThan(80);
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
      const variants = new Set(
        SEEDED_LANGUAGES.map((language) => placeholders(seededDictionaries[language]?.[key] ?? '')),
      );

      expect(variants.size, `${key} has different placeholders per language`).toBe(1);
    }
  });
});
