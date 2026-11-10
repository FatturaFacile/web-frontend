import { ResourceAction, ResourceField, ResourcePageConfig } from '@shared';
import { describe, expect, it } from 'vitest';
import { hasSeededDictionaries, seededDictionaries } from '../../../../testing/seeded-dictionaries';
import {
  ASSOCIATIONS_CATALOGS_PAGE,
  ASSOCIATIONS_FUNDRAISING_CATALOGS_PAGE,
  ASSOCIATIONS_WORK_CATALOGS_PAGE,
} from './catalogs.page';
import { ASSOCIATIONS_COMPLIANCE_PAGE, ASSOCIATIONS_NETWORK_PAGE } from './compliance.page';
import { ASSOCIATIONS_MEETINGS_PAGE } from './meetings.page';
import { ASSOCIATIONS_PRIVACY_PAGE } from './privacy.page';
import { ASSOCIATIONS_STATEMENTS_PAGE } from './statements.page';

const PAGES: Record<string, ResourcePageConfig> = {
  ASSOCIATIONS_MEETINGS_PAGE,
  ASSOCIATIONS_PRIVACY_PAGE,
  ASSOCIATIONS_STATEMENTS_PAGE,
  ASSOCIATIONS_COMPLIANCE_PAGE,
  ASSOCIATIONS_NETWORK_PAGE,
  ASSOCIATIONS_CATALOGS_PAGE,
  ASSOCIATIONS_WORK_CATALOGS_PAGE,
  ASSOCIATIONS_FUNDRAISING_CATALOGS_PAGE,
};

/** The governance and compliance endpoints of the associations API these pages must reach. */
const EXPECTED_ENDPOINTS = [
  'GET /associations/privacy/activities',
  'POST /associations/privacy/activities',
  'PUT /associations/privacy/activities/{id}',
  'POST /associations/privacy/activities/{id}/finalize',
  'POST /associations/privacy/activities/{id}/versions',
  'GET /associations/privacy/activities/{id}/notice',
  'GET /associations/privacy/activities/{id}/notice/pdf',
  'GET /associations/privacy/register',
  'GET /associations/privacy/register/csv',
  'GET /associations/privacy/register/pdf',
  'GET /associations/privacy/subjects/{id}/appointment',
  'GET /associations/privacy/consents',
  'POST /associations/privacy/consents',
  'POST /associations/privacy/consents/{id}/withdraw',
  'GET /associations/privacy/requests',
  'POST /associations/privacy/requests',
  'POST /associations/privacy/requests/{id}/extend',
  'GET /associations/privacy/requests/{id}/erasure-preview',
  'POST /associations/privacy/requests/{id}/complete',
  'POST /associations/privacy/requests/{id}/reject',
  'GET /associations/privacy/requests/{id}/export',
  'GET /associations/meetings/{id}',
  'PUT /associations/meetings/{id}',
  'DELETE /associations/meetings/{id}',
  'POST /associations/meetings/{id}/agenda-items',
  'POST /associations/meetings/{id}/attachments',
  'POST /associations/meetings/{id}/participants',
  'POST /associations/meetings/{id}/notices',
  'GET /associations/meetings/{id}/deliveries',
  'GET /associations/meetings/{id}/letter',
  'POST /associations/meetings/{id}/attendance',
  'POST /associations/meetings/{id}/proxies',
  'GET /associations/meetings/{id}/quorum',
  'POST /associations/meetings/{id}/hold',
  'POST /associations/meetings/{id}/close',
  'POST /associations/meetings/{id}/cancel',
  'GET /associations/statements/schemes',
  'GET /associations/statements/mappings',
  'POST /associations/statements/mappings',
  'PUT /associations/statements/mappings/{id}',
  'DELETE /associations/statements/mappings/{id}',
  'GET /associations/statements/filings',
  'GET /associations/statements/{year}/management-report',
  'GET /associations/statements/{year}/balance-sheet',
  'GET /associations/statements/{year}/cash-report',
  'GET /associations/statements/{year}/checks',
  'GET /associations/statements/{year}/mission-report',
  'PUT /associations/statements/{year}/mission-report',
  'POST /associations/statements/{year}/filings',
  'POST /associations/statement-filings/{id}/filed',
  'GET /associations/statement-filings/{id}/csv',
  'GET /associations/statement-filings/{id}/pdf',
  'POST /associations/five-per-mille/{id}/expenses',
  'GET /associations/five-per-mille/{id}/report',
  'GET /associations/five-per-mille/{id}/csv',
  'GET /associations/books/{book}',
  'GET /associations/books/{book}/csv',
  'GET /associations/books/{book}/pdf',
  'GET /associations/protocol',
  'POST /associations/protocol',
  'POST /associations/protocol/{id}/cancel',
  'GET /associations/protocol/{id}/download',
  'POST /associations/meetings/{id}/ballots',
  'GET /associations/ballots/{id}',
  'POST /associations/ballots/{id}/open',
  'POST /associations/ballots/{id}/close',
  'POST /associations/ballots/{id}/votes',
  'POST /associations/meetings/{id}/minutes',
  'GET /associations/minutes/{id}',
  'PUT /associations/minutes/{id}',
  'POST /associations/minutes/{id}/approve',
  'GET /associations/minutes/{id}/pdf',
  'POST /associations/minutes/{id}/distribute',
  'GET /associations/minutes/{id}/deliveries',
  'GET /associations/network/code',
  'POST /associations/network/affiliates',
  'GET /associations/network/consents',
  'POST /associations/network/consents/{id}/grant',
  'POST /associations/network/consents/{id}/withdraw',
  'GET /associations/network/figures',
  'GET /associations/network/statements/{year}',
  'GET /associations/catalogs/{catalog}',
  'POST /associations/catalogs/{catalog}',
  'GET /associations/catalogs/{catalog}/{id}',
  'PUT /associations/catalogs/{catalog}/{id}',
  'DELETE /associations/catalogs/{catalog}/{id}',
  'GET /associations/lex398/{year}/monitor',
  'GET /associations/lex398/{year}/register',
  'GET /associations/lex398/{year}/register/csv',
  'POST /associations/lex398/entries',
  'POST /associations/lex398/{year}/sync-invoices',
  'POST /associations/registry-imports',
  'GET /associations/registry-imports/{id}',
  'POST /associations/registry-imports/{id}/commit',
] as const;

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

