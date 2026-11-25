import { describe, expect, it } from 'vitest';
import { GDO_TRADE_TERMS_ROUTES } from './gdo-trade-terms.routes';

describe('gdo trade terms routes', () => {
  it('declares every page with a breadcrumb, a title key and a lazy component', () => {
    expect(GDO_TRADE_TERMS_ROUTES.map((route) => route.path)).toEqual([
      '',
      'contracts',
      'contracts/:id',
      'promotions',
      'simulator',
      'margin',
      'accruals',
      'settlements',
      'settlements/:id',
      'delivery-points',
    ]);

    for (const route of GDO_TRADE_TERMS_ROUTES) {
      expect(route.data?.['breadcrumb'], route.path).toMatch(/^NAV\.GDO_TRADE_TERMS/);
      expect(route.data?.['title'], route.path).toMatch(/^PAGE_TITLE\.GDO_TRADE_TERMS/);
      expect(route.loadComponent, route.path).toBeTypeOf('function');
    }
  });
});
