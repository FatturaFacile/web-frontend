import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

export const SEEDED_LANGUAGES = ['it', 'en', 'de', 'fr'] as const;
export type SeededLanguage = (typeof SEEDED_LANGUAGES)[number];
export type SeededDictionary = Record<string, string>;

/** The sibling `web-api` project, or the folder named by the API_ROOT environment variable. */
const API_ROOT = process.env['API_ROOT'] ?? resolve(process.cwd(), '..', 'web-api');

function dump(language: SeededLanguage): SeededDictionary | null {
  try {
    const out = execFileSync('php', ['artisan', 'translations:dump', language], {
      cwd: API_ROOT,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return JSON.parse(out) as SeededDictionary;
  } catch {
    return null;
  }
}

/**
 * The UI strings live only in the API (TranslationSeeder and FrontendTranslationSeeder); the frontend ships no copy.
 * The specs that check keys against them read the seeded dictionaries straight from the sibling `web-api` project.
 * Without that project or PHP (for example a CI job that checks out the frontend alone) they are skipped.
 */
function loadSeededDictionaries(): Record<SeededLanguage, SeededDictionary> | null {
  if (!existsSync(resolve(API_ROOT, 'artisan'))) {
    return null;
  }

  const entries = SEEDED_LANGUAGES.map((language) => [language, dump(language)] as const);
  if (entries.some(([, dictionary]) => dictionary === null)) {
    return null;
  }

  return Object.fromEntries(entries) as Record<SeededLanguage, SeededDictionary>;
}

const loaded = loadSeededDictionaries();

/** `true` when the seeded dictionaries could be read; the specs that need them use `it.skipIf(!hasSeededDictionaries)`. */
export const hasSeededDictionaries = loaded !== null;

/** The seeded dictionaries per language, empty when they could not be read. */
export const seededDictionaries: Partial<Record<SeededLanguage, SeededDictionary>> = loaded ?? {};
