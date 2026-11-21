import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  hasSeededDictionaries,
  SEEDED_LANGUAGES,
  seededDictionaries,
} from '../../../../testing/seeded-dictionaries';

const FEATURE_DIR = __dirname;

const DYNAMIC_PR_KEYS = [
  'NAV.PROC_REQUISITIONS',
  'PR.APPROVAL.STEP_PENDING',
  'PR.APPROVAL.STEP_IN_PROGRESS',
  'PR.APPROVAL.STEP_APPROVED',
  'PR.APPROVAL.STEP_REJECTED',
  'PR.APPROVAL.STEP_SKIPPED',
];

/** Collects every PR.* and navigation translation key referenced in Mod 044 feature files. */
function collectedFeatureKeys(): string[] {
  const keys = new Set<string>(DYNAMIC_PR_KEYS);

  for (const file of readdirSync(FEATURE_DIR)) {
    if ((!file.endsWith('.ts') && !file.endsWith('.html')) || file.endsWith('.spec.ts')) {
      continue;
    }

    const content = readFileSync(join(FEATURE_DIR, file), 'utf8');
    for (const match of content.matchAll(/PR\.[A-Z0-9_.]+/g)) {
      keys.add(match[0]);
    }
  }

  return [...keys].filter((key) => !key.endsWith('_') && !key.endsWith('.'));
}

describe('Mod 044 Purchase Requisitions translations', () => {
  it('collects PR keys across templates, helpers, and components', () => {
    const keys = collectedFeatureKeys();
    expect(keys).toContain('NAV.PROC_REQUISITIONS');
    expect(keys).toContain('PR.TITLE');
    expect(keys).toContain('PR.STATUS_BUDGET_EXCEEDED_BLOCKED');
    expect(keys).toContain('PR.BUDGET.ALERT_HARD_BLOCK_TITLE');
    expect(keys).toContain('PR.ONE_CLICK.APPROVED_TITLE');
    expect(keys).toContain('PR.CONVERT.BTN_CREATE_RFQ');
    expect(keys.length).toBeGreaterThan(80);
  });

  it.skipIf(!hasSeededDictionaries)(
    'has every PR and navigation key in it, en, de and fr with non-empty text',
    () => {
      const keys = collectedFeatureKeys();

      for (const language of SEEDED_LANGUAGES) {
        const dictionary = seededDictionaries[language] ?? {};
        const missing = keys.filter((key) => (dictionary[key] ?? '').trim() === '');
        expect(missing, `${language} is missing: ${missing.join(', ')}`).toEqual([]);
      }
    },
  );

  it.skipIf(!hasSeededDictionaries)(
    'preserves identical placeholders across all four languages',
    () => {
      const placeholders = (text: string): string =>
        [...text.matchAll(/\{(\w+)\}/g)]
          .map((match) => match[1])
          .sort()
          .join(',');

      for (const key of collectedFeatureKeys()) {
        const variants = new Set(
          SEEDED_LANGUAGES.map((language) =>
            placeholders(seededDictionaries[language]?.[key] ?? ''),
          ),
        );
        expect(variants.size, `${key} has inconsistent placeholders across locales`).toBe(1);
      }
    },
  );
});
