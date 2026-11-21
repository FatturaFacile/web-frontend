import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  hasSeededDictionaries,
  SEEDED_LANGUAGES,
  seededDictionaries,
} from '../../../testing/seeded-dictionaries';
import { ALL_KINDS, FIELD_KEYS, PRIORITIES, STATUSES } from './ai-cognitive.utils';

const FEATURE_DIR = __dirname;

/** Keys written in full in the sources of the feature (templates and code, not the specs). */
function literalKeys(): string[] {
  const keys = new Set<string>();

  for (const file of readdirSync(FEATURE_DIR)) {
    if (!file.endsWith('.ts') || file.endsWith('.spec.ts') || file.endsWith('.testing.ts')) {
      continue;
    }

    for (const match of readFileSync(join(FEATURE_DIR, file), 'utf8').matchAll(
      /AI_COG\.[A-Z0-9_]+/g,
    )) {
      keys.add(match[0]);
    }
  }

  // `AI_COG.KIND_`, `AI_COG.FIELD_` and the other prefixes are completed from a value, see familyKeys().
  return [...keys].filter((key) => !key.endsWith('_'));
}

/** Keys the templates build from a value: `'AI_COG.KIND_' + kind.toUpperCase()` and the like. */
function familyKeys(): string[] {
  const families: Record<string, readonly string[]> = {
    KIND_: ALL_KINDS,
    STATUS_: STATUSES,
    PRIORITY_: PRIORITIES,
    FIELD_: FIELD_KEYS,
    SOURCE_: [
      'email',
      'rfq',
      'delivery_note',
      'support_ticket',
      'document',
      'bank_transaction',
      'expense_receipt',
      'system',
    ],
    PROVIDER_: ['ollama', 'openai', 'anthropic', 'gemini', 'azure_openai'],
    CLASS_: ['public', 'internal', 'confidential_pii'],
    TIER_: ['low', 'moderate', 'high', 'critical'],
    OUTCOME_: ['auto', 'review', 'off'],
    WORKFLOW_: [
      'extraction_sales_quote',
      'extraction_purchase_order',
      'extraction_support_ticket',
      'extraction_contact',
      'accounting_coding',
      'reconciliation',
      'anomaly_guard',
      'predictive_insight',
    ],
  };

  return Object.entries(families).flatMap(([prefix, values]) =>
    values.map((value) => `AI_COG.${prefix}${value.toUpperCase()}`),
  );
}

describe('AI layer translations', () => {
  const keys = [...new Set([...literalKeys(), ...familyKeys()])].sort();

  it('finds the keys of the sources', () => {
    expect(keys.length).toBeGreaterThan(150);
    expect(keys).toContain('AI_COG.WORKBENCH_TITLE');
    expect(keys).toContain('AI_COG.KIND_RECONCILIATION_MATCH');
    expect(keys).toContain('AI_COG.FIELD_P10_BALANCE');
  });

  it.skipIf(!hasSeededDictionaries)('has every key in Italian, English, German and French', () => {
    for (const language of SEEDED_LANGUAGES) {
      const dictionary = seededDictionaries[language] ?? {};
      const missing = keys.filter((key) => (dictionary[key] ?? '').trim() === '');

      expect(missing, `Keys without a ${language} text`).toEqual([]);
    }
  });

  it.skipIf(!hasSeededDictionaries)('keeps the same AI keys in all the languages', () => {
    const reference = Object.keys(seededDictionaries['it'] ?? {})
      .filter((key) => key.startsWith('AI_COG.'))
      .sort();

    expect(reference.length).toBeGreaterThan(150);

    for (const language of SEEDED_LANGUAGES) {
      const own = Object.keys(seededDictionaries[language] ?? {})
        .filter((key) => key.startsWith('AI_COG.'))
        .sort();

      expect(own, `AI keys of ${language}`).toEqual(reference);
    }
  });

  it.skipIf(!hasSeededDictionaries)(
    'translates each language differently from the others where words differ',
    () => {
      const it = seededDictionaries['it'] ?? {};
      const de = seededDictionaries['de'] ?? {};
      const fr = seededDictionaries['fr'] ?? {};
      const en = seededDictionaries['en'] ?? {};

      expect(it['AI_COG.APPROVE']).toBe('Approva');
      expect(en['AI_COG.APPROVE']).toBe('Approve');
      expect(de['AI_COG.APPROVE']).toBe('Genehmigen');
      expect(fr['AI_COG.APPROVE']).toBe('Approuver');
    },
  );
});
