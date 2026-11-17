import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  DISCREPANCY_RESOLUTIONS,
  TRANSFER_PURPOSES,
  VALUATION_BUCKETS,
  CARRIAGE_TERMS,
  TRANSPORT_BY,
} from '@core';
import { hasSeededDictionaries, seededDictionaries } from '../../../testing/seeded-dictionaries';
import { MOVEMENT_TYPE_FILTERS, STATUS_FILTERS, TRACKER_STEPS } from './logistics.rules';
import {
  carriageKey,
  discrepancyKey,
  movementTypeKey,
  statusFilterKey,
  trackerStepKey,
  transferPurposeKey,
  transferStatusKey,
  transportByKey,
  valuationBucketHintKey,
  valuationBucketKey,
} from './logistics.ui';

type Locale = 'en' | 'it' | 'de' | 'fr';
const LOCALES: Locale[] = ['en', 'it', 'de', 'fr'];

/** The UI strings live only in the API seeders; they are read from the sibling `web-api` project (skipped without it). */
const delivered = seededDictionaries as Record<Locale, Record<string, string>>;
const logisticsKeys = (locale: Locale): string[] =>
  Object.keys(delivered[locale] ?? {}).filter((key) => key.startsWith('LOGISTICS.'));

const placeholders = (text: string): string =>
  [...text.matchAll(/\{\w+}/g)]
    .map((m) => m[0])
    .sort()
    .join();

describe.skipIf(!hasSeededDictionaries)('logistics WMS translations', () => {
  it('seeds every key in English, Italian, German and French', () => {
    const reference = logisticsKeys('en').sort();
    for (const locale of LOCALES) {
      expect(logisticsKeys(locale).sort()).toEqual(reference);
    }
  });

  it('has no empty text and keeps the placeholders of the English text', () => {
    for (const locale of LOCALES) {
      for (const [key, text] of Object.entries(delivered[locale]).filter(([k]) => k.startsWith('LOGISTICS.'))) {
        expect(text.trim(), `${locale} ${key}`).not.toBe('');
        expect(placeholders(text), `${locale} ${key}`).toBe(placeholders(delivered.en[key]));
      }
    }
  });

  it('translates long German and French texts instead of copying the English ones', () => {
    for (const locale of ['de', 'fr'] as const) {
      const copied = Object.entries(delivered[locale]).filter(
        ([key, text]) => key.startsWith('LOGISTICS.') && text === delivered.en[key] && text.length > 25,
      );
      expect(copied).toEqual([]);
    }
  });

  it('covers every key derived from the enums and helpers of the screens', () => {
    const derived = [
      ...TRANSFER_PURPOSES.map(transferPurposeKey),
      ...MOVEMENT_TYPE_FILTERS.map(movementTypeKey),
      ...STATUS_FILTERS.map(statusFilterKey),
      ...TRACKER_STEPS.map(trackerStepKey),
      ...DISCREPANCY_RESOLUTIONS.map(discrepancyKey),
      ...CARRIAGE_TERMS.map(carriageKey),
      ...TRANSPORT_BY.map(transportByKey),
      ...VALUATION_BUCKETS.flatMap((b) => [valuationBucketKey(b), valuationBucketHintKey(b)]),
      ...(['approved', 'partially_received', 'closed'] as const).map(transferStatusKey),
    ];
    const missing = derived.filter((key) => !(key in delivered.en));
    expect(missing).toEqual([]);
  });
});
