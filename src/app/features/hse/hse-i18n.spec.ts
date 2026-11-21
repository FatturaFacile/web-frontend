import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  hasSeededDictionaries,
  SEEDED_LANGUAGES,
  seededDictionaries,
} from '../../../testing/seeded-dictionaries';
import { BlockingReasonCode } from './hse.models';
import {
  CERTIFICATE_KEYS,
  FITNESS_KEYS,
  INCIDENT_STATUS_KEYS,
  INCIDENT_TYPE_KEYS,
  lightKey,
  reasonKey,
} from './hse.utils';

const FEATURE_DIR = __dirname;

/** Keys written in full in the sources of the feature (templates and code, not the specs). */
function literalKeys(): string[] {
  const keys = new Set<string>();

  for (const file of readdirSync(FEATURE_DIR)) {
    if (!file.endsWith('.ts') || file.endsWith('.spec.ts')) {
      continue;
    }

    for (const match of readFileSync(join(FEATURE_DIR, file), 'utf8').matchAll(/HSE\.[A-Z0-9_]+/g)) {
      keys.add(match[0]);
    }
  }

  // `HSE.LIGHT_` and `HSE.REASON_` are prefixes the code completes with a value; derivedKeys() checks the full keys.
  return [...keys].filter((key) => !key.endsWith('_'));
}

/** Keys the code builds from a value (reason codes, lights) or reads from a table. */
function derivedKeys(): string[] {
  const reasons: BlockingReasonCode[] = [
    'certificate_missing',
    'certificate_expired',
    'medical_missing',
    'medical_expired',
    'medical_unfit',
    'medical_restriction_conflict',
    'ppe_missing',
  ];

  return [
    ...reasons.map((code) => reasonKey({ code, subject: '', expires_at: null, detail: null })),
    lightKey('GREEN'),
    lightKey('YELLOW'),
    lightKey('RED'),
    ...Object.values(CERTIFICATE_KEYS),
    ...Object.values(FITNESS_KEYS),
    ...Object.values(INCIDENT_TYPE_KEYS),
    ...Object.values(INCIDENT_STATUS_KEYS),
  ];
}

describe('HSE translations', () => {
  it('finds the keys of the feature', () => {
    expect(literalKeys()).toContain('HSE.BLOCK_TITLE');
    expect(literalKeys().length).toBeGreaterThan(40);
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
      const variants = new Set(
        SEEDED_LANGUAGES.map((language) => placeholders(seededDictionaries[language]?.[key] ?? '')),
      );

      expect(variants.size, `${key} has different placeholders per language`).toBe(1);
    }
  });
});
