import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

interface Tree { [key: string]: string | Tree }

const LANGUAGES = ['it', 'en', 'de', 'fr'] as const;
type Language = (typeof LANGUAGES)[number];

/** Flattens nested objects and dotted flat keys alike: `a.b` as a key or as `{ a: { b } }` is the same key. */
function flatten(tree: Tree, prefix = '', out: Record<string, string> = {}): Record<string, string> {
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') {
      out[path] = value;
    } else {
      flatten(value, path, out);
    }
  }
  return out;
}

const dictionaries = Object.fromEntries(
  LANGUAGES.map((lang) => [
    lang,
    flatten(JSON.parse(readFileSync(resolve(process.cwd(), `public/assets/i18n/${lang}.json`), 'utf8')) as Tree),
  ]),
) as Record<Language, Record<string, string>>;

/** Words that are spelled the same in English and French (loan words and cognates). */
const SAME_IN_FRENCH = new Set(['NAV.DOCS']);

/** Placeholders such as `{number}` must survive the translation. */
const placeholders = (text: string): string[] => [...text.matchAll(/\{\w+}/g)].map((m) => m[0]).sort();

describe('translation dictionaries', () => {
  it('Italian and English carry the same keys', () => {
    const it = Object.keys(dictionaries.it);
    const en = Object.keys(dictionaries.en);
    expect(it.filter((key) => !(key in dictionaries.en))).toEqual([]);
    expect(en.filter((key) => !(key in dictionaries.it))).toEqual([]);
  });

  for (const lang of ['de', 'fr'] as const) {
    it(`${lang} lacks no key that Italian or English have`, () => {
      const reference = new Set([...Object.keys(dictionaries.it), ...Object.keys(dictionaries.en)]);
      const missing = [...reference].filter((key) => !(key in dictionaries[lang]));
      expect(missing).toEqual([]);
    });

    it(`${lang} has no key that Italian and English lack`, () => {
      const extra = Object.keys(dictionaries[lang]).filter(
        (key) => !(key in dictionaries.it) && !(key in dictionaries.en),
      );
      expect(extra).toEqual([]);
    });

    it(`${lang} keeps the placeholders of the English text`, () => {
      const broken = Object.keys(dictionaries.en).filter(
        (key) =>
          key in dictionaries[lang] &&
          placeholders(dictionaries.en[key]).join() !== placeholders(dictionaries[lang][key]).join(),
      );
      expect(broken).toEqual([]);
    });

    it(`${lang} is translated, not copied from English, for the keys added by the ERP pages`, () => {
      const untouched = Object.keys(dictionaries.en).filter(
        (key) =>
          /^(NAV\.(SECTION_EXTENSIONS|TOOLS|MODULES|SECTORS|ADVANCED|DOCS|TOOL_|MOD_|SECTOR_|ADV_|DOC_)|PLACEHOLDER\.|TOOLS\.)/.test(key) &&
          dictionaries[lang][key] === dictionaries.en[key] &&
          !(lang === 'fr' && SAME_IN_FRENCH.has(key)) &&
          dictionaries.en[key].length > 12,
      );
      expect(untouched).toEqual([]);
    });
  }
});
