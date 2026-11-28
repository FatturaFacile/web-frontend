import { describe, expect, it } from 'vitest';
import { BONDED_WAREHOUSES_ROUTES } from './bonded-warehouses.routes';

describe('bonded warehouses routes', () => {
  it('opens on the dashboard and declares every page with a breadcrumb, a title key and a lazy component', () => {
    expect(BONDED_WAREHOUSES_ROUTES.map((route) => route.path)).toEqual([
      '',
      'dashboard',
      'mrn-ledger',
      'vat-register',
      'aeo',
      'authorizations',
    ]);
    expect(BONDED_WAREHOUSES_ROUTES[0].redirectTo).toBe('dashboard');

    for (const route of BONDED_WAREHOUSES_ROUTES.slice(1)) {
      expect(route.data?.['breadcrumb'], route.path).toMatch(/^NAV\.BONDED_WAREHOUSES_/);
      expect(route.data?.['title'], route.path).toMatch(/^PAGE_TITLE\.BONDED_WAREHOUSES_/);
      expect(route.loadComponent, route.path).toBeTypeOf('function');
    }
  });
});
