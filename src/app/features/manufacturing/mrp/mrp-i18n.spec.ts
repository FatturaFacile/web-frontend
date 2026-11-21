import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  hasSeededDictionaries,
  SEEDED_LANGUAGES,
  seededDictionaries,
} from '../../../../testing/seeded-dictionaries';

const DIR = __dirname;
const MENU = join(DIR, '..', '..', '..', 'layout', 'sidebar', 'menu-sections.ts');
const API_ROOT = process.env['API_ROOT'] ?? resolve(process.cwd(), '..', 'web-api');
const DEFINITIONS = join(API_ROOT, 'database', 'seeders', 'Translations', 'MrpPlanningFrontendTranslations.php');

/** Keys written in full in the sources (templates and code, not the specs) and the menu entry. */
function literalKeys(): string[] {
  const keys = new Set<string>();

  for (const file of readdirSync(DIR)) {
    if (!file.endsWith('.ts') || file.endsWith('.spec.ts')) {
      continue;
    }
    for (const match of readFileSync(join(DIR, file), 'utf8').matchAll(/MRP\.[A-Z0-9_]+/g)) {
      keys.add(match[0]);
    }
  }
  for (const match of readFileSync(MENU, 'utf8').matchAll(/MRP\.[A-Z0-9_]+/g)) {
    keys.add(match[0]);
  }

  return [...keys];
}

/** The `definitions()` of the backend class read straight from the PHP file, `null` without PHP or the backend. */
function definitions(): Record<string, string[]> | null {
  if (!existsSync(DEFINITIONS)) {
    return null;
  }

  try {
    const code =
      'require $argv[1]; echo json_encode(Database\\Seeders\\Translations\\MrpPlanningFrontendTranslations::definitions(), JSON_UNESCAPED_UNICODE);';
    const out = execFileSync('php', ['-r', code, DEFINITIONS], {
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'ignore'],
    });

    return JSON.parse(out) as Record<string, string[]>;
  } catch {
    return null;
  }
}

const seededDefinitions = definitions();
const hasDefinitions = seededDefinitions !== null;
/** The class is registered in FrontendTranslationSeeder once the dumped dictionaries carry its keys. */
const registered = hasSeededDictionaries && Object.keys(seededDictionaries['en'] ?? {}).some((key) => key.startsWith('MRP.'));

const placeholders = (text: string): string =>
  [...text.matchAll(/\{(\w+)\}/g)]
    .map((match) => match[1])
    .sort()
    .join(',');

describe('MRP planning translations', () => {
  it('finds the keys of the feature', () => {
    expect(literalKeys()).toContain('MRP.NAV');
    expect(literalKeys()).toContain('MRP.MASS_FIRM_RELEASE');
    expect(literalKeys().length).toBeGreaterThan(100);
  });

  it('keeps no UI text in the sources: every key has the MRP prefix and upper snake case', () => {
    for (const key of literalKeys()) {
      expect(key).toMatch(/^MRP\.[A-Z0-9]+(_[A-Z0-9]+)*$/);
    }
  });

  it.skipIf(!hasDefinitions)('has every key in the backend class in it, en, de and fr with a non-empty text', () => {
    const entries = seededDefinitions ?? {};

    for (const key of literalKeys()) {
      const texts = entries[key];

      expect(texts, `${key} is missing in MrpPlanningFrontendTranslations`).toBeDefined();
      expect(texts).toHaveLength(4);
      expect((texts ?? []).every((text) => text.trim() !== ''), `${key} has an empty language`).toBe(true);
    }
  });

  it.skipIf(!hasDefinitions)('uses the same placeholders in every language', () => {
    for (const [key, texts] of Object.entries(seededDefinitions ?? {})) {
      expect(new Set(texts.map(placeholders)).size, `${key} has different placeholders per language`).toBe(1);
    }
  });

  it.skipIf(!hasDefinitions)('defines no key the feature does not use', () => {
    const used = new Set(literalKeys());
    const unused = Object.keys(seededDefinitions ?? {}).filter((key) => !used.has(key));

    expect(unused, `unused keys: ${unused.join(', ')}`).toEqual([]);
  });

  it.skipIf(!registered)('has every key in the seeded dictionaries of it, en, de and fr', () => {
    for (const language of SEEDED_LANGUAGES) {
      const dictionary = seededDictionaries[language] ?? {};
      const missing = literalKeys().filter((key) => (dictionary[key] ?? '').trim() === '');

      expect(missing, `${language} is missing: ${missing.join(', ')}`).toEqual([]);
    }
  });
});
