import { describe, expect, it } from 'vitest';
import { SWISS_EBILL_ROUTES } from './swiss-ebill.routes';

describe('swiss eBill routes', () => {
  it('opens on the dashboard and declares every page with a breadcrumb, a title key and a lazy component', () => {
    expect(SWISS_EBILL_ROUTES.map((route) => route.path)).toEqual(['', 'dashboard', 'settings']);
    expect(SWISS_EBILL_ROUTES[0].redirectTo).toBe('dashboard');

    for (const route of SWISS_EBILL_ROUTES.slice(1)) {
      expect(route.data?.['breadcrumb'], route.path).toMatch(/^NAV\.SWISS_EBILL_/);
      expect(route.data?.['title'], route.path).toMatch(/^PAGE_TITLE\.SWISS_EBILL_/);
      expect(route.loadComponent, route.path).toBeTypeOf('function');
    }
  });
});
