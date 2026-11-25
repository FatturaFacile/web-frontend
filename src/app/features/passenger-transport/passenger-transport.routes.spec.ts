import { describe, expect, it } from 'vitest';
import { PASSENGER_TRANSPORT_ROUTES } from './passenger-transport.routes';

describe('passenger transport routes', () => {
  it('opens on the dispatch board and declares every page with a breadcrumb, a title key and a lazy component', () => {
    expect(PASSENGER_TRANSPORT_ROUTES.map((route) => route.path)).toEqual([
      '',
      'dispatch',
      'bookings',
      'bookings/:id/sheet',
      'fleet',
      'tachograph',
      'contracts-billing',
    ]);
    expect(PASSENGER_TRANSPORT_ROUTES[0].redirectTo).toBe('dispatch');

    for (const route of PASSENGER_TRANSPORT_ROUTES.slice(1)) {
      expect(route.data?.['breadcrumb'], route.path).toMatch(/^NAV\.PASSENGER_TRANSPORT/);
      expect(route.data?.['title'], route.path).toMatch(/^PAGE_TITLE\.PASSENGER_TRANSPORT/);
      expect(route.loadComponent, route.path).toBeTypeOf('function');
    }
  });
});
