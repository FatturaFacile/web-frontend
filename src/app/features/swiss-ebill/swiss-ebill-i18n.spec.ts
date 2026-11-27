import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  EBILL_CHANNEL_TYPES,
  EBILL_CONNECTION_STATUSES,
  EBILL_KPI_STAGES,
  EBILL_LOOKUP_TYPES,
  EBILL_PARTICIPANT_STATUSES,
  EBILL_PROTOCOLS,
  EBILL_PROVIDERS,
  EBILL_REJECTION_CODES,
  EBILL_TRANSMISSION_STATUSES,
  EBILL_WEBHOOK_AUTH_MODES,
} from '@core';
import {
  hasSeededDictionaries,
  SEEDED_LANGUAGES,
  seededDictionaries,
} from '../../../testing/seeded-dictionaries';

/** Prefixes the code completes with a value (an enum value, a code the API reports): derivedKeys() lists the full keys. */
const DYNAMIC_PREFIXES = [
  'swissEbill.badge',
  'swissEbill.channel',
  'swissEbill.connection',
  'swissEbill.error',
  'swissEbill.event',
  'swissEbill.kpi',
  'swissEbill.lookupType',
  'swissEbill.participant',
  'swissEbill.protocol',
  'swissEbill.provider',
  'swissEbill.rejection',
  'swissEbill.source',
  'swissEbill.status',
  'swissEbill.statusHint',
  'swissEbill.violation',
  'swissEbill.webhookAuth',
];

/** Pre-flight violations the API reports (`swiss_ebill.violations`). */
const VIOLATIONS = [
  'ebill_disabled',
  'biller_id_missing',
  'biller_id_invalid',
  'invoice_not_issued',
  'currency_unsupported',
  'due_date_missing',
  'lines_missing',
  'vat_rate_unsupported',
  'biller_uid_missing',
  'biller_uid_invalid',
  'biller_iban_missing',
  'qr_bill_invalid',
  'recipient_missing',
  'recipient_ebill_id_missing',
  'recipient_not_enrolled',
  'recipient_uid_missing',
  'recipient_name_missing',
  'recipient_address_missing',
  'payload_too_large',
  'xml_malformed',
  'xsd_invalid',
];

/** Codes the API answers a refusal with (`swiss_ebill.errors`) plus the fallback of the UI. */
const ERROR_CODES = [
  'ebill_disabled',
  'not_configured',
  'already_transmitted',
  'cannot_revise',
  'cannot_retry',
  'cannot_cancel',
  'gateway_error',
  'gateway_unavailable',
  'payload_invalid',
  'invalid_transition',
  'participant_not_found',
  'invalid_lookup_value',
  'payload_unavailable',
  'sandbox_not_allowed',
  'invalid_biller_id',
  'unknown',
];

const EVENTS = [
  'prepared',
  'queued',
  'transmitted',
  'delivered_to_ebanking',
  'approved_by_debtor',
  'rejected_by_debtor',
  'failed_technical',
  'paid_reconciled',
  'cancelled',
  'retry_scheduled',
  'retry_requested',
  'partial_settlement',
  'payload_downloaded',
];

const SOURCES = ['system', 'user', 'gateway_webhook', 'gateway_poll', 'camt054'];
const BADGES = [
  'active_b2b',
  'active_b2c',
  'not_enrolled',
  'not_verified',
  'pending_opt_in',
  'suspended',
];

/** Sources that carry keys of the feature: its own files and the screens it is plugged into. */
function sourceFiles(): string[] {
  const own = readdirSync(__dirname)
    .filter((file) => file.endsWith('.ts') && !file.endsWith('.spec.ts'))
    .map((file) => join(__dirname, file));
  const screens = [
    '../crm/clients/clients.component.ts',
    '../crm/clients/clients.component.html',
    '../crm/clients/customer-360.component.ts',
    '../sales/components/invoices/invoices.component.ts',
    '../sales/components/invoices/invoices.component.html',
    '../sales/components/invoices/invoice-detail-modal.component.ts',
  ].map((file) => join(__dirname, file));

  return [...own, ...screens];
}

/** Keys written in full in the sources (code and templates, not the specs). */
function literalKeys(): string[] {
  const keys = new Set<string>();

  for (const file of sourceFiles()) {
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(/swissEbill\.[A-Za-z0-9_.]*[A-Za-z0-9_]/g)) {
      keys.add(match[0]);
    }
    for (const match of source.matchAll(/(?:NAV|PAGE_TITLE)\.SWISS_EBILL[A-Z_]*/g)) {
      keys.add(match[0]);
    }
  }

  return [...keys].filter((key) => !DYNAMIC_PREFIXES.includes(key));
}

/** Keys the code builds from a value. */
function derivedKeys(): string[] {
  const values = (group: string, list: readonly string[]) =>
    list.map((value) => `swissEbill.${group}.${value}`);

  return [
    ...values('badge', BADGES),
    ...values('channel', EBILL_CHANNEL_TYPES),
    ...values('connection', EBILL_CONNECTION_STATUSES),
    ...values('error', ERROR_CODES),
    ...values('event', EVENTS),
    ...values('kpi', EBILL_KPI_STAGES),
    ...values('lookupType', EBILL_LOOKUP_TYPES),
    ...values('participant', EBILL_PARTICIPANT_STATUSES),
    ...values('protocol', EBILL_PROTOCOLS),
    ...values('provider', EBILL_PROVIDERS),
    ...EBILL_REJECTION_CODES.flatMap((code) => [
      `swissEbill.rejection.${code}.title`,
      `swissEbill.rejection.${code}.hint`,
    ]),
    ...values('source', SOURCES),
    ...values('status', EBILL_TRANSMISSION_STATUSES),
    ...values('statusHint', EBILL_TRANSMISSION_STATUSES),
    ...values('violation', VIOLATIONS),
    ...values('webhookAuth', EBILL_WEBHOOK_AUTH_MODES),
    'NAV.SWISS_EBILL',
    'NAV.SWISS_EBILL_DASHBOARD',
    'NAV.SWISS_EBILL_SETTINGS',
    'PAGE_TITLE.SWISS_EBILL_DASHBOARD',
    'PAGE_TITLE.SWISS_EBILL_SETTINGS',
  ];
}

describe('swiss eBill translations', () => {
  it('finds the keys of the feature', () => {
    const keys = literalKeys();

    expect(keys.length).toBeGreaterThan(40);
    expect(keys).toContain('swissEbill.action.testConnection');
    expect(keys).toContain('swissEbill.confirm.bulk.body');
    expect(new Set(derivedKeys()).size).toBe(derivedKeys().length);
  });

  it('adds no string to the frontend: the sources of the feature carry no dictionary', () => {
    for (const file of readdirSync(__dirname)) {
      if (!file.endsWith('.ts') || file.endsWith('.spec.ts')) {
        continue;
      }
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
