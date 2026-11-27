import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  DP_CALCULATION_MODES,
  DP_CHAIN_STATUSES,
  DP_CREDIT_MODES,
  DP_DEPOSIT_STATUSES,
  DP_DEPOSIT_TYPES,
  DP_INSTALLMENT_STATUSES,
  DP_INSTRUMENTS,
  DP_JOURNAL_ACCOUNTS,
  DP_JURISDICTIONS,
  DP_LINK_STATUSES,
  DP_LINK_TYPES,
  DP_PAYMENT_ACCOUNTS,
  DP_PRESETS,
  DP_REFUND_MODES,
  DP_RESOLUTIONS,
  DP_SETTLEMENT_TYPES,
  DP_SOURCE_TYPES,
  DP_TRIGGERS,
} from '@core';
import {
  hasSeededDictionaries,
  SEEDED_LANGUAGES,
  seededDictionaries,
} from '../../../testing/seeded-dictionaries';

/** Prefixes the code completes with a value (an enum value, a code the API reports): derivedKeys() lists the full keys. */
const DYNAMIC_PREFIXES = [
  'down_payments.account',
  'down_payments.creditMode',
  'down_payments.depositStatus',
  'down_payments.depositType',
  'down_payments.error',
  'down_payments.hint',
  'down_payments.installmentStatus',
  'down_payments.instrument',
  'down_payments.jurisdiction',
  'down_payments.linkStatus',
  'down_payments.linkType',
  'down_payments.matrix',
  'down_payments.mode',
  'down_payments.paymentAccount',
  'down_payments.preset',
  'down_payments.refundMode',
  'down_payments.resolution',
  'down_payments.settlementType',
  'down_payments.sourceType',
  'down_payments.status',
  'down_payments.trigger',
];

/** Codes the UI translates itself and the ones the API reports (`down_payments.errors` of the backend dictionary). */
const ERROR_CODES = [
  'generic',
  'source_not_found',
  'source_has_nothing_to_bill',
  'contract_requires_customer',
  'customer_not_found',
  'chain_exists_for_source',
  'chain_has_documents',
  'chain_closed',
  'chain_already_settled',
  'plan_requires_installments',
  'plan_template_unknown',
  'plan_exceeds_contract',
  'installment_invalid_instrument',
  'installment_invalid_mode',
  'installment_invalid_trigger',
  'installment_invalid_amount',
  'installment_not_planned',
  'advance_exceeds_residual',
  'advance_line_missing',
  'advance_not_creditable',
  'link_not_a_proforma',
  'link_not_an_advance',
  'proforma_not_open',
  'deposit_amount_invalid',
  'deposit_already_collected',
  'deposit_not_held',
  'deposit_vat_split_not_exact',
  'double_refund_only_for_earnest_money',
  'credit_mode_invalid',
  'credit_amount_invalid',
  'credit_line_invalid',
  'credit_nothing_open',
  'credit_exceeds_advance',
  'open_proformas',
  'held_earnest_money',
  'nothing_left_to_settle',
];

const sources = (): string[] =>
  readdirSync(__dirname).filter((file) => file.endsWith('.ts') && !file.endsWith('.spec.ts'));

/** Keys written in full in the sources of the feature (code and templates, not the specs). */
function literalKeys(): string[] {
  const keys = new Set<string>();

  for (const file of sources()) {
    const source = readFileSync(join(__dirname, file), 'utf8');
    for (const match of source.matchAll(/down_payments\.[A-Za-z0-9_.]*[A-Za-z0-9_]/g)) {
      keys.add(match[0]);
    }
    for (const match of source.matchAll(/(?:NAV|PAGE_TITLE)\.DOWN_PAYMENTS[A-Z_]*/g)) {
      keys.add(match[0]);
    }
  }

  return [...keys].filter((key) => !DYNAMIC_PREFIXES.includes(key));
}

/** Keys the code builds from a value, the menu entries and the page titles of the routes. */
function derivedKeys(): string[] {
  const values = (group: string, list: readonly string[]) =>
    list.map((value) => `down_payments.${group}.${value}`);

  return [
    ...values('account', DP_JOURNAL_ACCOUNTS),
    ...values('creditMode', DP_CREDIT_MODES),
    ...values('depositStatus', DP_DEPOSIT_STATUSES),
    ...values('depositType', DP_DEPOSIT_TYPES),
    ...values('error', ERROR_CODES),
    ...values('hint', DP_RESOLUTIONS),
    ...values('installmentStatus', DP_INSTALLMENT_STATUSES),
    ...values('instrument', DP_INSTRUMENTS),
    ...values('jurisdiction', DP_JURISDICTIONS),
    ...values('linkStatus', DP_LINK_STATUSES),
    ...values('linkType', DP_LINK_TYPES),
    ...values('matrix', ['net', 'vat', 'gross']),
    ...values('mode', DP_CALCULATION_MODES),
    ...values('paymentAccount', DP_PAYMENT_ACCOUNTS),
    ...values('preset', [...DP_PRESETS, 'custom']),
    ...values('refundMode', DP_REFUND_MODES),
    ...values('resolution', DP_RESOLUTIONS),
    ...values('settlementType', DP_SETTLEMENT_TYPES),
    ...values('sourceType', DP_SOURCE_TYPES),
    ...values('status', DP_CHAIN_STATUSES),
    ...values('trigger', DP_TRIGGERS),
    'NAV.DOWN_PAYMENTS',
    'NAV.DOWN_PAYMENTS_CHAINS',
    'NAV.DOWN_PAYMENTS_CHAIN_DETAIL',
    'PAGE_TITLE.DOWN_PAYMENTS_CHAINS',
    'PAGE_TITLE.DOWN_PAYMENTS_CHAIN_DETAIL',
  ];
}

describe('down payments translations', () => {
  it('finds the keys of the feature', () => {
    const keys = literalKeys();

    expect(keys.length).toBeGreaterThan(100);
    expect(keys).toContain('down_payments.notice.itBody');
    expect(keys).toContain('down_payments.section.linkedDocuments');
    expect(new Set(derivedKeys()).size).toBe(derivedKeys().length);
  });

  it('adds no string to the frontend: the sources of the feature carry no dictionary', () => {
    for (const file of sources()) {
      const source = readFileSync(join(__dirname, file), 'utf8');

      expect(source, file).not.toMatch(/translations?\s*[:=]\s*\{\s*['"]?(it|en|de|fr)['"]?\s*:/);
    }
  });

  for (const language of SEEDED_LANGUAGES) {
    it.skipIf(!hasSeededDictionaries)(`has every key in the seeded ${language} dictionary`, () => {
      const dictionary = seededDictionaries[language] ?? {};
      const missing = [...literalKeys(), ...derivedKeys()].filter(
        (key) => !(key in dictionary) || dictionary[key].trim() === '',
      );

      expect(missing).toEqual([]);
    });
  }
});
