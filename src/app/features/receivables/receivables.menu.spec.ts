import { describe, expect, it } from 'vitest';
import { canAccessModule } from '@core';
import { isUrlOfEnabledMenuRoute, moduleOfUrl } from '../../core/auth/menu-enabled.guard';
import { MENU_SECTIONS } from '../../layout/sidebar/menu-sections';
import { RECEIVABLES_MODULE } from './receivables.util';

const PAGES = [
  '/receivables',
  '/receivables/items',
  '/receivables/ledger',
  '/receivables/credit',
  '/receivables/statement',
];

describe('receivables navigation', () => {
  const group = MENU_SECTIONS.flatMap((section) => section.items).find(
    (item) => item.key === 'NAV.RECEIVABLES',
  );

  it('has a menu group with the five pages', () => {
    expect(group?.module).toBe(RECEIVABLES_MODULE);
    expect(group?.children?.map((child) => child.route)).toEqual(PAGES);
  });

  it('opens every page of the group from the menu, with or without a customer', () => {
    for (const page of PAGES) {
      expect(isUrlOfEnabledMenuRoute(page), page).toBe(true);
    }
    expect(isUrlOfEnabledMenuRoute('/receivables/items?bucket=31_60&customer_id=c-1')).toBe(true);
    expect(isUrlOfEnabledMenuRoute('/receivables/ledger/c-1')).toBe(true);
    expect(isUrlOfEnabledMenuRoute('/receivables/statement/c-1')).toBe(true);
  });

  it('guards the pages with the receivables module', () => {
    for (const url of [...PAGES, '/receivables/credit/c-1', '/receivables/items?bucket=1_30']) {
      expect(moduleOfUrl(url), url).toBe(RECEIVABLES_MODULE);
    }
  });

  it('is a module of the access map every member can read', () => {
    expect(canAccessModule(RECEIVABLES_MODULE, 'read', ['warehouse'])).toBe(true);
    expect(canAccessModule(RECEIVABLES_MODULE, 'write', ['warehouse'])).toBe(false);
    expect(canAccessModule(RECEIVABLES_MODULE, 'write', ['accountant'])).toBe(true);
  });
});
