import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ResourceAction, ResourceField, ResourcePageConfig } from '@shared';
import { describe, expect, it } from 'vitest';
import { SDI_CHANNEL_PAGE } from '../settings/pages/sdi-channel/sdi-channel.page';
import { HELPDESK_AGENT_TOOLS_PAGE } from './agent-tools.page';
import { HELPDESK_AUTOMATION_PAGE } from './automation.page';
import { HELPDESK_REPORTS_PAGE } from './helpdesk-reports.page';
import { ITSM_PAGE } from './itsm.page';
import { KNOWLEDGE_BASE_PAGE } from './knowledge-base.page';
import { SERVICE_WORK_ORDERS_PAGE } from './service-delivery.page';

const PAGES: Record<string, ResourcePageConfig> = {
  HELPDESK_AGENT_TOOLS_PAGE,
  HELPDESK_AUTOMATION_PAGE,
  HELPDESK_REPORTS_PAGE,
  ITSM_PAGE,
  KNOWLEDGE_BASE_PAGE,
  SERVICE_WORK_ORDERS_PAGE,
  SDI_CHANNEL_PAGE,
};

const dictionaries = Object.fromEntries(
  ['it', 'en', 'de', 'fr'].map((lang) => [
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

function* actionsOf(page: ResourcePageConfig): Generator<ResourceAction> {
  for (const tab of page.tabs) {
    if (tab.create) yield tab.create;
    yield* tab.rowActions ?? [];
    yield* tab.toolbar ?? [];
  }
}

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

describe('helpdesk, ITSM and SDI channel resource pages', () => {
  for (const [name, page] of Object.entries(PAGES)) {
    describe(name, () => {
      it('has unique tab ids, a module on every panel and API-relative paths', () => {
        const ids = page.tabs.map((tab) => tab.id);
        expect(new Set(ids).size).toBe(ids.length);
        expect(page.tabs.every((tab) => tab.module.length > 0)).toBe(true);
        for (const action of actionsOf(page)) {
          expect(action.path.startsWith('/')).toBe(true);
          expect(action.path.includes('/v1/')).toBe(false);
        }
        for (const tab of page.tabs) {
          expect(tab.list.path.startsWith('/')).toBe(true);
        }
      });

      it('has every label translated in it, en, de and fr', () => {
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

  it('sends secrets through hidden inputs only', () => {
    const secrets = [...actionsOf(SDI_CHANNEL_PAGE), ...actionsOf(HELPDESK_AUTOMATION_PAGE)]
      .flatMap((action) => [...fieldsOf(action.fields)])
      .filter((field) => /password|secret/.test(field.key));
    expect(secrets.length).toBeGreaterThan(0);
    expect(secrets.every((field) => field.secret === true)).toBe(true);
  });
});