/** Endpoints a page calls, with the catalog name of the generic catalog endpoints replaced by its placeholder. */
function endpointsOf(page: ResourcePageConfig): string[] {
  const generic = (path: string) => path.replace(/\/catalogs\/[a-z-]+/, '/catalogs/{catalog}');
  const calls: string[] = [];
  for (const tab of page.tabs) {
    if (tab.list.path) calls.push(`GET ${generic(tab.list.path)}`);
    if (tab.detailPath) calls.push(`GET ${generic(tab.detailPath)}`);
  }
  for (const action of actionsOf(page)) {
    calls.push(`${action.method} ${generic(action.path)}`);
  }
  return calls;
}

/** Every translation key a page can display. */
function keysOf(page: ResourcePageConfig): string[] {
  const keys = new Set<string>([page.titleKey]);
  const addField = (field: ResourceField) => {
    keys.add(field.labelKey ?? `RES.F.${field.key}`);
    (field.options ?? []).filter((value) => !/^\d+$/.test(value)).forEach((value) => keys.add(`RES.V.${value}`));
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

describe('associations governance page configs', () => {
  it('reaches every governance and compliance endpoint of the associations API', () => {
    const reached = new Set(Object.values(PAGES).flatMap((page) => endpointsOf(page)));
    const missing = EXPECTED_ENDPOINTS.filter((endpoint) => !reached.has(endpoint));
    expect(missing).toEqual([]);
  });

  for (const [name, page] of Object.entries(PAGES)) {
    describe(name, () => {
      it('has unique tab ids and the associations module on every panel', () => {
        const ids = page.tabs.map((tab) => tab.id);
        expect(new Set(ids).size).toBe(ids.length);
        expect(page.tabs.every((tab) => tab.module === 'associations')).toBe(true);
      });

      it('uses API-relative paths', () => {
        for (const action of actionsOf(page)) {
          expect(action.path.startsWith('/associations/')).toBe(true);
          expect(action.path.includes('/v1/')).toBe(false);
        }
        for (const tab of page.tabs) {
          expect(tab.list.path === '' || tab.list.path.startsWith('/associations/')).toBe(true);
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
});
