import { describe, expect, it } from 'vitest';
import { isUrlOfEnabledMenuRoute, moduleOfUrl } from '../../core/auth/menu-enabled.guard';
import { MENU_SECTIONS } from '../../layout/sidebar/menu-sections';
import { CURRENCY_FX_ROUTES } from './currency-fx.routes';
import { CURRENCY_FX_MODULE } from './currency-fx.util';

describe('currency fx navigation', () => {
  it('has a menu entry for the currencies page under the ledger module', () => {
    const entry = MENU_SECTIONS.flatMap((section) => section.items).find(
      (item) => item.key === 'NAV.FINANCE_CURRENCIES',
    );

    expect(entry?.route).toBe('/finance/currencies');
    expect(entry?.module).toBe(CURRENCY_FX_MODULE);
  });

  it('opens the rates page and the revaluation wizard from the menu', () => {
    expect(isUrlOfEnabledMenuRoute('/finance/currencies')).toBe(true);
    expect(isUrlOfEnabledMenuRoute('/finance/currencies/revaluation')).toBe(true);
    expect(moduleOfUrl('/finance/currencies')).toBe(CURRENCY_FX_MODULE);
  });

  it('declares the two lazy pages with a translated breadcrumb and title', () => {
    expect(CURRENCY_FX_ROUTES.map((route) => route.path)).toEqual(['', 'revaluation']);
    for (const route of CURRENCY_FX_ROUTES) {
      expect(route.loadComponent).toBeTypeOf('function');
      expect(route.data?.['breadcrumb']).toMatch(/^NAV\./u);
      expect(route.data?.['title']).toMatch(/^PAGE_TITLE\./u);
    }
  });
});
