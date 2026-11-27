import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  OBS_CONNECTOR_GROUPS,
  OBS_CONNECTOR_KEYS,
  OBS_CONNECTOR_STATUSES,
  OBS_PLAN_STATUSES,
  OBS_STATEMENT_REASONS,
} from '../../core/models/observability.model';
import {
  hasSeededDictionaries,
  SEEDED_LANGUAGES,
  seededDictionaries,
} from '../../../testing/seeded-dictionaries';

/** Prefixes the code completes with a value (a status, a connector, a reason ...): derivedKeys() lists the full keys. */
const DYNAMIC_PREFIXES = [
  'OBSERVABILITY.GROUP',
  'OBSERVABILITY.KIND',
  'OBSERVABILITY.PLAN_STATUS',
  'OBSERVABILITY.STATUS',
];

const sources = (): string[] =>
  readdirSync(__dirname).filter((file) => file.endsWith('.ts') && !file.endsWith('.spec.ts'));

/** Keys written in full in the sources of the feature (code and templates, not the specs). */
function literalKeys(): string[] {
  const keys = new Set<string>();

  for (const file of sources()) {
    const source = readFileSync(join(__dirname, file), 'utf8');
    for (const match of source.matchAll(/OBSERVABILITY\.[A-Z0-9_.]*[A-Z0-9_]/g)) {
      keys.add(match[0]);
    }
    for (const match of source.matchAll(/(?:NAV|PAGE_TITLE)\.(?:OBSERVABILITY|CONNECTOR)[A-Z_]*/g)) {
      keys.add(match[0]);
    }
  }

  // `OBSERVABILITY.BANNER.MESSAGE_` and the like are prefixes completed at run time.
  return [...keys].filter((key) => !DYNAMIC_PREFIXES.includes(key) && !key.endsWith('_'));
}

/** Keys the code builds from a value, the menu entries and the page titles. */
function derivedKeys(): string[] {
  const upper = (list: readonly string[]) => list.map((value) => value.toUpperCase());
  const group = (name: string, values: readonly string[]) => upper(values).map((value) => `OBSERVABILITY.${name}.${value}`);

  return [
    ...group('STATUS', [...OBS_CONNECTOR_STATUSES, 'unknown']),
    ...group('CONNECTOR', OBS_CONNECTOR_KEYS),
    ...group('GROUP', OBS_CONNECTOR_GROUPS),
    ...group('PLAN_STATUS', OBS_PLAN_STATUSES),
    ...group('KIND', ['slow', 'n_plus_one']),
    ...upper([...OBS_STATEMENT_REASONS, 'unknown']).map((reason) => `OBSERVABILITY.STATEMENTS.REASON_${reason}`),
    ...upper(['degraded', 'outage', 'maintenance']).map((status) => `OBSERVABILITY.BANNER.MESSAGE_${status}`),
    'NAV.OBSERVABILITY',
    'NAV.CONNECTOR_STATUS',
    'NAV.OBSERVABILITY_PROFILER',
    'PAGE_TITLE.CONNECTOR_STATUS',
    'PAGE_TITLE.OBSERVABILITY_PROFILER',
  ];
}

describe('observability translations', () => {
  it('finds the keys of the feature', () => {
    const keys = literalKeys();

    expect(keys.length).toBeGreaterThan(60);
    expect(keys).toContain('OBSERVABILITY.COL.TRACE_ID');
    expect(keys).toContain('OBSERVABILITY.BANNER.LINK');
    expect(new Set(derivedKeys()).size).toBe(derivedKeys().length);
  });

  it('adds no string to the frontend: the sources of the feature carry no dictionary', () => {
    for (const file of sources()) {
      const source = readFileSync(join(__dirname, file), 'utf8');

      expect(source, file).not.toMatch(/translations?\s*[:=]\s*\{\s*['"]?(it|en|de|fr)['"]?\s*:/);
    }
  });

  it('the telemetry and profiler sources hold no user-facing literal in templates', () => {
    const template = readFileSync(join(__dirname, 'profiler-page.component.ts'), 'utf8');

    // Every visible label goes through the translate pipe; the headings of the tables are keys, never bare words.
    expect(template).not.toMatch(/<th[^>]*>\s*[A-Za-z]/);
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
