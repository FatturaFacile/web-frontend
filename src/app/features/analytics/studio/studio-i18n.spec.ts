import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  hasSeededDictionaries,
  SEEDED_LANGUAGES,
  seededDictionaries,
} from '../../../../testing/seeded-dictionaries';
import {
  CHART_KEYS,
  COLOR_KEYS,
  FORMAT_KEYS,
  GRANULARITY_KEYS,
  LOCALE_KEYS,
  OPERATOR_KEYS,
  PERIOD_KEYS,
  PRESET_KEYS,
  STATUS_KEYS,
  UNIT_KEYS,
  VALUE_FORMAT_KEYS,
  VISIBILITY_KEYS,
  WEEKDAY_KEYS,
} from './studio-keys';

const root = resolve(process.cwd(), 'src/app');
const studio = join(root, 'features/analytics/studio');
const files = [
  ...readdirSync(studio)
    .filter((name) => /\.(ts|html)$/.test(name) && !name.endsWith('.spec.ts'))
    .map((name) => join(studio, name)),
  join(root, 'features/analytics/analytics.routes.ts'),
  join(root, 'layout/sidebar/menu-sections.ts'),
];

/** Every translation key the studio's sources write out, including the closed lists of studio-keys.ts. */
function usedKeys(): string[] {
  const found = new Set<string>();
  for (const file of files) {
    for (const match of readFileSync(file, 'utf8').matchAll(
      /'((?:ANALYTICS_STUDIO|NAV\.ANALYTICS_REPORTS)[A-Z0-9_.]*[A-Z0-9])'/g,
    )) {
      found.add(match[1]);
    }
  }
  for (const list of [
    CHART_KEYS,
    COLOR_KEYS,
    FORMAT_KEYS,
    GRANULARITY_KEYS,
    LOCALE_KEYS,
    OPERATOR_KEYS,
    PERIOD_KEYS,
    PRESET_KEYS,
    STATUS_KEYS,
    UNIT_KEYS,
    VALUE_FORMAT_KEYS,
    VISIBILITY_KEYS,
    WEEKDAY_KEYS,
  ]) {
    Object.values(list).forEach((key) => found.add(key));
  }

  return [...found].sort();
}

describe.skipIf(!hasSeededDictionaries)('report studio translations', () => {
  const keys = usedKeys();

  it('finds the keys of the studio', () => {
    expect(keys.length).toBeGreaterThan(150);
  });

  for (const language of SEEDED_LANGUAGES) {
    it(`${language} has every key the studio uses`, () => {
      const dictionary = seededDictionaries[language] ?? {};
      expect(keys.filter((key) => !(key in dictionary))).toEqual([]);
    });
  }

  it('every language translates the studio keys and keeps the placeholders', () => {
    const placeholders = (text: string): string =>
      [...text.matchAll(/\{\w+}/g)]
        .map((match) => match[0])
        .sort()
        .join();
    const english = seededDictionaries.en ?? {};

    for (const language of SEEDED_LANGUAGES) {
      const dictionary = seededDictionaries[language] ?? {};
      const broken = keys.filter(
        (key) => placeholders(dictionary[key] ?? '') !== placeholders(english[key] ?? ''),
      );
      expect(broken, language).toEqual([]);
    }
  });

  it('no studio key is left as a bare key in the interface texts', () => {
    const english = seededDictionaries.en ?? {};
    expect(
      keys.filter((key) => english[key] === key || (english[key] ?? '').trim() === ''),
    ).toEqual([]);
  });
});
