import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  hasSeededDictionaries,
  SEEDED_LANGUAGES,
  seededDictionaries,
} from '../../../testing/seeded-dictionaries';

const FEATURE_DIR = __dirname;

/** Keys written in full in the sources of the feature (templates and code, not the specs). */
function literalKeys(): string[] {
  const keys = new Set<string>();

  for (const file of readdirSync(FEATURE_DIR)) {
    if (!file.endsWith('.ts') || file.endsWith('.spec.ts') || file.endsWith('.testing.ts')) {
      continue;
    }

    for (const match of readFileSync(join(FEATURE_DIR, file), 'utf8').matchAll(
      /DATA_SOVEREIGNTY\.[A-Z0-9_]+/g,
    )) {
      keys.add(match[0]);
    }
  }

  return [...keys].filter((key) => !key.endsWith('_'));
}

/** Keys the templates build from a value: `STATUS_`, `HEALTH_`, `DECISION_`, `PROVIDER_`, `SERVICE_`, `OP_`. */
function familyKeys(): string[] {
  const families: Record<string, string[]> = {
    STATUS_: ['ACTIVE', 'ROTATING', 'SUSPENDED', 'REVOKED_CRYPTO_SHREDDED'],
    HEALTH_: ['HEALTHY', 'DEGRADED', 'UNKNOWN'],
    DECISION_: ['ALLOWED', 'REQUIRES_SCC_TIA', 'BLOCKED'],
    PROVIDER_: [
      'SECUROSYS_PRIMUS_HSM',
      'AWS_KMS',
      'AZURE_KEY_VAULT',
      'GOOGLE_CLOUD_EKM',
      'HASHICORP_VAULT',
      'KMIP_GENERIC',
      'PLATFORM',
    ],
    SERVICE_: [
      'POSTGRES_PRIMARY',
      'POSTGRES_REPLICAS',
      'S3_DMS',
      'PGVECTOR',
      'AI_INFERENCE',
      'BACKUP_VAULT',
      'QUEUE_BROKER',
    ],
    OP_: [
      'UNWRAP_DEK',
      'WRAP_DEK',
      'ROTATE_KEK',
      'CACHE_HIT',
      'KILL_SWITCH_SUSPEND',
      'KILL_SWITCH_SHRED',
      'KMS_HEALTH_CHECK',
      'ACCESS_DENIED_REVOKED',
    ],
  };

  return Object.entries(families).flatMap(([prefix, names]) =>
    names.map((name) => `DATA_SOVEREIGNTY.${prefix}${name}`),
  );
}

describe('Data sovereignty translations', () => {
  it('finds the keys of the feature', () => {
    expect(literalKeys()).toContain('DATA_SOVEREIGNTY.SUSPEND_ACCESS');
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
