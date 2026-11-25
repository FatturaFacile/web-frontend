import { describe, expect, it } from 'vitest';
import { FRANCHISE_NETWORK_ROUTES } from './franchise-network.routes';

describe('franchise network routes', () => {
  it('opens on the command view and declares every page with a breadcrumb, a title key and a lazy component', () => {
    expect(FRANCHISE_NETWORK_ROUTES.map((route) => route.path)).toEqual([
      '',
      'command',
      'stores',
      'agreements',
      'formulas',
      'pushes',
      'billing',
      'audits',
      'audits/:id',
      'portal',
    ]);
    expect(FRANCHISE_NETWORK_ROUTES[0].redirectTo).toBe('command');

    for (const route of FRANCHISE_NETWORK_ROUTES.slice(1)) {
      expect(route.data?.['breadcrumb'], route.path).toMatch(/^NAV\.FRANCHISE_NETWORK/);
      expect(route.data?.['title'], route.path).toMatch(/^PAGE_TITLE\.FRANCHISE_NETWORK/);
      expect(route.loadComponent, route.path).toBeTypeOf('function');
    }
  });
});
