import { ResourceAction, ResourcePageConfig } from '@shared';
import { describe, expect, it } from 'vitest';
import { GL_CONTROLS_PAGE, GL_STATEMENTS_PAGE, GL_TAX_PAGE } from '../../general-ledger/fiscal/gl-fiscal.pages';
import { SUBSCRIPTIONS_CATALOG_PAGE } from '../../subscriptions/subscriptions-catalog.page';
import { INVOICE_COLLECTIONS_PAGE, SALES_COMMISSIONS_PAGE, SALES_TAX_DATA_PAGE } from './billing-extras.page';

const PAGES: Record<string, ResourcePageConfig> = {
  INVOICE_COLLECTIONS_PAGE,
  SALES_TAX_DATA_PAGE,
  SALES_COMMISSIONS_PAGE,
  GL_TAX_PAGE,
  GL_STATEMENTS_PAGE,
  GL_CONTROLS_PAGE,
  SUBSCRIPTIONS_CATALOG_PAGE,
};

function actionsOf(page: ResourcePageConfig): ResourceAction[] {
  return page.tabs.flatMap((tab) => [...(tab.create ? [tab.create] : []), ...(tab.rowActions ?? []), ...(tab.toolbar ?? [])]);
}

describe('invoicing, ledger and subscription resource pages', () => {
  for (const [name, page] of Object.entries(PAGES)) {
    describe(name, () => {
      it('has unique tab ids and a module on every panel', () => {
        const ids = page.tabs.map((tab) => tab.id);
        expect(new Set(ids).size).toBe(ids.length);
        expect(page.tabs.every((tab) => tab.module.length > 0)).toBe(true);
      });

      it('uses API-relative paths and unique action keys per panel', () => {
        for (const tab of page.tabs) {
          expect(tab.list.path.startsWith('/')).toBe(true);
          expect(tab.list.path.includes('/v1/')).toBe(false);
          const keys = [...(tab.create ? [tab.create] : []), ...(tab.rowActions ?? []), ...(tab.toolbar ?? [])].map((a) => a.key);
          expect(new Set(keys).size).toBe(keys.length);
        }
        for (const action of actionsOf(page)) {
          expect(action.path.startsWith('/')).toBe(true);
          expect(action.path.includes('/v1/')).toBe(false);
        }
      });
    });
  }

  it('lets the user record a payment and send a reminder on an unpaid invoice', () => {
    const tab = INVOICE_COLLECTIONS_PAGE.tabs[0];
    const record = tab.rowActions?.find((a) => a.path === '/sales/invoices/{id}/payments' && a.method === 'POST');
    expect(record?.visible?.({ id: '1', payment_status: 'unpaid' })).toBe(true);
    expect(record?.visible?.({ id: '1', payment_status: 'paid' })).toBe(false);
    expect(tab.rowActions?.some((a) => a.path === '/sales/invoices/{id}/reminders' && a.method === 'POST')).toBe(true);
  });

  it('gates commission statement transitions on their status', () => {
    const actions = SALES_COMMISSIONS_PAGE.tabs[0].rowActions ?? [];
    const visibleFor = (status: string) => actions.filter((a) => a.visible?.({ id: '1', status })).map((a) => a.path.split('/').pop());
    expect(visibleFor('draft')).toEqual(['approve']);
    expect(visibleFor('approved')).toEqual(['post']);
    expect(visibleFor('posted')).toEqual(['paid']);
  });
});
