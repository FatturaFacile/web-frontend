import { describe, expect, it } from 'vitest';
import { EXPENSE_MANAGEMENT_ROUTES } from './expense-management.routes';

describe('expense management routes', () => {
  it('declares the five pages with a breadcrumb and a title key', () => {
    expect(EXPENSE_MANAGEMENT_ROUTES.map((route) => route.path)).toEqual([
      '',
      'reports/:id',
      'workbench',
      'cards',
      'violations',
    ]);

    for (const route of EXPENSE_MANAGEMENT_ROUTES) {
      expect(route.data?.['breadcrumb'], route.path).toMatch(/^NAV\.EXPENSE_MANAGEMENT/);
      expect(route.data?.['title'], route.path).toMatch(/^PAGE_TITLE\.EXPENSE_MANAGEMENT/);
      expect(route.loadComponent, route.path).toBeTypeOf('function');
    }
  });

  it('guards the card reconciliation with the finance ability', () => {
    const cards = EXPENSE_MANAGEMENT_ROUTES.find((route) => route.path === 'cards');

    expect(cards?.canActivate).toHaveLength(1);
  });
});
