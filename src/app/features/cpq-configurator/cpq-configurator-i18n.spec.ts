import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  hasSeededDictionaries,
  SEEDED_LANGUAGES,
  seededDictionaries,
} from '../../../testing/seeded-dictionaries';
import { CPQ_SYSTEM_VIOLATIONS } from './cpq-format';

/** Prefixes the code completes with a value: derivedKeys() lists the full keys. */
const DYNAMIC_PREFIXES = [
  'CPQ_CONFIGURATOR.EFFECT',
  'CPQ_CONFIGURATOR.FIELD',
  'CPQ_CONFIGURATOR.ISSUE',
  'CPQ_CONFIGURATOR.LAYER',
  'CPQ_CONFIGURATOR.PREVIEW.VIEW_',
  'CPQ_CONFIGURATOR.PROPOSAL',
  'CPQ_CONFIGURATOR.STATUS',
  'CPQ_CONFIGURATOR.TYPE',
  'CPQ_CONFIGURATOR.VIOLATION',
  'CPQ_CONFIGURATOR.',
];

const ISSUE_CODES = [
  'no_characteristics',
  'list_without_options',
  'range_inverted',
  'unknown_effect',
  'syntax_error',
  'unknown_variable',
  'unknown_rule_type',
  'unknown_target',
  'unknown_option',
];

const ERROR_CODES = [
  'generic',
  'invalid_json',
  'model_archived',
  'model_has_issues',
  'model_has_instances',
  'prefix_locked',
  'not_a_list',
  'model_not_published',
  'configuration_incomplete',
];

function sources(): { file: string; text: string }[] {
  return readdirSync(__dirname)
    .filter((file) => file.endsWith('.ts') && !file.endsWith('.spec.ts'))
    .map((file) => ({ file, text: readFileSync(join(__dirname, file), 'utf8') }));
}

/** Keys written in full in the sources of the feature. */
function literalKeys(): string[] {
  const keys = new Set<string>();
  for (const { text } of sources()) {
    for (const match of text.matchAll(/CPQ_CONFIGURATOR\.[A-Z0-9_.]*[A-Z0-9_]/g)) {
      keys.add(match[0]);
    }
  }

  return [...keys].filter((key) => !DYNAMIC_PREFIXES.includes(key));
}

/** The field keys and the table headers the sources feed to the dynamic FIELD prefix. */
function fieldNames(): string[] {
  const names = new Set<string>();
  for (const { text } of sources()) {
    for (const match of text.matchAll(/\bkey: '([a-z_0-9]+)'/g)) {
      names.add(match[1].toUpperCase());
    }
    for (const match of text.matchAll(/\bheader: '([A-Z_0-9]+)'/g)) {
      names.add(match[1]);
    }
  }

  return [...names];
}

function derivedKeys(): string[] {
  const values = (group: string, list: readonly string[]) =>
    list.map((value) => `CPQ_CONFIGURATOR.${group}.${value.toUpperCase()}`);

  return [
    ...values('STATUS', ['draft', 'published', 'archived']),
    ...values('TYPE', ['list', 'range', 'boolean']),
    ...values('EFFECT', [
      'add_cost',
      'add_price',
      'set_price',
      'multiply_price',
      'discount_percent',
    ]),
    ...values('LAYER', ['material', 'motor', 'electrical', 'safety', 'certification', 'accessory']),
    ...values('PROPOSAL', ['delivery', 'warranty', 'terms']),
    ...values('VIOLATION', [...CPQ_SYSTEM_VIOLATIONS, 'generic']),
    ...values('ISSUE', ISSUE_CODES),
    ...values('ERR', ERROR_CODES),
    ...values('FIELD', fieldNames()),
    'CPQ_CONFIGURATOR.PREVIEW.VIEW_PLAN',
    'CPQ_CONFIGURATOR.PREVIEW.VIEW_ELEVATION',
    'CPQ_CONFIGURATOR.PREVIEW.VIEW_ISOMETRIC',
  ];
}

describe('cpq configurator translations', () => {
  it('finds the keys of the feature', () => {
    expect(literalKeys().length).toBeGreaterThan(40);
    expect(fieldNames()).toContain('CONDITION_EXPRESSION');
  });

  it('never falls back to a text written in the sources', () => {
    for (const { file, text } of sources()) {
      expect(text, file).not.toMatch(/translateOr\(/);
    }
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
