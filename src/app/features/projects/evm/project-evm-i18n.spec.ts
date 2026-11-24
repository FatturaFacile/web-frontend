import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  hasSeededDictionaries,
  SEEDED_LANGUAGES,
  seededDictionaries,
} from '../../../../testing/seeded-dictionaries';
import { GRANULARITY_KEYS, LIGHT_KEYS, SOURCE_KEYS } from './project-evm.utils';

const FEATURE_DIR = __dirname;

/** Keys written in full in the sources of the feature (templates and code, not the specs). */
function literalKeys(): string[] {
  const keys = new Set<string>();

  for (const file of readdirSync(FEATURE_DIR)) {
    if (!file.endsWith('.ts') || file.endsWith('.spec.ts')) {
      continue;
    }

    for (const match of readFileSync(join(FEATURE_DIR, file), 'utf8').matchAll(/PROJECT_EVM\.[A-Z0-9_]+/g)) {
      keys.add(match[0]);
    }
  }

  // `PROJECT_EVM.STEP_` is a prefix the waterfall completes with the step key; derivedKeys() checks the full keys.
  return [...keys].filter((key) => !key.endsWith('_'));
}

/** Keys the code builds from a value or reads from a table, and the alert messages the API stores. */
function derivedKeys(): string[] {
  return [
    ...Object.values(SOURCE_KEYS),
    ...Object.values(GRANULARITY_KEYS),
    ...Object.values(LIGHT_KEYS),
    'PROJECT_EVM.STEP_REVENUE',
    'PROJECT_EVM.STEP_GROSS_MARGIN',
    'PROJECTS.EVM_ALERT_CPI',
    'PROJECTS.EVM_ALERT_SPI',
    'PROJECTS.EVM_ALERT_ABSORPTION',
    'PROJECTS.EVM_SEVERITY_WARNING',
    'PROJECTS.EVM_SEVERITY_CRITICAL',
  ];
}

describe('project EVM translations', () => {
  it('finds the keys of the feature', () => {
    expect(literalKeys()).toContain('PROJECT_EVM.TITLE');
    expect(literalKeys().length).toBeGreaterThan(30);
  });

  it.skipIf(!hasSeededDictionaries)('has every key in it, en, de and fr with a non-empty text', () => {
    const keys = [...new Set([...literalKeys(), ...derivedKeys()])];

    for (const language of SEEDED_LANGUAGES) {
      const dictionary = seededDictionaries[language] ?? {};
      const missing = keys.filter((key) => (dictionary[key] ?? '').trim() === '');

      expect(missing, `${language} is missing: ${missing.join(', ')}`).toEqual([]);
    }
  });

  it.skipIf(!hasSeededDictionaries)('uses the same placeholders in every language', () => {
    const placeholders = (text: string): string =>
      [...text.matchAll(/\{(\w+)\}/g)]
        .map((match) => match[1])
        .sort()
        .join(',');

    for (const key of [...new Set([...literalKeys(), ...derivedKeys()])]) {
      const variants = new Set(SEEDED_LANGUAGES.map((language) => placeholders(seededDictionaries[language]?.[key] ?? '')));

      expect(variants.size, `${key} has different placeholders per language`).toBe(1);
    }
  });
});
