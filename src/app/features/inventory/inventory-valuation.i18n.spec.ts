import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { INVENTORY_ROUTES } from './inventory.routes';

const LANGS = ['en', 'it', 'de', 'fr'] as const;
const I18N_DIR = path.resolve(process.cwd(), 'public/assets/i18n');
const FEATURE_DIR = path.resolve(process.cwd(), 'src/app/features/inventory');

function load(lang: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(path.join(I18N_DIR, `${lang}.json`), 'utf8')) as Record<string, unknown>;
}

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return sourceFiles(full);
    }
    return /\.(ts|html)$/.test(entry.name) && !entry.name.endsWith('.spec.ts') ? [full] : [];
  });
}

describe('inventory valuation i18n', () => {
  const dictionaries = Object.fromEntries(LANGS.map((l) => [l, load(l)]));
  const ownKeys = (lang: string) =>
    Object.keys(dictionaries[lang])
      .filter((k) => /^INVENTORY\.(VALUATION|COST_LAYERS|LANDED_COSTS|BOOK|REVALUATION|ERRORS|FILTERS|ACTIONS|VALIDATION)\./.test(k))
      .sort();

  it('defines the same feature keys in en, it, de and fr', () => {
    const en = ownKeys('en');
    expect(en.length).toBeGreaterThan(100);
    for (const lang of LANGS) {
      expect(ownKeys(lang)).toEqual(en);
      for (const key of en) {
        expect(typeof dictionaries[lang][key], `${lang}:${key}`).toBe('string');
        expect((dictionaries[lang][key] as string).trim(), `${lang}:${key}`).not.toBe('');
      }
    }
  });

  it('translates every INVENTORY.* / NAV.* key referenced by the feature', () => {
    const text = sourceFiles(FEATURE_DIR)
      .map((f) => fs.readFileSync(f, 'utf8'))
      .join('\n');
    const sidebar = fs.readFileSync(path.resolve(process.cwd(), 'src/app/layout/sidebar/sidebar.component.ts'), 'utf8');
    const keys = new Set(
      [...`${text}\n${sidebar}`.matchAll(/'((?:INVENTORY|NAV)\.[A-Z0-9_.]+[A-Z0-9])'/g)].map((m) => m[1]),
    );
    // Category GL account labels are built from the field name in the template.
    for (const field of ['INVENTORY', 'COGS', 'PPV', 'LANDED_COST_CLEARING']) {
      keys.add(`INVENTORY.VALUATION.ACCOUNT_${field}_ACCOUNT_ID`);
    }
    expect(keys.size).toBeGreaterThan(50);
    for (const lang of LANGS) {
      const missing = [...keys].filter((k) => typeof dictionaries[lang][k] !== 'string');
      expect(missing, lang).toEqual([]);
    }
  });

  it('never offers LIFO', () => {
    for (const lang of LANGS) {
      const values = Object.entries(dictionaries[lang])
        .filter(([k]) => k.startsWith('INVENTORY.VALUATION.METHOD_'))
        .map(([, v]) => String(v));
      expect(values.some((v) => /LIFO/i.test(v))).toBe(false);
    }
  });
});

describe('inventory routes', () => {
  it('keeps the existing routes and adds the valuation pages', () => {
    const paths = INVENTORY_ROUTES.map((r) => r.path);
    expect(paths).toEqual(
      expect.arrayContaining(['', 'stock', 'ddt', 'customs', 'valuation', 'cost-layers', 'landed-costs', 'book']),
    );
    const landed = INVENTORY_ROUTES.find((r) => r.path === 'landed-costs');
    expect(landed?.children?.map((c) => c.path)).toEqual(['', 'new', ':id']);
    for (const route of INVENTORY_ROUTES.filter((r) => r.path && r.path !== '')) {
      expect(route.data?.['breadcrumb'], route.path).toBeTruthy();
      expect(route.data?.['title'], route.path).toBeTruthy();
    }
  });
});
