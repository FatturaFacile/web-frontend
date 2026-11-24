import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  hasSeededDictionaries,
  SEEDED_LANGUAGES,
  seededDictionaries,
} from '../../../../testing/seeded-dictionaries';
import {
  CONTRACT_STATUS_KEYS,
  JURISDICTION_KEYS,
  MODEL_KEYS,
  RELEASE_RULE_KEYS,
  SAL_STATUS_KEYS,
  WIP_METHOD_KEYS,
  WIP_NATURE_KEYS,
} from './project-billing.utils';

const FEATURE_DIR = __dirname;

/** Keys written in full in the sources of the feature (templates and code, not the specs). */
function literalKeys(): string[] {
  const keys = new Set<string>();

  for (const file of readdirSync(FEATURE_DIR)) {
    if (!file.endsWith('.ts') || file.endsWith('.spec.ts')) {
      continue;
    }

    for (const match of readFileSync(join(FEATURE_DIR, file), 'utf8').matchAll(
      /PROJECT_BILLING\.[A-Z0-9_]+/g,
    )) {
      keys.add(match[0]);
    }
  }

  return [...keys];
}

/** Keys the code reads from a table. */
function derivedKeys(): string[] {
  return [
    ...Object.values(MODEL_KEYS),
    ...Object.values(CONTRACT_STATUS_KEYS),
    ...Object.values(SAL_STATUS_KEYS),
    ...Object.values(RELEASE_RULE_KEYS),
    ...Object.values(WIP_METHOD_KEYS),
    ...Object.values(WIP_NATURE_KEYS),
    ...Object.values(JURISDICTION_KEYS),
  ];
}

describe('project billing translations', () => {
  it('finds the keys of the feature', () => {
    expect(literalKeys()).toContain('PROJECT_BILLING.TITLE');
    expect(literalKeys().length).toBeGreaterThan(60);
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
