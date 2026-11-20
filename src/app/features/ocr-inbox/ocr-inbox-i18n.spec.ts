import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  hasSeededDictionaries,
  SEEDED_LANGUAGES,
  seededDictionaries,
} from '../../../testing/seeded-dictionaries';
import { BAND_LABEL_KEYS, providerKey } from './ocr-inbox.utils';
import { OcrProvider } from './ocr-inbox.models';

const FEATURE_DIR = __dirname;

/** Keys written in full in the sources of the feature (templates and code, not the specs). */
function literalKeys(): string[] {
  const keys = new Set<string>();

  for (const file of readdirSync(FEATURE_DIR)) {
    if (!file.endsWith('.ts') || file.endsWith('.spec.ts') || file.endsWith('.testing.ts')) {
      continue;
    }

    for (const match of readFileSync(join(FEATURE_DIR, file), 'utf8').matchAll(
      /OCR_INBOX\.[A-Z0-9_]+/g,
    )) {
      keys.add(match[0]);
    }
  }

  return [...keys].filter((key) => !key.endsWith('_'));
}

/** Keys the templates build from a value: `'OCR_INBOX.CATEGORY_' + category`, `STATUS_`, `CHANNEL_`, `MATCH_`, `LINE_CODING_SOURCE_`. */
function familyKeys(): string[] {
  const families: Record<string, string[]> = {
    CATEGORY_: ['VENDOR_INVOICE', 'EXPENSE_RECEIPT', 'TRANSPORT_DDT', 'VENDOR_QUOTE'],
    STATUS_: ['QUEUED', 'PROCESSING', 'READY_FOR_REVIEW', 'CONFIRMED', 'FAILED', 'REJECTED'],
    CHANNEL_: ['DMS_UPLOAD', 'TENANT_EMAIL_INBOX', 'MOBILE_CAMERA', 'DESKTOP_SCAN', 'API_WEBHOOK'],
    MATCH_: ['MATCHED', 'VARIANCE', 'UNMATCHED'],
    LINE_CODING_SOURCE_: ['EXACT', 'FUZZY', 'VENDOR_DEFAULT', 'NONE'],
  };
  const providers: OcrProvider[] = [
    'ollama_local',
    'layoutlmv3_local',
    'tesseract_local',
    'gemini_cloud',
    'openai_cloud',
    'azure_document_intelligence',
  ];

  return [
    ...Object.entries(families).flatMap(([prefix, names]) =>
      names.map((name) => `OCR_INBOX.${prefix}${name}`),
    ),
    ...providers.map((provider) => providerKey(provider) as string),
    ...Object.values(BAND_LABEL_KEYS),
  ];
}

describe('AI Inbox translations', () => {
  it('finds the keys of the feature', () => {
    expect(literalKeys()).toContain('OCR_INBOX.CONFIRM');
    expect(literalKeys().length).toBeGreaterThan(60);
  });

  it.skipIf(!hasSeededDictionaries)(
    'has every key in it, en, de and fr with a non-empty text',
    () => {
      const keys = [...new Set([...literalKeys(), ...familyKeys()])];

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

    for (const key of [...new Set([...literalKeys(), ...familyKeys()])]) {
      const variants = new Set(
        SEEDED_LANGUAGES.map((language) => placeholders(seededDictionaries[language]?.[key] ?? '')),
      );

      expect(variants.size, `${key} has different placeholders per language`).toBe(1);
    }
  });
});
