import { describe, expect, it } from 'vitest';
import { DISTRIBUTION_ROUTES } from './distribution.routes';

describe('distribution routes', () => {
  it('opens on the overview and declares every page with a breadcrumb, a title key and a lazy component', () => {
    expect(DISTRIBUTION_ROUTES.map((route) => route.path)).toEqual([
      '',
      'overview',
      'network',
      'transfers',
      'in-transit',
      'replenishment',
      'proposals',
      'drp',
      'consignment',
      'channels',
      'atp',
    ]);
    expect(DISTRIBUTION_ROUTES[0].redirectTo).toBe('overview');

    for (const route of DISTRIBUTION_ROUTES.slice(1)) {
      expect(route.data?.['breadcrumb'], route.path).toMatch(/^NAV\.DISTRIBUTION/);
      expect(route.data?.['title'], route.path).toMatch(/^PAGE_TITLE\.DISTRIBUTION/);
      expect(route.loadComponent, route.path).toBeTypeOf('function');
    }
  });
});
