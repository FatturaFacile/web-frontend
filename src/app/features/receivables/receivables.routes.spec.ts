import { Route } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { RECEIVABLES_ROUTES } from './receivables.routes';

function leaves(routes: readonly Route[], prefix = ''): { path: string; route: Route }[] {
  return routes.flatMap((route) => {
    const path = [prefix, route.path].filter((part) => !!part).join('/');
    return route.children ? leaves(route.children, path) : [{ path, route }];
  });
}

describe('RECEIVABLES_ROUTES', () => {
  it('opens the five pages of the module, the customer ones with and without a customer', () => {
    expect(leaves(RECEIVABLES_ROUTES).map((leaf) => leaf.path)).toEqual([
      '',
      'items',
      'ledger',
      'ledger/:customerId',
      'credit',
      'credit/:customerId',
      'statement',
      'statement/:customerId',
    ]);
  });

  it('lazy loads a standalone component for every page', async () => {
    for (const { path, route } of leaves(RECEIVABLES_ROUTES)) {
      expect(route.loadComponent, path).toBeTypeOf('function');
      const component = await (route.loadComponent as () => Promise<unknown>)();
      expect(component, path).toBeTruthy();
    }
  });

  it('gives each section a breadcrumb and a page title', () => {
    for (const route of RECEIVABLES_ROUTES) {
      expect(route.data?.['breadcrumb'], route.path).toMatch(/^NAV\./);
      expect(route.data?.['title'], route.path).toMatch(/^PAGE_TITLE\./);
    }
  });
});
