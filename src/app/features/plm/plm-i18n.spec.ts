import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  hasSeededDictionaries,
  SEEDED_LANGUAGES,
  seededDictionaries,
} from '../../../testing/seeded-dictionaries';

function collectPlmKeys(): string[] {
  const keys = new Set<string>();
  for (const file of readdirSync(__dirname)) {
    if (!file.endsWith('.ts') || file.endsWith('.spec.ts')) {
      continue;
    }
    const source = readFileSync(join(__dirname, file), 'utf8');
    for (const match of source.matchAll(/'((?:PLM|NAV|PAGE_TITLE)\.[A-Z0-9_]+)'/g)) {
      if (!match[1].endsWith('_')) {
        keys.add(match[1]);
      }
    }
  }
  return [...keys];
}

describe('PLM Mod 168 translations', () => {
  it('discovers PLM translation keys from feature sources without hardcoded UI copy', () => {
    const keys = collectPlmKeys();
    expect(keys).toContain('PLM.WATERMARK_OBSOLETE');
    expect(keys).toContain('PLM.CAD_IMPORT_TITLE');
    expect(keys).toContain('PLM.WHERE_USED_TITLE');
  });

  it.skipIf(!hasSeededDictionaries)('has every PLM key translated in it, en, de and fr', () => {
    const keys = collectPlmKeys();
    for (const language of SEEDED_LANGUAGES) {
      const dictionary = seededDictionaries[language] ?? {};
      const missing = keys.filter((key) => (dictionary[key] ?? '').trim() === '');
      expect(missing, `${language} is missing: ${missing.join(', ')}`).toEqual([]);
    }
  });
});
