import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  hasSeededDictionaries,
  SEEDED_LANGUAGES,
  seededDictionaries,
} from '../../../../../testing/seeded-dictionaries';
import { CSV_FIELDS, F24_SECTIONS, PAYMENT_FLOWS } from './treasury-banking.util';

/** Prefixes the code completes with a value: derivedKeys() lists the full keys. */
const DYNAMIC_PREFIXES = [
  'tbk.flow',
  'tbk.flowHint',
  'tbk.f24.status',
  'tbk.f24.sectionName',
  'tbk.hub.formatName',
  'tbk.hub.csv.field',
  'tbk.hub.ob.driver',
  'tbk.hub.ob.run',
  'tbk.rule',
  'tbk.kind',
  'tbk.reason',
];

const REASONS = [
  'structured_reference',
  'exact_amount',
  'tax_id',
  'iban',
  'name',
  'ambiguous',
  'invoice_number',
  'invoice_number_approximate',
  'bank_fee_tolerance',
  'fx_difference',
  'partial_payment',
];

/** Keys written in full in the sources of the workspace (code and templates, not the specs). */
function literalKeys(): string[] {
  const keys = new Set<string>();

  for (const file of readdirSync(__dirname)) {
    if (!file.endsWith('.ts') || file.endsWith('.spec.ts')) {
      continue;
    }
    for (const match of readFileSync(join(__dirname, file), 'utf8').matchAll(
      /tbk\.[A-Za-z0-9_.]*[A-Za-z0-9_]/g,
    )) {
      keys.add(match[0]);
    }
  }

  return [...keys].filter((key) => !DYNAMIC_PREFIXES.includes(key));
}

function derivedKeys(): string[] {
  const values = (prefix: string, list: readonly string[]) =>
    list.map((value) => `${prefix}.${value}`);

  return [
    ...values('tbk.flow', PAYMENT_FLOWS),
    ...values('tbk.flowHint', PAYMENT_FLOWS),
    ...values('tbk.f24.status', ['draft', 'validated', 'generated', 'paid']),
    ...values('tbk.f24.sectionName', F24_SECTIONS),
    ...values('tbk.hub.formatName', ['auto', 'camt053', 'camt054', 'cbi', 'csv']),
    ...values('tbk.hub.csv.field', CSV_FIELDS),
    ...values('tbk.hub.ob.driver', ['refused', 'local', 'sandbox', 'psd2', 'blink']),
    ...values('tbk.hub.ob.run', ['running', 'completed', 'failed']),
    ...values('tbk.rule', ['structured_reference', 'amount_counterparty', 'fuzzy_invoice']),
    ...values('tbk.kind', ['exact', 'fee_tolerance', 'fx', 'partial']),
    ...values('tbk.reason', REASONS),
  ];
}

describe('treasury banking translations', () => {
  it('finds the keys of the workspace', () => {
    expect(literalKeys()).toContain('tbk.flows.title');
    expect(literalKeys()).toContain('tbk.smart.apply');
    expect(literalKeys().length).toBeGreaterThan(100);
  });

  it('never writes a text, or a fallback, in the sources', () => {
    for (const file of readdirSync(__dirname)) {
      if (!file.endsWith('.ts') || file.endsWith('.spec.ts')) {
        continue;
      }
      expect(readFileSync(join(__dirname, file), 'utf8'), file).not.toMatch(/translateOr\(/);
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

  it.skipIf(!hasSeededDictionaries)('describes every seeded F24 code in all the languages', () => {
    const codes = Object.keys(seededDictionaries['it'] ?? {}).filter((key) =>
      key.startsWith('treasury.f24.code.'),
    );

    expect(codes.length).toBeGreaterThan(30);

    for (const language of SEEDED_LANGUAGES) {
      const dictionary = seededDictionaries[language] ?? {};
      expect(
        codes.filter((key) => (dictionary[key] ?? '').trim() === ''),
        language,
      ).toEqual([]);
    }
  });
});
