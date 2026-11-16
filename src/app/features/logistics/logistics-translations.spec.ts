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

/**
 * The UI strings live in the API seeders. The keys this feature adds are delivered in
 * docs/i18n/logistics-wms.translations.json (and a paste-ready PHP fragment next to it) until they are merged there.
 */
const delivered = JSON.parse(
  readFileSync(resolve(process.cwd(), 'docs/i18n/logistics-wms.translations.json'), 'utf8'),
) as Record<Locale, Record<string, string>>;

const placeholders = (text: string): string =>
  [...text.matchAll(/\{\w+}/g)]
    .map((m) => m[0])
    .sort()
    .join();

describe('logistics WMS translations', () => {
  it('delivers every key in English, Italian, German and French', () => {
    const reference = Object.keys(delivered.en).sort();
    for (const locale of LOCALES) {
      expect(Object.keys(delivered[locale]).sort()).toEqual(reference);
    }
  });

  it('has no empty text and keeps the placeholders of the English text', () => {
    for (const locale of LOCALES) {
      for (const [key, text] of Object.entries(delivered[locale])) {
        expect(text.trim(), `${locale} ${key}`).not.toBe('');
        expect(placeholders(text), `${locale} ${key}`).toBe(placeholders(delivered.en[key]));
      }
    }
  });

  it('translates long German and French texts instead of copying the English ones', () => {
    for (const locale of ['de', 'fr'] as const) {
      const copied = Object.entries(delivered[locale]).filter(
        ([key, text]) => text === delivered.en[key] && text.length > 25,
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
    // Keys that already existed before this feature are served by the seeder, the rest must be delivered here.
    const preExisting = new Set([
      ...TRANSFER_PURPOSES.filter((p) =>
        ['inter_warehouse', 'technician_van', 'customer_consignment', 'subcontracting'].includes(p),
      ).map(transferPurposeKey),
      ...DISCREPANCY_RESOLUTIONS.map(discrepancyKey),
      ...CARRIAGE_TERMS.map(carriageKey),
      ...TRANSPORT_BY.map(transportByKey),
    ]);
    const missing = derived.filter((key) => !preExisting.has(key) && !(key in delivered.en));
    expect(missing).toEqual([]);
  });
});
