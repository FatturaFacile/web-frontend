import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AUDIT_CATEGORIES, AUDIT_CHANNELS } from '@core';
import {
  hasSeededDictionaries,
  SEEDED_LANGUAGES,
  seededDictionaries,
} from '../../../../../testing/seeded-dictionaries';

/** Prefixes the code completes with a value; derivedKeys() lists the full keys. */
const DYNAMIC_PREFIXES = [
  'audit.actions',
  'audit.export.status',
  'audit.integrity.run',
  'audit.integrity.status',
  'settings.audit.category',
  'settings.audit.channel',
];

/** Actions the UI labels: the ones the ledger records (audit.actions.<ACTION>) plus the fallback. */
const ACTIONS = [
  'CREATED',
  'UPDATED',
  'DELETED',
  'RESTORED',
  'VIEWED',
  'SENSITIVE_VIEWED',
  'EXPORTED',
  'DOWNLOADED',
  'PRINTED',
  'APPROVED',
  'REJECTED',
  'CANCELLED',
  'BOOKED',
  'ISSUED',
  'SDI_SENT',
  'SDI_OUTCOME',
  'LOGIN_SUCCESS',
  'LOGIN_FAILED',
  'LOGIN_RATE_LIMITED',
  'LOGOUT',
  'TENANT_RESTORED',
  'AUDIT_EXPORT_REQUESTED',
  'AUDIT_EXPORT_DOWNLOADED',
  'AUDIT_INTEGRITY_VERIFIED',
  'AUDIT_KEY_ROTATED',
  'AUDIT_SUBJECT_ERASED',
  'unknown',
];

const SOURCE_KEY = /(?:settings\.audit|audit\.(?:integrity|export|history|actions))\.[A-Za-z0-9_.]*[A-Za-z0-9_]/g;

function sources(): string[] {
  return readdirSync(__dirname)
    .filter((file) => file.endsWith('.ts') && !file.endsWith('.spec.ts'))
    .map((file) => readFileSync(join(__dirname, file), 'utf8'));
}

function literalKeys(): string[] {
  const keys = new Set<string>();
  for (const source of sources()) {
    for (const match of source.matchAll(SOURCE_KEY)) {
      keys.add(match[0]);
    }
  }
  return [...keys].filter((key) => !DYNAMIC_PREFIXES.includes(key) && key !== 'audit.actions.');
}

function derivedKeys(): string[] {
  return [
    ...ACTIONS.map((action) => `audit.actions.${action}`),
    ...['queued', 'running', 'completed', 'failed'].map((s) => `audit.export.status.${s}`),
    ...['queued', 'running', 'completed', 'failed'].map((s) => `audit.integrity.run.${s}`),
    ...['valid', 'broken_at', 'missing_range', 'never_verified', 'running'].map(
      (s) => `audit.integrity.status.${s}`,
    ),
    ...AUDIT_CATEGORIES.map((c) => `settings.audit.category.${c}`),
    ...AUDIT_CHANNELS.map((c) => `settings.audit.channel.${c}`),
    'settings.audit.nav',
  ];
}

describe('audit ledger translations', () => {
  it('finds the keys of the feature', () => {
    const keys = literalKeys();

    expect(keys.length).toBeGreaterThan(40);
    expect(keys).toContain('settings.audit.title');
    expect(keys).toContain('audit.integrity.verify_now');
    expect(keys).toContain('audit.history.title');
    expect(new Set(derivedKeys()).size).toBe(derivedKeys().length);
  });

  it('adds no string to the frontend: the sources of the feature carry no dictionary', () => {
    for (const source of sources()) {
      expect(source).not.toMatch(/translations?\s*[:=]\s*\{\s*['"]?(it|en|de|fr)['"]?\s*:/);
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
