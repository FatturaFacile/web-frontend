import { describe, expect, it } from 'vitest';
import { CUSTOMER_SATISFACTION_ROUTES } from './customer-satisfaction.routes';

describe('customer satisfaction routes', () => {
  it('opens on the dashboard and declares every page with a breadcrumb, a title key and a lazy component', () => {
    expect(CUSTOMER_SATISFACTION_ROUTES.map((route) => route.path)).toEqual([
      '',
      'dashboard',
      'recovery',
      'templates',
      'dispatches',
    ]);
    expect(CUSTOMER_SATISFACTION_ROUTES[0].redirectTo).toBe('dashboard');

    for (const route of CUSTOMER_SATISFACTION_ROUTES.slice(1)) {
      expect(route.data?.['breadcrumb'], route.path).toMatch(/^NAV\.CUSTOMER_SATISFACTION/);
      expect(route.data?.['title'], route.path).toMatch(/^PAGE_TITLE\.CUSTOMER_SATISFACTION/);
      expect(route.loadComponent, route.path).toBeTypeOf('function');
    }
  });
});
