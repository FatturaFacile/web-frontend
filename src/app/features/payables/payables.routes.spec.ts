import { Route } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { PAYABLES_ROUTES } from './payables.routes';

function leaves(routes: readonly Route[], prefix = ''): { path: string; route: Route }[] {
  return routes.flatMap((route) => {
    const path = [prefix, route.path].filter((part) => !!part).join('/');
    return route.children ? leaves(route.children, path) : [{ path, route }];
  });
}

describe('PAYABLES_ROUTES', () => {
  it('opens the pages of the module, the wizard before the batch detail', () => {
    expect(leaves(PAYABLES_ROUTES).map((leaf) => leaf.path)).toEqual([
      '',
      'batches',
      'batches/new',
      'batches/:id',
      'aging',
    ]);
  });

  it('lazy loads a standalone component for every page', async () => {
    for (const { path, route } of leaves(PAYABLES_ROUTES)) {
      expect(route.loadComponent, path).toBeTypeOf('function');
      const component = await (route.loadComponent as () => Promise<unknown>)();
      expect(component, path).toBeTruthy();
    }
  });

  it('gives each section a breadcrumb and a page title', () => {
    for (const route of PAYABLES_ROUTES) {
      expect(route.data?.['breadcrumb'], route.path).toMatch(/^NAV\./);
      expect(route.data?.['title'], route.path).toMatch(/^PAGE_TITLE\./);
    }
  });
});
