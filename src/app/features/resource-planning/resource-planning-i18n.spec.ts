import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  BOOKING_TYPES,
  CertificationStatus,
  dictionaryLocale,
  HEATMAP_GRANULARITIES,
  UTILIZATION_GROUP_BYS,
} from '@core';
import {
  hasSeededDictionaries,
  SEEDED_LANGUAGES,
  seededDictionaries,
} from '../../../testing/seeded-dictionaries';
import { DialogMode } from './allocation-dialog.component';

/**
 * Prefixes the code completes with a value (a band, a status, an API code): derivedKeys() lists the full keys. The
 * `utilization.status` prefix is also a key of its own (the column header), so it stays a literal key.
 */
const DYNAMIC_PREFIXES = [
  'resourcePlanning.band',
  'resourcePlanning.blocker',
  'resourcePlanning.bookingType',
  'resourcePlanning.certification',
  'resourcePlanning.error',
  'resourcePlanning.granularity',
  'resourcePlanning.utilization.group',
  'resourcePlanning.warning',
];

/** Codes of the contract (docs/mod-079-resource-planning-api.md) the UI translates. */
const ERROR_CODES = [
  'employee_not_found',
  'project_not_allocatable',
  'wbs_node_not_in_project',
  'opportunity_not_open',
  'hard_booking_requires_project',
  'soft_booking_requires_reference',
  'overload',
  'already_hard_committed',
  'invalid_period',
  'no_working_days',
  'certification_code_required',
  'allocation_not_found',
  'skill_not_found',
  'skill_profile_not_found',
  'local_holiday_not_found',
];
const WARNING_CODES = [
  'skill_missing',
  'proficiency_too_low',
  'skill_expired',
  'certificate_missing',
  'certificate_expired',
];
const BLOCKER_CODES = [
  'skill_missing',
  'proficiency_too_low',
  'skill_expired',
  'certificate_missing',
  'certificate_expired',
  'insufficient_availability',
];
const CERTIFICATION_STATUSES: CertificationStatus[] = ['not_required', 'valid', 'missing', 'expired'];
const DIALOG_MODES: DialogMode[] = ['edit', 'split', 'convert'];

/** Keys written in full in the sources of the feature (code and templates, not the specs). */
function literalKeys(): string[] {
  const keys = new Set<string>();

  for (const file of readdirSync(__dirname)) {
    if (
      (!file.endsWith('.ts') && !file.endsWith('.html')) ||
      file.endsWith('.spec.ts') ||
      file.endsWith('.testing.ts')
    ) {
      continue;
    }
    for (const match of readFileSync(join(__dirname, file), 'utf8').matchAll(
      /resourcePlanning\.[A-Za-z0-9_.]*[A-Za-z0-9_]/g,
    )) {
      keys.add(match[0]);
    }
  }

  return [...keys].filter((key) => !DYNAMIC_PREFIXES.includes(key));
}

/** Keys the code builds from a value, the menu entries and the page titles of the routes. */
function derivedKeys(): string[] {
  return [
    ...['green', 'yellow', 'red', 'none'].map((band) => `resourcePlanning.band.${band}`),
    ...BOOKING_TYPES.map((type) => `resourcePlanning.bookingType.${type}`),
    ...HEATMAP_GRANULARITIES.map((granularity) => `resourcePlanning.granularity.${granularity}`),
    ...CERTIFICATION_STATUSES.map((status) => `resourcePlanning.certification.${status}`),
    ...UTILIZATION_GROUP_BYS.map((group) => `resourcePlanning.utilization.group.${group}`),
    ...['on_target', 'below_target', 'above_target'].map(
      (status) => `resourcePlanning.utilization.status.${status}`,
    ),
    ...ERROR_CODES.map((code) => `resourcePlanning.error.${code}`),
    ...WARNING_CODES.map((code) => `resourcePlanning.warning.${code}`),
    ...BLOCKER_CODES.map((code) => `resourcePlanning.blocker.${code}`),
    ...DIALOG_MODES.flatMap((mode) => [
      `resourcePlanning.${mode}.title`,
      `resourcePlanning.${mode}.confirm`,
    ]),
    'NAV.RESOURCE_PLANNING',
    'NAV.RESOURCE_PLANNING_PLANNER',
    'NAV.RESOURCE_PLANNING_UTILIZATION',
    'NAV.RESOURCE_PLANNING_SKILLS',
    'PAGE_TITLE.RESOURCE_PLANNING',
    'PAGE_TITLE.RESOURCE_PLANNING_UTILIZATION',
    'PAGE_TITLE.RESOURCE_PLANNING_SKILLS',
  ];
}

describe('resource planning translations', () => {
  it('finds the keys of the feature', () => {
    expect(literalKeys()).toContain('resourcePlanning.title');
    expect(literalKeys()).toContain('resourcePlanning.candidates.search');
    expect(literalKeys().length).toBeGreaterThan(100);
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

  it.skipIf(!hasSeededDictionaries)('translates the warning codes with the name of the skill', () => {
    for (const language of SEEDED_LANGUAGES) {
      for (const code of WARNING_CODES) {
        expect(seededDictionaries[language]?.[`resourcePlanning.warning.${code}`]).toContain(
          '{skill_name}',
        );
      }
    }
  });

  it('resolves the Swiss and Italian regional dictionaries from the four languages', () => {
    // The API derives it-CH, de-CH, fr-CH and it-IT from the dictionary of the language: the module ships no variant.
    expect(dictionaryLocale('it', 'CH')).toBe('it-CH');
    expect(dictionaryLocale('de', 'CH')).toBe('de-CH');
    expect(dictionaryLocale('fr', 'CH')).toBe('fr-CH');
    expect(dictionaryLocale('it', 'IT')).toBe('it-IT');
    expect(dictionaryLocale('en', 'CH')).toBe('en');
  });
});
