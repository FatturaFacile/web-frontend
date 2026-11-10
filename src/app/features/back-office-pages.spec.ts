import { ResourceAction, ResourceField, ResourcePageConfig } from '@shared';
import { describe, expect, it } from 'vitest';
import { hasSeededDictionaries, seededDictionaries } from '../../testing/seeded-dictionaries';
import { AUTOMOTIVE_INSPECTIONS_PAGE } from './automotive/inspections.page';
import { CHILDCARE_CARE_PAGE } from './childcare/back-office/care.page';
import { CONSTRUCTION_TRADES_PAGE } from './construction/back-office/trades.page';
import { CONTRACT_DOCUMENTS_PAGE } from './contract-register/documents.page';
import { CUSTOMS_ASSESSMENTS_PAGE } from './customs/back-office/assessments.page';
import { CUSTOMS_OPERATIONS_PAGE } from './customs/back-office/operations.page';
import { CUSTOMS_SETUP_PAGE } from './customs/back-office/setup.page';
import { HOSPITALITY_FLOOR_PAGE } from './hospitality/back-office/floor.page';
import { RETAIL_POS_ADMIN_PAGE } from './retail/back-office/pos-admin.page';

const PAGES: Record<string, ResourcePageConfig> = {
  AUTOMOTIVE_INSPECTIONS_PAGE,
  CHILDCARE_CARE_PAGE,
  CONSTRUCTION_TRADES_PAGE,
  CONTRACT_DOCUMENTS_PAGE,
  CUSTOMS_ASSESSMENTS_PAGE,
  CUSTOMS_OPERATIONS_PAGE,
  CUSTOMS_SETUP_PAGE,
  HOSPITALITY_FLOOR_PAGE,
  RETAIL_POS_ADMIN_PAGE,
};

const SIDEBAR_KEYS = [
  'NAV.CUSTOMS_OPERATIONS',
  'NAV.CUSTOMS_ASSESSMENTS',
  'NAV.CUSTOMS_SETUP',
  'NAV.CONTRACT_DOCUMENTS',
  'NAV.CHILDCARE_OVERVIEW',
  'NAV.CHILDCARE_CARE',
  'NAV.CHILDCARE_FAMILY',
  'NAV.INSPECTIONS',
  'NAV.CONSTRUCTION_OVERVIEW',
  'NAV.CONSTRUCTION_BACK_OFFICE',
  'NAV.HOSPITALITY_OVERVIEW',
  'NAV.HOSPITALITY_FLOOR',
  'NAV.RETAIL_OVERVIEW',
  'NAV.RETAIL_POS_ADMIN',
];

const dictionaries = seededDictionaries;

function* fieldsOf(fields: readonly ResourceField[] | undefined): Generator<ResourceField> {
  for (const field of fields ?? []) {
    yield field;
    yield* fieldsOf(field.fields);
  }
}

function* actionsOf(page: ResourcePageConfig): Generator<ResourceAction> {
  for (const tab of page.tabs) {
    if (tab.create) yield tab.create;
    yield* tab.rowActions ?? [];
    yield* tab.toolbar ?? [];
  }
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
    tab.list.columns.forEach((column) => keys.add(column.labelKey ?? `RES.F.${column.key}`));
    [...(tab.list.filters ?? []), ...(tab.list.scope ? [tab.list.scope] : [])].forEach((field) => {
      addField(field);
    });
  }
  for (const action of actionsOf(page)) {
    keys.add(action.labelKey);
    if (action.confirmKey) keys.add(action.confirmKey);
    for (const field of fieldsOf(action.fields)) addField(field);
  }
  return [...keys];
}

describe('back office resource page configs', () => {
  for (const [name, page] of Object.entries(PAGES)) {
    describe(name, () => {
      it('has unique tab ids and a module on every panel', () => {
        const ids = page.tabs.map((tab) => tab.id);
        expect(new Set(ids).size).toBe(ids.length);
        expect(page.tabs.every((tab) => tab.module.length > 0)).toBe(true);
      });

      it('uses API-relative paths', () => {
        for (const action of actionsOf(page)) {
          expect(action.path.startsWith('/')).toBe(true);
          expect(action.path.includes('/v1/')).toBe(false);
        }
        for (const tab of page.tabs) {
          expect(tab.list.path.startsWith('/')).toBe(true);
        }
      });

      it.skipIf(!hasSeededDictionaries)('has every label translated in it, en, de and fr', () => {
        const missing: string[] = [];
        for (const key of keysOf(page)) {
          for (const [lang, dictionary] of Object.entries(dictionaries)) {
            if (typeof dictionary[key] !== 'string') missing.push(`${lang}:${key}`);
          }
        }
        expect(missing).toEqual([]);
      });
    });
  }

  it.skipIf(!hasSeededDictionaries)('translates the sidebar entries in it, en, de and fr', () => {
    const missing = SIDEBAR_KEYS.flatMap((key) =>
      Object.entries(dictionaries)
        .filter(([, dictionary]) => typeof dictionary[key] !== 'string')
        .map(([lang]) => `${lang}:${key}`),
    );
    expect(missing).toEqual([]);
  });
});
