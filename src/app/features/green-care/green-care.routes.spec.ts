import { describe, expect, it } from 'vitest';
import { GREEN_CARE_ROUTES } from './green-care.routes';

describe('green care routes', () => {
  it('opens on the dashboard and declares every page with a breadcrumb, a title key and a lazy component', () => {
    expect(GREEN_CARE_ROUTES.map((route) => route.path)).toEqual([
      '',
      'dashboard',
      'sites',
      'contracts',
      'planner',
      'treatments',
      'waste',
    ]);
    expect(GREEN_CARE_ROUTES[0].redirectTo).toBe('dashboard');

    for (const route of GREEN_CARE_ROUTES.slice(1)) {
      expect(route.data?.['breadcrumb'], route.path).toMatch(/^NAV\.GREEN_CARE_/);
      expect(route.data?.['title'], route.path).toMatch(/^PAGE_TITLE\.GREEN_CARE_/);
      expect(route.loadComponent, route.path).toBeTypeOf('function');
    }
  });
});
