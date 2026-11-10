import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { ResourceAction, ResourceField, ResourcePageConfig, ResourcePanelConfig } from '@shared';
import { describe, expect, it } from 'vitest';
import { ASSOC_COURSES_PAGE } from './courses.page';
import { ASSOC_ENROLMENT_PAGE } from './enrolment.page';
import { ASSOC_FEES_PAGE, ASSOC_FUNDRAISING_PAGE, ASSOC_SETTINGS_PAGE, ASSOC_SPORT_PAGE } from './finance.page';
import { ASSOC_MEMBERSHIPS_PAGE, MEMBER_FILE_PANELS } from './members.page';
import { ASSOC_ACCESS_PAGE, ASSOC_COMPLIANCE_PAGE, ASSOC_VOLUNTEERS_PAGE } from './operations.page';

const MEMBER_FILE_PAGE: ResourcePageConfig = { titleKey: 'RES.PAGE.ASSOC_MEMBER_FILE', tabs: MEMBER_FILE_PANELS };

const PAGES: Record<string, ResourcePageConfig> = {
  ASSOC_MEMBERSHIPS_PAGE,
  MEMBER_FILE_PAGE,
  ASSOC_COURSES_PAGE,
  ASSOC_ENROLMENT_PAGE,
  ASSOC_COMPLIANCE_PAGE,
  ASSOC_VOLUNTEERS_PAGE,
  ASSOC_ACCESS_PAGE,
  ASSOC_FEES_PAGE,
  ASSOC_SPORT_PAGE,
  ASSOC_FUNDRAISING_PAGE,
  ASSOC_SETTINGS_PAGE,
};

const LANGUAGES = ['it', 'en', 'de', 'fr'] as const;
const dictionaries = Object.fromEntries(
  LANGUAGES.map((lang) => [
    lang,
    JSON.parse(readFileSync(resolve(process.cwd(), `public/assets/i18n/${lang}.json`), 'utf8')) as Record<string, string>,
  ]),
);

function* fieldsOf(fields: readonly ResourceField[] | undefined): Generator<ResourceField> {
  for (const field of fields ?? []) {
    yield field;
    yield* fieldsOf(field.fields);
  }
}

function actionsOf(tab: ResourcePanelConfig): ResourceAction[] {
  return [...(tab.create ? [tab.create] : []), ...(tab.rowActions ?? []), ...(tab.toolbar ?? [])];
}

/** Every translation key a page can display. */
function keysOf(page: ResourcePageConfig): string[] {
  const keys = new Set<string>([page.titleKey]);
  const addField = (field: ResourceField) => {
    keys.add(field.labelKey ?? `RES.F.${field.key}`);
    (field.options ?? []).forEach((value) => keys.add(`RES.V.${value}`));
  };
  for (const tab of page.tabs) {
    keys.add(tab.titleKey);
    if (tab.rowLink) {
      keys.add(tab.rowLink.labelKey);
    }
    tab.list.columns.forEach((column) => keys.add(column.labelKey ?? `RES.F.${column.key}`));
    [...(tab.list.filters ?? []), ...(tab.list.scope ? [tab.list.scope] : [])].forEach(addField);
    for (const action of actionsOf(tab)) {
      keys.add(action.labelKey);
      if (action.confirmKey) {
        keys.add(action.confirmKey);
      }
      for (const field of fieldsOf(action.fields)) {
        addField(field);
      }
    }
  }
  return [...keys];
}

function sourceKeys(directory: string, prefixes: readonly string[]): string[] {
  const keys = new Set<string>();
  for (const file of readdirSync(directory)) {
    if (!/\.(ts|html)$/.test(file) || file.endsWith('.spec.ts')) {
      continue;
    }
    const source = readFileSync(join(directory, file), 'utf8');
    for (const match of source.matchAll(/'((?:ASSOC_AREA|ASSOC_ENROL)\.[A-Z_]+)'/g)) {
      if (prefixes.some((prefix) => match[1].startsWith(prefix))) {
        keys.add(match[1]);
      }
    }
  }
  return [...keys].filter((key) => !key.endsWith('_'));
}

function missingKeys(keys: readonly string[]): string[] {
  const missing: string[] = [];
  for (const key of keys) {
    for (const [lang, dictionary] of Object.entries(dictionaries)) {
      if (typeof dictionary[key] !== 'string') {
        missing.push(`${lang}:${key}`);
      }
    }
  }
  return missing;
}

describe('association resource pages', () => {
  for (const [name, page] of Object.entries(PAGES)) {
    describe(name, () => {
      it('has unique tab ids and the associations module on every panel', () => {
        const ids = page.tabs.map((tab) => tab.id);
        expect(new Set(ids).size).toBe(ids.length);
        expect(page.tabs.every((tab) => tab.module === 'associations')).toBe(true);
      });

      it('uses API-relative paths', () => {
        for (const tab of page.tabs) {
          expect(tab.list.path.startsWith('/associations/')).toBe(true);
          for (const action of actionsOf(tab)) {
            expect(action.path.startsWith('/associations/')).toBe(true);
            expect(action.path.includes('/v1/')).toBe(false);
          }
        }
      });

      it('has every label translated in it, en, de and fr', () => {
        expect(missingKeys(keysOf(page)).join(' ')).toBe('');
      });
    });
  }

  it('has the navigation entries translated', () => {
    const keys = [
      'NAV.ASSOC_OVERVIEW',
      'NAV.ASSOC_MEMBERSHIPS',
      'NAV.ASSOC_COURSES',
      'NAV.ASSOC_ENROLMENT',
      'NAV.ASSOC_COMPLIANCE',
      'NAV.ASSOC_VOLUNTEERS',
      'NAV.ASSOC_ACCESS',
      'NAV.ASSOC_FEES',
      'NAV.ASSOC_SPORT',
      'NAV.ASSOC_FUNDRAISING',
      'NAV.ASSOC_SETTINGS',
    ];
    expect(missingKeys(keys).join(' ')).toBe('');
  });

  it('has the member area and the public enrolment form translated', () => {
    const keys = [
      ...sourceKeys(resolve(process.cwd(), 'src/app/features/association-area'), ['ASSOC_AREA.']),
      ...sourceKeys(resolve(process.cwd(), 'src/app/features/association-enrolment'), ['ASSOC_ENROL.']),
      ...['settled', 'attention', 'overdue'].map((standing) => `ASSOC_AREA.STANDING_${standing}`),
      ...['submitted', 'pending_board', 'approved', 'rejected'].map((status) => `ASSOC_ENROL.STATUS_${status}`),
    ];
    expect(keys.length).toBeGreaterThan(40);
    expect(missingKeys(keys).join(' ')).toBe('');
  });
});
