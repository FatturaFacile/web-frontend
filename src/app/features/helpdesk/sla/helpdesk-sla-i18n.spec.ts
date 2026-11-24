import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { HELPDESK_LOCALES } from '@core';
import {
  hasSeededDictionaries,
  SEEDED_LANGUAGES,
  seededDictionaries,
} from '../../../../testing/seeded-dictionaries';
import { HELPDESK_SLA_ADMIN_PAGE, HOLIDAY_REGION_OPTIONS } from '../helpdesk-sla-admin.page';

const DIRECTORIES = [
  __dirname,
  join(__dirname, '..', '..', 'field-service', 'components', 'ticket-detail-drawer'),
  join(__dirname, '..', '..', 'field-service', 'components', 'ticket-agent-tools'),
  join(__dirname, '..', '..', 'field-service'),
];

/** Keys written in full in the sources of the feature (code and templates, not the specs). */
function literalKeys(): string[] {
  const keys = new Set<string>();

  for (const directory of DIRECTORIES) {
    for (const file of readdirSync(directory)) {
      if ((!file.endsWith('.ts') && !file.endsWith('.html')) || file.endsWith('.spec.ts')) {
        continue;
      }
      for (const match of readFileSync(join(directory, file), 'utf8').matchAll(
        /HELPDESK_SLA\.[A-Z0-9_]+/g,
      )) {
        keys.add(match[0]);
      }
    }
  }

  // Prefixes the templates complete with a value; derivedKeys() lists the full keys.
  return [...keys].filter((key) => !key.endsWith('_'));
}

/** Keys the templates build from a value, and the labels of the declarative admin page. */
function derivedKeys(): string[] {
  const fromValues = [
    ...['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((value) => `HELPDESK_SLA.PRIORITY_${value}`),
    ...['NEW', 'OPEN', 'PENDING_CUSTOMER', 'ON_HOLD'].map(
      (value) => `HELPDESK_SLA.STATUS_${value}`,
    ),
    ...['QUEUE', 'PRIORITY', 'CONTRACT'].map((value) => `HELPDESK_SLA.GROUP_${value}`),
    ...HELPDESK_LOCALES.map(
      (code) => `HELPDESK_SLA.LOCALE_${code.replace('-', '_').toUpperCase()}`,
    ),
    ...HELPDESK_LOCALES.filter((code) => code !== 'en').map((code) => `RES.V.${code}`),
    ...HOLIDAY_REGION_OPTIONS.map((code) => `RES.V.${code}`),
  ];
  const fromPage = [
    HELPDESK_SLA_ADMIN_PAGE.titleKey,
    ...HELPDESK_SLA_ADMIN_PAGE.tabs.map((tab) => tab.titleKey),
    ...HELPDESK_SLA_ADMIN_PAGE.tabs
      .flatMap((tab) => [tab.create, ...(tab.toolbar ?? [])])
      .flatMap((action) => (action ? [action.labelKey] : [])),
    'RES.F.sla_policy_id',
    'RES.F.threshold_percent',
    'RES.F.notify_user_ids',
    'RES.F.notify_team_lead',
    'RES.F.escalation_chain_id',
    'RES.F.next_update_interval_minutes',
    'RES.F.pause_on_on_hold',
    'RES.F.locale',
    'RES.F.holiday_country',
    'RES.F.holiday_region',
    'RES.F.region',
    'RES.F.dates',
    'RES.V.notify',
    'RES.V.reassign_team',
    'RES.V.raise_priority',
    'RES.V.response',
    'RES.V.next_update',
    'RES.V.resolution',
    'NAV.HD_SLA',
    'NAV.HD_SLA_ADMIN',
  ];
  return [...fromValues, ...fromPage];
}

describe('helpdesk SLA translations', () => {
  it('finds the keys of the feature', () => {
    expect(literalKeys()).toContain('HELPDESK_SLA.TITLE');
    expect(literalKeys().length).toBeGreaterThan(80);
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
