import { describe, expect, it } from 'vitest';
import { INDUSTRIAL_LAUNDRY_ROUTES } from './industrial-laundry.routes';

describe('industrial laundry routes', () => {
  it('declares every page with a breadcrumb, a title key and a lazy component', () => {
    expect(INDUSTRIAL_LAUNDRY_ROUTES.map((route) => route.path)).toEqual([
      '',
      'lockers',
      'ppe',
      'dormant',
      'rabc',
      'billing',
    ]);

    for (const route of INDUSTRIAL_LAUNDRY_ROUTES) {
      expect(route.data?.['breadcrumb'], route.path).toMatch(/^NAV\.INDUSTRIAL_LAUNDRY/);
      expect(route.data?.['title'], route.path).toMatch(/^PAGE_TITLE\.INDUSTRIAL_LAUNDRY/);
      expect(route.loadComponent, route.path).toBeTypeOf('function');
    }
  });
});
