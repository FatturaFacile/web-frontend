import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  DC_BATCH_STATUSES,
  DC_CHANNELS,
  DC_DOSSIER_STATUSES,
  DC_EXCLUSION_REASONS,
  DC_EXCLUSION_TYPES,
  DC_INTEREST_BASES,
  DC_INTEREST_KINDS,
  DC_JURISDICTIONS,
  DC_LEVELS,
  DC_LOCALES,
  DC_NOTICE_KINDS,
  DC_NOTICE_STATUSES,
  DC_PLAN_STATUSES,
  DC_PROPOSAL_STATUSES,
  DC_RECEIPT_KINDS,
} from '@core';
import {
  hasSeededDictionaries,
  SEEDED_LANGUAGES,
  seededDictionaries,
} from '../../../testing/seeded-dictionaries';
import { DEBT_COLLECTION_TABS } from './debt-collection.component';

/** Prefixes the code completes with a value (an enum value, an event, an API code): derivedKeys() lists the full keys. */
const DYNAMIC_PREFIXES = [
  'debtCollection.batchStatus',
  'debtCollection.channel',
  'debtCollection.dossierStatus',
  'debtCollection.error',
  'debtCollection.event',
  'debtCollection.exclusionReason',
  'debtCollection.exclusionType',
  'debtCollection.interestBasis',
  'debtCollection.interestKind',
  'debtCollection.jurisdiction',
  'debtCollection.level',
  'debtCollection.locale',
  'debtCollection.noticeKind',
  'debtCollection.noticeStatus',
  'debtCollection.planStatus',
  'debtCollection.proposalStatus',
  'debtCollection.receiptKind',
  'debtCollection.tab',
];

/** Codes of the contract the UI translates (the problem `code` of the module). */
const ERROR_CODES = [
  'generic',
  'forbidden',
  'item_not_found',
  'item_excluded',
  'item_settled',
  'invalid_level',
  'no_policy',
  'no_channel_address',
  'notice_not_sendable',
  'notice_not_cancellable',
  'pec_required',
  'receipt_not_allowed',
  'batch_not_retryable',
  'dossier_no_office',
  'wrong_jurisdiction',
  'dossier_not_submittable',
  'exclusion_already_released',
  'plan_invalid_schedule',
  'plan_not_active',
  'global_readonly',
  'policy_in_use',
  'mixed_currency',
];

/** Events of the dunning timeline of a customer the UI translates. */
const EVENT_CODES = [
  'notice_generated',
  'notice_sent',
  'notice_delivered',
  'notice_failed',
  'notice_cancelled',
  'receipt_registered',
  'level_changed',
  'exclusion_created',
  'exclusion_released',
  'plan_created',
  'plan_completed',
  'plan_defaulted',
  'plan_cancelled',
  'dossier_generated',
  'dossier_submitted',
  'messa_in_mora_sent',
  'interest_accrued',
  'fee_charged',
];

const FEATURE_DIR = __dirname;
const SOURCES = [
  ...readdirSync(FEATURE_DIR)
    .filter(
      (file) => file.endsWith('.ts') && !file.endsWith('.spec.ts') && !file.endsWith('.testing.ts'),
    )
    .map((file) => join(FEATURE_DIR, file)),
  join(FEATURE_DIR, '..', 'crm', 'clients', 'customer-360.component.ts'),
  join(FEATURE_DIR, '..', '..', 'layout', 'sidebar', 'menu-sections.ts'),
];

/** Keys written in full in the sources of the feature (code and templates, not the specs). */
function literalKeys(): string[] {
  const keys = new Set<string>();
  for (const file of SOURCES) {
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(/debtCollection\.[A-Za-z0-9_.]*[A-Za-z0-9_]/g)) {
      keys.add(match[0]);
    }
  }
  return [...keys].filter((key) => !DYNAMIC_PREFIXES.includes(key));
}

/** Keys the code builds from a value. */
function derivedKeys(): string[] {
  const values = (group: string, list: readonly (string | number)[]) =>
    list.map((value) => `debtCollection.${group}.${value}`);

  return [
    ...values('batchStatus', DC_BATCH_STATUSES),
    ...values('channel', DC_CHANNELS),
    ...values('dossierStatus', DC_DOSSIER_STATUSES),
    ...values('error', ERROR_CODES),
    ...values('event', EVENT_CODES),
    ...values('exclusionReason', DC_EXCLUSION_REASONS),
    ...values('exclusionType', DC_EXCLUSION_TYPES),
    ...values('interestBasis', DC_INTEREST_BASES),
    ...values('interestKind', DC_INTEREST_KINDS),
    ...values('jurisdiction', DC_JURISDICTIONS),
    ...values('level', [...DC_LEVELS, 'none']),
    ...values('locale', DC_LOCALES),
    ...values('noticeKind', DC_NOTICE_KINDS),
    ...values('noticeStatus', DC_NOTICE_STATUSES),
    ...values('planStatus', DC_PLAN_STATUSES),
    ...values('proposalStatus', DC_PROPOSAL_STATUSES),
    ...values('receiptKind', DC_RECEIPT_KINDS),
    ...values('tab', DEBT_COLLECTION_TABS),
  ];
}

describe('debt collection translations', () => {
  it('finds the keys of the feature', () => {
    expect(literalKeys()).toContain('debtCollection.title');
    expect(literalKeys()).toContain('debtCollection.nav.title');
    expect(literalKeys()).toContain('debtCollection.customer.tab');
    expect(literalKeys().length).toBeGreaterThan(150);
  });

  it('never falls back to a text written in the sources', () => {
    for (const file of SOURCES) {
      expect(readFileSync(file, 'utf8'), file).not.toMatch(/translateOr\(/);
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
