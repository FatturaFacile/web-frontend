import { describe, expect, it } from 'vitest';
import { FOREIGN_VAT_REFUND_ROUTES } from './foreign-vat-refund.routes';

describe('foreign VAT refund routes', () => {
  it('opens on the dashboard and declares every page with a breadcrumb, a title key and a lazy component', () => {
    expect(FOREIGN_VAT_REFUND_ROUTES.map((route) => route.path)).toEqual([
      '',
      'dashboard',
      'ledger',
      'claims',
      'configuration',
    ]);
    expect(FOREIGN_VAT_REFUND_ROUTES[0].redirectTo).toBe('dashboard');

    for (const route of FOREIGN_VAT_REFUND_ROUTES.slice(1)) {
      expect(route.data?.['breadcrumb'], route.path).toMatch(/^NAV\.FOREIGN_VAT_/);
      expect(route.data?.['title'], route.path).toMatch(/^PAGE_TITLE\.FOREIGN_VAT_/);
      expect(route.loadComponent, route.path).toBeTypeOf('function');
    }
  });
});
