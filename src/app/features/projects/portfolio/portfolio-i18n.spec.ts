import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { hasSeededDictionaries, SEEDED_LANGUAGES, seededDictionaries } from '../../../../testing/seeded-dictionaries';
import {
  BILLING_MODEL_KEYS,
  DEPENDENCY_KEYS,
  KANBAN_KEYS,
  NODE_TYPE_KEYS,
  PROJECT_TYPE_KEYS,
  STATUS_KEYS,
} from './portfolio.utils';

const FEATURE_DIR = __dirname;
const PROJECTS_DIR = join(FEATURE_DIR, '..');

/** Keys written in full in the sources of the feature, its routes and the link added to the projects page. */
function literalKeys(): string[] {
  const keys = new Set<string>();
  const files = [
    ...readdirSync(FEATURE_DIR)
      .filter((file) => file.endsWith('.ts') && !file.endsWith('.spec.ts') && !file.endsWith('.testing.ts'))
      .map((file) => join(FEATURE_DIR, file)),
    join(PROJECTS_DIR, 'projects.routes.ts'),
    join(PROJECTS_DIR, 'projects.component.html'),
  ];

  for (const file of files) {
    for (const match of readFileSync(file, 'utf8').matchAll(/PORTFOLIO\.[A-Z0-9_]+/g)) {
      keys.add(match[0]);
    }
  }

  return [...keys];
}

/** Keys the code reads from a table. */
function tableKeys(): string[] {
  return [PROJECT_TYPE_KEYS, BILLING_MODEL_KEYS, STATUS_KEYS, NODE_TYPE_KEYS, DEPENDENCY_KEYS, KANBAN_KEYS].flatMap((table) => Object.values(table));
}

describe('project portfolio translations', () => {
  it('finds the keys of the feature', () => {
    expect(literalKeys()).toContain('PORTFOLIO.TITLE');
    expect(literalKeys()).toContain('PORTFOLIO.NAV');
    expect(literalKeys().length).toBeGreaterThan(100);
    expect(tableKeys()).toHaveLength(3 + 4 + 5 + 4 + 4 + 3);
  });

  it.skipIf(!hasSeededDictionaries)('has every key in it, en, de and fr with a non-empty text', () => {
    const keys = [...new Set([...literalKeys(), ...tableKeys()])];

    for (const language of SEEDED_LANGUAGES) {
      const dictionary = seededDictionaries[language] ?? {};
      const missing = keys.filter((key) => (dictionary[key] ?? '').trim() === '');

      expect(missing, `${language} is missing: ${missing.join(', ')}`).toEqual([]);
    }
  });

  it.skipIf(!hasSeededDictionaries)('keeps the placeholders of the parametrised texts in every language', () => {
    for (const language of SEEDED_LANGUAGES) {
      expect(seededDictionaries[language]?.['PORTFOLIO.CRITICAL_NODES'], language).toContain('{count}');
    }
  });
});
