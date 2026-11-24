import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  hasSeededDictionaries,
  SEEDED_LANGUAGES,
  seededDictionaries,
} from '../../../../testing/seeded-dictionaries';

const FEATURE_DIR = __dirname;

/** Collects every translation key referenced in the RFQ feature sources (ts & html). */
function collectedFeatureKeys(): string[] {
  const keys = new Set<string>(['NAV.PROC_RFQS']);

  for (const file of readdirSync(FEATURE_DIR)) {
    if ((!file.endsWith('.ts') && !file.endsWith('.html')) || file.endsWith('.spec.ts')) {
      continue;
    }

    const content = readFileSync(join(FEATURE_DIR, file), 'utf8');
    for (const match of content.matchAll(/RFQ\.[A-Z0-9_.]+/g)) {
      keys.add(match[0]);
    }
  }

  return [...keys].filter((key) => !key.endsWith('_') && !key.endsWith('.'));
}

describe('Mod 045 RFQ & Supplier Portal translations', () => {
  it('collects RFQ keys across templates and components', () => {
    const keys = collectedFeatureKeys();
    expect(keys).toContain('NAV.PROC_RFQS');
    expect(keys).toContain('RFQ.TITLE');
    expect(keys).toContain('RFQ.MATRIX.TITLE');
    expect(keys).toContain('RFQ.PORTAL.SUBMIT_BID');
    expect(keys.length).toBeGreaterThan(50);
  });

  it.skipIf(!hasSeededDictionaries)(
    'has every RFQ and navigation key in it, en, de and fr with non-empty text',
    () => {
      const keys = collectedFeatureKeys();

      for (const language of SEEDED_LANGUAGES) {
        const dictionary = seededDictionaries[language] ?? {};
        const missing = keys.filter((key) => (dictionary[key] ?? '').trim() === '');
        expect(missing, `${language} is missing: ${missing.join(', ')}`).toEqual([]);
      }
    },
  );

  it.skipIf(!hasSeededDictionaries)('preserves identical placeholders across all four languages', () => {
    const placeholders = (text: string): string =>
      [...text.matchAll(/\{(\w+)\}/g)]
        .map((match) => match[1])
        .sort()
        .join(',');

    for (const key of collectedFeatureKeys()) {
      const variants = new Set(
        SEEDED_LANGUAGES.map((language) => placeholders(seededDictionaries[language]?.[key] ?? '')),
      );
      expect(variants.size, `${key} has inconsistent placeholders across locales`).toBe(1);
    }
  });
});
