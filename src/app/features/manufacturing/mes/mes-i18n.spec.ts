import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  hasSeededDictionaries,
  SEEDED_LANGUAGES,
  seededDictionaries,
} from '../../../../testing/seeded-dictionaries';
import { MES_DEFECT_REASONS, MES_SUSPENSION_REASONS } from './mes.models';

const DIR = __dirname;
const MENU = join(DIR, '..', '..', '..', 'layout', 'sidebar', 'menu-sections.ts');

/** Keys written in full in the sources of the board (templates and code, not the specs). */
function literalKeys(): string[] {
  const keys = new Set<string>();

  for (const file of readdirSync(DIR)) {
    if (!file.endsWith('.ts') || file.endsWith('.spec.ts')) {
      continue;
    }
    for (const match of readFileSync(join(DIR, file), 'utf8').matchAll(/MFG_MES\.[A-Z0-9_]+/g)) {
      keys.add(match[0]);
    }
  }
  if (readFileSync(MENU, 'utf8').includes('NAV.MFG_MES_BOARD')) {
    keys.add('NAV.MFG_MES_BOARD');
  }

  return [...keys];
}

const enumKeys = (): string[] =>
  [
    ...[
      'available',
      'assigned',
      'setup',
      'running',
      'suspended',
      'closed',
      'attended',
      'unattended',
    ],
    ...MES_SUSPENSION_REASONS,
    ...MES_DEFECT_REASONS,
  ].map((value) => `RES.V.${value}`);

describe('MES operator board translations', () => {
  it('finds the keys of the feature', () => {
    expect(literalKeys()).toContain('MFG_MES.TITLE');
    expect(literalKeys()).toContain('NAV.MFG_MES_BOARD');
    expect(literalKeys().length).toBeGreaterThan(40);
  });

  it.skipIf(!hasSeededDictionaries)(
    'has every key and enum value in it, en, de and fr with a non-empty text',
    () => {
      for (const language of SEEDED_LANGUAGES) {
        const dictionary = seededDictionaries[language] ?? {};
        const missing = [...literalKeys(), ...enumKeys()].filter(
          (key) => (dictionary[key] ?? '').trim() === '',
        );

        expect(missing, `${language} is missing: ${missing.join(', ')}`).toEqual([]);
      }
    },
  );
});
