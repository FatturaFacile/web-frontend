import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  INVOICE_MATCH_ACTIONS,
  INVOICE_MATCH_LINE_STATUSES,
  INVOICE_MATCH_REASONS,
  INVOICE_MATCH_REFERENCE_SOURCES,
  INVOICE_MATCH_STATUSES,
  INVOICE_MATCH_TRIGGERS,
  INVOICE_MATCH_TYPES,
  TOLERANCE_SCOPES,
} from '@domain/procurement/invoice-matching.models';
import { describe, expect, it } from 'vitest';
import {
  hasSeededDictionaries,
  SEEDED_LANGUAGES,
  seededDictionaries,
} from '../../../../testing/seeded-dictionaries';

const FEATURE_DIR = __dirname;
const PROCUREMENT_DIR = join(__dirname, '..');
const MENU_FILE = join(__dirname, '..', '..', '..', 'layout', 'sidebar', 'menu-sections.ts');

/** Keys that are built from a domain list at runtime (`invoiceMatching.status.` + status, ...). */
function dynamicKeys(): string[] {
  const group = (prefix: string, values: readonly string[]): string[] =>
    values.map((value) => `invoiceMatching.${prefix}.${value}`);

  return [
    ...group('status', INVOICE_MATCH_STATUSES),
    ...group('lineStatus', INVOICE_MATCH_LINE_STATUSES),
    ...group('type', INVOICE_MATCH_TYPES),
    ...group('reason', INVOICE_MATCH_REASONS),
    ...group('source', INVOICE_MATCH_REFERENCE_SOURCES),
    ...group('trigger', INVOICE_MATCH_TRIGGERS),
    ...group('scope', TOLERANCE_SCOPES),
    ...group('action', INVOICE_MATCH_ACTIONS),
    'invoiceMatching.notification.blockedTitle',
    'invoiceMatching.notification.blockedBody',
    'PAGE_TITLE.PROCUREMENT_INVOICE_MATCHING_DETAIL',
  ];
}

/** Every Mod 048 key referenced by the feature files, the routes and the menu. */
function collectedKeys(): string[] {
  const keys = new Set<string>(dynamicKeys());
  const pattern =
    /invoiceMatching\.[A-Za-z0-9_.]+|(?:NAV|PAGE_TITLE)\.PROCUREMENT_INVOICE_MATCHING[A-Z_]*/g;

  const files = [
    ...readdirSync(FEATURE_DIR)
      .filter((file) => file.endsWith('.ts') && !file.endsWith('.spec.ts'))
      .filter((file) => !file.endsWith('.fixtures.ts'))
      .map((file) => join(FEATURE_DIR, file)),
    join(PROCUREMENT_DIR, 'procurement.routes.ts'),
    MENU_FILE,
  ];

  for (const file of files) {
    for (const match of readFileSync(file, 'utf8').matchAll(pattern)) {
      keys.add(match[0]);
    }
  }

  return [...keys].filter((key) => !key.endsWith('_') && !key.endsWith('.'));
}

describe('Mod 048 invoice matching translations', () => {
  it('collects the keys of templates, helpers, routes and menu', () => {
    const keys = collectedKeys();

    expect(keys).toContain('NAV.PROCUREMENT_INVOICE_MATCHING');
    expect(keys).toContain('NAV.PROCUREMENT_INVOICE_MATCHING_BLOCKED');
    expect(keys).toContain('NAV.PROCUREMENT_INVOICE_MATCHING_RULES');
    expect(keys).toContain('PAGE_TITLE.PROCUREMENT_INVOICE_MATCHING_RULES');
    expect(keys).toContain('invoiceMatching.status.blocked_discrepancy');
    expect(keys).toContain('invoiceMatching.reason.header_above_tolerance');
    expect(keys).toContain('invoiceMatching.button.override');
    expect(keys).toContain('invoiceMatching.message.overrideForbidden');
    expect(keys).toContain('invoiceMatching.grIr.openBalance');
    expect(keys.length).toBeGreaterThan(120);
  });

  it.skipIf(!hasSeededDictionaries)(
    'has every key in it, en, de and fr with non-empty text',
    () => {
      const keys = collectedKeys();

      for (const language of SEEDED_LANGUAGES) {
        const dictionary = seededDictionaries[language] ?? {};
        const missing = keys.filter((key) => (dictionary[key] ?? '').trim() === '');
        expect(missing, `${language} is missing: ${missing.join(', ')}`).toEqual([]);
      }
    },
  );

  it.skipIf(!hasSeededDictionaries)(
    'preserves identical placeholders across all four languages',
    () => {
      const placeholders = (text: string): string =>
        [...text.matchAll(/\{(\w+)\}/g)]
          .map((match) => match[1])
          .sort()
          .join(',');

      for (const key of collectedKeys()) {
        const variants = new Set(
          SEEDED_LANGUAGES.map((language) =>
            placeholders(seededDictionaries[language]?.[key] ?? ''),
          ),
        );
        expect(variants.size, `${key} has inconsistent placeholders across locales`).toBe(1);
      }
    },
  );

  it.skipIf(!hasSeededDictionaries)(
    'keeps the backend notification texts and their placeholders',
    () => {
      for (const language of SEEDED_LANGUAGES) {
        const dictionary = seededDictionaries[language] ?? {};
        const body = dictionary['invoiceMatching.notification.blockedBody'] ?? '';

        expect(dictionary['invoiceMatching.notification.blockedTitle'], language).toBeTruthy();
        for (const placeholder of ['{invoice}', '{amount}', '{currency}']) {
          expect(body, `${language} blockedBody`).toContain(placeholder);
        }
      }
    },
  );
});
