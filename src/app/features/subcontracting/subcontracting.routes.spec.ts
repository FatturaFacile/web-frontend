import { describe, expect, it } from 'vitest';
import { SUBCONTRACTING_ROUTES } from './subcontracting.routes';

describe('subcontracting routes', () => {
  it('opens on the dashboard and declares every page with a breadcrumb, a title key and a lazy component', () => {
    expect(SUBCONTRACTING_ROUTES.map((route) => route.path)).toEqual([
      '',
      'dashboard',
      'orders',
      'register',
    ]);
    expect(SUBCONTRACTING_ROUTES[0].redirectTo).toBe('dashboard');

    for (const route of SUBCONTRACTING_ROUTES.filter((item) => item.path !== '')) {
      expect(route.data?.['breadcrumb'], route.path).toMatch(/^NAV\.SUBCONTRACTING/);
      expect(route.data?.['title'], route.path).toMatch(/^PAGE_TITLE\.SUBCONTRACTING/);
    }
  });

  it('serves the list, the creation wizard and the workspace of an order under the orders page', () => {
    const orders = SUBCONTRACTING_ROUTES.find((route) => route.path === 'orders');
    const children = orders?.children ?? [];

    expect(children.map((route) => route.path)).toEqual(['', 'new', ':id']);

    for (const child of children) {
      expect(child.loadComponent, child.path).toBeTypeOf('function');
    }
    expect(children[1].data?.['title']).toBe('PAGE_TITLE.SUBCONTRACTING_ORDER_NEW');
    expect(children[2].data?.['breadcrumb']).toBe('NAV.SUBCONTRACTING_ORDER_DETAIL');
  });

  it('lazy-loads the dashboard and the register pages', () => {
    for (const path of ['dashboard', 'register']) {
      expect(SUBCONTRACTING_ROUTES.find((route) => route.path === path)?.loadComponent).toBeTypeOf(
        'function',
      );
    }
  });
});
