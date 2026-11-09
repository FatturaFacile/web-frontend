import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ResourceAction, ResourceField, ResourcePageConfig } from '@shared';
import { describe, expect, it } from 'vitest';
import { LOTS_PAGE, STOCK_REPORTS_PAGE } from './inventory/wms/lots-reports.page';
import { INVENTORY_SERVICES_PAGE, STOCK_ITEMS_PAGE } from './inventory/wms/items-service.page';
import { OUTBOUND_PAGE } from './inventory/wms/outbound.page';
import { COUNTING_PAGE, REPLENISHMENT_PAGE, TRANSFERS_PAGE } from './inventory/wms/stock-flows.page';
import { TERMINAL_PAGE } from './inventory/wms/terminal-service.page';
import { WAREHOUSE_PAGE } from './inventory/wms/warehouse.page';
import { MFG_ENGINEERING_PAGE } from './manufacturing/engineering.page';
import { MFG_PLANNING_PAGE, MFG_QUALITY_PAGE } from './manufacturing/planning-quality.page';
import { MFG_PRODUCTION_PAGE } from './manufacturing/production.page';
import { PROCUREMENT_ADMIN_PAGE } from './procurement/admin.page';
import { PROCUREMENT_ORDERS_PAGE } from './procurement/orders.page';
import { SOURCING_PAGE } from './procurement/sourcing.page';
import { SUPPLIERS_PAGE } from './procurement/suppliers.page';
import { PURCHASE_INVOICES_PAGE, PURCHASE_ORDERS_PAGE } from './purchases/purchases-ledger.page';

const PAGES: Record<string, ResourcePageConfig> = {
  WAREHOUSE_PAGE,
  OUTBOUND_PAGE,
  TRANSFERS_PAGE,
  COUNTING_PAGE,
  REPLENISHMENT_PAGE,
  LOTS_PAGE,
  STOCK_REPORTS_PAGE,
  STOCK_ITEMS_PAGE,
  INVENTORY_SERVICES_PAGE,
  TERMINAL_PAGE,
  SUPPLIERS_PAGE,
  SOURCING_PAGE,
  PROCUREMENT_ORDERS_PAGE,
  PROCUREMENT_ADMIN_PAGE,
  PURCHASE_ORDERS_PAGE,
  PURCHASE_INVOICES_PAGE,
  MFG_ENGINEERING_PAGE,
  MFG_PRODUCTION_PAGE,
  MFG_QUALITY_PAGE,
  MFG_PLANNING_PAGE,
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

describe('resource page configs', () => {
  for (const [name, page] of Object.entries(PAGES)) {
    describe(name, () => {
      it('has unique tab ids and a module on every panel', () => {
        const ids = page.tabs.map((tab) => tab.id);
        expect(new Set(ids).size).toBe(ids.length);
        expect(page.tabs.every((tab) => tab.module.length > 0)).toBe(true);
      });

      it('uses API-relative paths and a form for every placeholder not provided by the row', () => {
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
});
