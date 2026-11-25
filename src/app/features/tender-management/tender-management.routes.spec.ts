import { describe, expect, it } from 'vitest';
import { TENDER_MANAGEMENT_ROUTES } from './tender-management.routes';

describe('tender management routes', () => {
  it('declares the four pages with a breadcrumb and a title key', () => {
    expect(TENDER_MANAGEMENT_ROUTES.map((route) => route.path)).toEqual([
      '',
      'participations/:id',
      'vault',
      'benchmarks',
    ]);

    for (const route of TENDER_MANAGEMENT_ROUTES) {
      expect(route.data?.['breadcrumb'], route.path).toMatch(/^NAV\.TENDER_MANAGEMENT/);
      expect(route.data?.['title'], route.path).toMatch(/^PAGE_TITLE\.TENDER_MANAGEMENT/);
      expect(route.loadComponent, route.path).toBeTypeOf('function');
    }
  });
});
