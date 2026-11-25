import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ESIG_ASSURANCES,
  ESIG_AUDIT_EVENTS,
  ESIG_AUTH_METHODS,
  ESIG_ENVELOPE_STATUSES,
  ESIG_ID_DOCUMENT_TYPES,
  ESIG_JURISDICTIONS,
  ESIG_LEVELS,
  ESIG_PROVIDER_JURISDICTIONS,
  ESIG_PROVIDERS,
  ESIG_RECIPIENT_STATUSES,
  ESIG_ROLES,
  ESIG_ROUTING_MODES,
  ESIG_SIGNABLE_TYPES,
} from '@core';
import { ESIG_CREDENTIAL_FIELDS } from './e-signature.util';
import {
  hasSeededDictionaries,
  SEEDED_LANGUAGES,
  seededDictionaries,
} from '../../../testing/seeded-dictionaries';

/** Prefixes the code completes with a value (an enum value, a code the API reports): derivedKeys() lists the full keys. */
const DYNAMIC_PREFIXES = [
  'signatures.assurance',
  'signatures.assuranceHint',
  'signatures.audit',
  'signatures.audit.actor',
  'signatures.authMethod',
  'signatures.center.kpi',
  'signatures.credential',
  'signatures.error',
  'signatures.idDocument',
  'signatures.jurisdictionBadge',
  'signatures.levelHint',
  'signatures.levelLong',
  'signatures.portal.identity',
  'signatures.provider',
  'signatures.providerJurisdiction',
  'signatures.recipientStatus',
  'signatures.role',
  'signatures.routing',
  'signatures.signableType',
  'signatures.status',
  'signatures.test',
];

/** Not translation keys: array lengths and similar property reads that look like one. */
const NOT_KEYS = ['signatures.length', 'signatures.open'];

/** Codes the UI translates itself: the ones its own checks raise and the fallback of the API. */
const ERROR_CODES = [
  'generic',
  'no_signer',
  'duplicate_recipient',
  'strong_authentication_required',
  'link_invalid',
];

const TEST_CODES = [
  'reachable',
  'authenticated',
  'sandbox_ok',
  'seal_ready',
  'seal_system_managed',
  'system_managed',
  'credentials_missing',
  'credentials_rejected',
  'provider_rejected',
  'unreachable',
];

const KPIS = ['pending', 'completedThisMonth', 'expiringSoon', 'declinedOrFailed'];

/** Keys written in full in the sources of the feature (code and templates, not the specs). */
function literalKeys(): string[] {
  const keys = new Set<string>();

  for (const file of readdirSync(__dirname)) {
    if (!file.endsWith('.ts') || file.endsWith('.spec.ts')) {
      continue;
    }
    const source = readFileSync(join(__dirname, file), 'utf8');
    for (const match of source.matchAll(/signatures\.[A-Za-z0-9_.]*[A-Za-z0-9_]/g)) {
      keys.add(match[0]);
    }
    for (const match of source.matchAll(/(?:NAV|PAGE_TITLE)\.SIGNATURES[A-Z_]*/g)) {
      keys.add(match[0]);
    }
  }

  return [...keys].filter((key) => !DYNAMIC_PREFIXES.includes(key) && !NOT_KEYS.includes(key));
}

/** Keys the code builds from a value, the menu entries and the page titles of the routes. */
function derivedKeys(): string[] {
  const values = (group: string, list: readonly string[]) =>
    list.map((value) => `signatures.${group}.${value}`);

  return [
    ...values('assurance', ESIG_ASSURANCES),
    ...values('assuranceHint', ESIG_ASSURANCES),
    ...values('audit', ESIG_AUDIT_EVENTS),
    ...values('audit.actor', ['user', 'recipient', 'system', 'provider']),
    ...values('authMethod', ESIG_AUTH_METHODS),
    ...values('portal.identity', ESIG_AUTH_METHODS),
    ...values('center.kpi', KPIS),
    ...values('credential', [
      ...new Set(
        Object.values(ESIG_CREDENTIAL_FIELDS).flatMap((fields) => fields.map((field) => field.key)),
      ),
    ]),
    ...values('error', ERROR_CODES),
    ...values('idDocument', ESIG_ID_DOCUMENT_TYPES),
    ...values('jurisdictionBadge', ESIG_JURISDICTIONS),
    ...values('levelHint', ESIG_LEVELS),
    ...values('levelLong', ESIG_LEVELS),
    ...values('provider', ESIG_PROVIDERS),
    ...values('providerJurisdiction', ESIG_PROVIDER_JURISDICTIONS),
    ...values('recipientStatus', ESIG_RECIPIENT_STATUSES),
    ...values('role', ESIG_ROLES),
    ...values('routing', ESIG_ROUTING_MODES),
    ...values('signableType', ESIG_SIGNABLE_TYPES),
    ...values('status', ESIG_ENVELOPE_STATUSES),
    ...values('test', TEST_CODES),
    'NAV.SIGNATURES',
    'NAV.SIGNATURES_CENTER',
    'NAV.SIGNATURES_SETTINGS',
    'PAGE_TITLE.SIGNATURES_CENTER',
    'PAGE_TITLE.SIGNATURES_SETTINGS',
    'PAGE_TITLE.SIGNATURES_PORTAL',
    'PAGE_TITLE.SIGNATURES_VERIFY',
  ];
}

describe('electronic signature translations', () => {
  it('finds the keys of the feature', () => {
    expect(literalKeys()).toContain('signatures.wizard.title');
    expect(literalKeys()).toContain('signatures.verify.title');
    expect(literalKeys()).toContain('PAGE_TITLE.SIGNATURES_CENTER');
    expect(literalKeys().length).toBeGreaterThan(100);
  });

  it('never falls back to a text written in the sources', () => {
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
