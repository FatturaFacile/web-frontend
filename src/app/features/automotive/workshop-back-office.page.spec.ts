import { ResourceAction, ResourceField, ResourcePageConfig } from '@shared';
import { describe, expect, it } from 'vitest';
import { hasSeededDictionaries, seededDictionaries } from '../../../testing/seeded-dictionaries';
import { AUTOMOTIVE_ESTIMATES_PAGE, AUTOMOTIVE_PARTS_PAGE, AUTOMOTIVE_WARRANTY_PAGE } from './workshop-back-office.page';

const PAGES: Record<string, ResourcePageConfig> = {
  AUTOMOTIVE_ESTIMATES_PAGE,
  AUTOMOTIVE_WARRANTY_PAGE,
  AUTOMOTIVE_PARTS_PAGE,
};

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
    [...(tab.list.filters ?? []), ...(tab.list.scope ? [tab.list.scope] : [])].forEach(addField);
  }
  for (const action of actionsOf(page)) {
    keys.add(action.labelKey);
    if (action.confirmKey) keys.add(action.confirmKey);
    for (const field of fieldsOf(action.fields)) addField(field);
  }
  return [...keys];
}

describe('workshop back office pages', () => {
  for (const [name, page] of Object.entries(PAGES)) {
    describe(name, () => {
      it('has unique tab ids, the workshop module and API-relative paths', () => {
        const ids = page.tabs.map((tab) => tab.id);
        expect(new Set(ids).size).toBe(ids.length);
        expect(page.tabs.every((tab) => tab.module === 'workshop')).toBe(true);
        for (const action of actionsOf(page)) {
          expect(action.path.startsWith('/workshop/')).toBe(true);
        }
        for (const tab of page.tabs) {
          expect(tab.list.path.startsWith('/workshop/')).toBe(true);
        }
      });

      it.skipIf(!hasSeededDictionaries)('has every label translated in it, en, de and fr', () => {
        const missing: string[] = [];
        for (const key of keysOf(page)) {
          for (const [lang, dictionary] of Object.entries(seededDictionaries)) {
            if (typeof dictionary[key] !== 'string') missing.push(`${lang}:${key}`);
          }
        }
        expect(missing).toEqual([]);
      });
    });
  }

  it('lets an estimate be edited only as a draft and decided only once it is sent', () => {
    const tab = AUTOMOTIVE_ESTIMATES_PAGE.tabs[0];
    const byPath = (suffix: string) => tab.rowActions?.find((action) => action.path.endsWith(suffix));
    expect(byPath('/send')?.visible?.({ status: 'draft' })).toBe(true);
    expect(byPath('/send')?.visible?.({ status: 'sent' })).toBe(false);
    expect(byPath('/approve')?.visible?.({ status: 'sent' })).toBe(true);
    expect(byPath('/reject')?.visible?.({ status: 'draft' })).toBe(false);
    expect(byPath('/convert')?.visible?.({ status: 'approved' })).toBe(true);
    expect(byPath('/convert')?.visible?.({ status: 'converted' })).toBe(false);
  });

  it('reimburses a warranty claim only once the supplier accepted it', () => {
    const reimburse = AUTOMOTIVE_WARRANTY_PAGE.tabs[0].rowActions?.find((action) => action.path.endsWith('/reimburse'));
    expect(reimburse?.visible?.({ status: 'accepted' })).toBe(true);
    expect(reimburse?.visible?.({ status: 'submitted' })).toBe(false);
    expect(reimburse?.fields?.filter((field) => field.required).map((field) => field.key)).toEqual(['reimbursed_amount', 'reimbursed_on']);
  });

  it('scopes the parts to a folder and acts only on reserved parts', () => {
    const tab = AUTOMOTIVE_PARTS_PAGE.tabs[0];
    expect(tab.list.scope?.key).toBe('folder_id');
    expect(tab.rowActions?.every((action) => action.visible?.({ status: 'reserved' }) && !action.visible?.({ status: 'issued' }))).toBe(true);
  });
});
