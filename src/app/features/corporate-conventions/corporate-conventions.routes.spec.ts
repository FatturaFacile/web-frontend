import { describe, expect, it } from 'vitest';
import { CORPORATE_CONVENTIONS_ROUTES } from './corporate-conventions.routes';

describe('corporate conventions routes', () => {
  it('declares the list, the ROI dashboard and the billing centre with a breadcrumb, a title key and a lazy component', () => {
    expect(CORPORATE_CONVENTIONS_ROUTES.map((route) => route.path)).toEqual([
      '',
      'dashboard',
      'billing-reconciliation',
    ]);

    for (const route of CORPORATE_CONVENTIONS_ROUTES) {
      expect(route.data?.['breadcrumb'], route.path).toMatch(/^NAV\.CORPORATE_CONVENTIONS/);
      expect(route.data?.['title'], route.path).toMatch(/^PAGE_TITLE\.CORPORATE_CONVENTIONS/);
      expect(route.loadComponent, route.path).toBeTypeOf('function');
    }
  });
});
