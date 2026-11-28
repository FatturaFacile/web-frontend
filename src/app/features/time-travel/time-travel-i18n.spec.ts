import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  TT_AGGREGATE_TYPES,
  TT_AGING_BUCKETS,
  TT_VALUATION_METHODS,
} from '../../core/models/time-travel.model';
import { hasSeededDictionaries, SEEDED_LANGUAGES, seededDictionaries } from '../../../testing/seeded-dictionaries';
import { TIME_TRAVEL_PRESETS } from './time-travel.util';

/** Prefixes the code completes with a value at run time; derivedKeys() lists the full keys. */
const DYNAMIC_PREFIXES = [
  'TIME_TRAVEL.AGGREGATE',
  'TIME_TRAVEL.BUCKET',
  'TIME_TRAVEL.DIFF.STATUS_',
  'TIME_TRAVEL.METHOD',
  'TIME_TRAVEL.PARTNER',
  'TIME_TRAVEL.PRESET',
];

const sources = (): string[] => readdirSync(__dirname).filter((file) => file.endsWith('.ts') && !file.endsWith('.spec.ts'));

function literalKeys(): string[] {
  const keys = new Set<string>();
  for (const file of sources()) {
    const source = readFileSync(join(__dirname, file), 'utf8');
    for (const match of source.matchAll(/TIME_TRAVEL\.[A-Z0-9_.]*[A-Z0-9_]/g)) {
      keys.add(match[0]);
    }
  }
  return [...keys].filter((key) => !DYNAMIC_PREFIXES.includes(key));
}

function derivedKeys(): string[] {
  const upper = (list: readonly string[]) => list.map((value) => value.toUpperCase());
  return [
    ...upper(TT_AGING_BUCKETS).map((value) => `TIME_TRAVEL.BUCKET.${value}`),
    ...upper(TT_AGGREGATE_TYPES).map((value) => `TIME_TRAVEL.AGGREGATE.${value}`),
    ...TT_VALUATION_METHODS.map((value) => `TIME_TRAVEL.METHOD.${value}`),
    ...upper(['customer', 'supplier']).map((value) => `TIME_TRAVEL.PARTNER.${value}`),
    ...upper(['unchanged', 'delta', 'backdated']).map((value) => `TIME_TRAVEL.DIFF.STATUS_${value}`),
    ...TIME_TRAVEL_PRESETS.map((value) => `TIME_TRAVEL.PRESET.${value}`),
  ];
}

describe('time travel translations', () => {
  it('finds the keys of the feature', () => {
    expect(literalKeys().length).toBeGreaterThan(50);
    expect(literalKeys()).toContain('TIME_TRAVEL.BANNER.MESSAGE');
    expect(new Set(derivedKeys()).size).toBe(derivedKeys().length);
  });

  it('adds no string to the frontend: no dictionary and no bare words in the sources', () => {
    for (const file of sources()) {
      const source = readFileSync(join(__dirname, file), 'utf8');
      expect(source, file).not.toMatch(/translations?\s*[:=]\s*\{\s*['"]?(it|en|de|fr)['"]?\s*:/);
      expect(source, file).not.toMatch(/<th[^>]*>\s*[A-Za-z]/);
      expect(source, file).not.toMatch(/<button[^>]*>\s*[A-Za-z]/);
    }
  });

  for (const language of SEEDED_LANGUAGES) {
    it.skipIf(!hasSeededDictionaries)(`has every key in the seeded ${language} dictionary`, () => {
      const dictionary = seededDictionaries[language] ?? {};
      const missing = [...literalKeys(), ...derivedKeys()].filter(
        (key) => !(key in dictionary) || dictionary[key].trim() === '',
      );

      expect(missing).toEqual([]);
    });
  }
});
