import { ResourceAction, ResourceField, ResourcePageConfig } from '@shared';
import { describe, expect, it } from 'vitest';
import { hasSeededDictionaries, seededDictionaries } from '../../../testing/seeded-dictionaries';
import { QUALITY_AUDITS_PAGE, QUALITY_CAPA_PAGE, QUALITY_NONCONFORMITIES_PAGE } from './qms.pages';

const PAGES: Record<string, ResourcePageConfig> = {
  QUALITY_NONCONFORMITIES_PAGE,
  QUALITY_CAPA_PAGE,
  QUALITY_AUDITS_PAGE,
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
    (tab.list.filters ?? []).forEach(addField);
  }
  for (const action of actionsOf(page)) {
    keys.add(action.labelKey);
    if (action.confirmKey) keys.add(action.confirmKey);
    for (const field of fieldsOf(action.fields)) addField(field);
  }
  return [...keys];
}

describe('quality management pages', () => {
  for (const [name, page] of Object.entries(PAGES)) {
    describe(name, () => {
      it('has unique tab ids, the quality module and API-relative paths', () => {
        const ids = page.tabs.map((tab) => tab.id);
        expect(new Set(ids).size).toBe(ids.length);
        expect(page.tabs.every((tab) => tab.module === 'quality')).toBe(true);
        for (const action of actionsOf(page)) {
          expect(action.path.startsWith('/quality/')).toBe(true);
        }
        for (const tab of page.tabs) {
          expect(tab.list.path.startsWith('/quality/')).toBe(true);
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

  it('closes a non-conformity only while it is open and cancels it only before the investigation', () => {
    const actions = QUALITY_NONCONFORMITIES_PAGE.tabs[0].rowActions ?? [];
    const close = actions.find((action) => action.path.endsWith('/close'));
    const cancel = actions.find((action) => action.path.endsWith('/cancel'));
    expect(close?.visible?.({ status: 'capa_in_progress' })).toBe(true);
    expect(close?.visible?.({ status: 'closed' })).toBe(false);
    expect(cancel?.visible?.({ status: 'open' })).toBe(true);
    expect(cancel?.visible?.({ status: 'investigating' })).toBe(false);
    expect(cancel?.fields?.find((field) => field.key === 'reason')?.required).toBe(true);
  });

  it('follows the CAPA flow: start, complete, then verify the effectiveness', () => {
    const actions = QUALITY_CAPA_PAGE.tabs[0].rowActions ?? [];
    const visible = (suffix: string, status: string) => actions.find((action) => action.path.endsWith(suffix))?.visible?.({ status });
    expect(visible('/start', 'open')).toBe(true);
    expect(visible('/start', 'in_progress')).toBe(false);
    expect(visible('/complete', 'in_progress')).toBe(true);
    expect(visible('/verify-effectiveness', 'completed')).toBe(true);
    expect(visible('/verify-effectiveness', 'open')).toBe(false);
  });

  it('records the audit checklist results and findings only while the audit is in progress', () => {
    const audits = QUALITY_AUDITS_PAGE.tabs.find((tab) => tab.id === 'audits');
    const result = audits?.rowActions?.find((action) => action.path.includes('/checklist/{itemId}'));
    expect(result?.method).toBe('PUT');
    expect(result?.fields?.map((field) => field.key)).toEqual(['itemId', 'result', 'notes']);
    expect(result?.visible?.({ status: 'in_progress' })).toBe(true);
    expect(result?.visible?.({ status: 'planned' })).toBe(false);
    expect(audits?.create?.fields?.find((field) => field.key === 'checklist')?.type).toBe('lines');
    expect(QUALITY_AUDITS_PAGE.tabs.some((tab) => tab.id === 'procedures')).toBe(true);
  });
});
