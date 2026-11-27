import { describe, expect, it } from 'vitest';
import { DOWN_PAYMENTS_ROUTES } from './down-payments.routes';

describe('down payments routes', () => {
  it('opens on the chains and declares them with a breadcrumb and a title key', () => {
    expect(DOWN_PAYMENTS_ROUTES.map((route) => route.path)).toEqual(['', 'chains']);
    expect(DOWN_PAYMENTS_ROUTES[0].redirectTo).toBe('chains');

    const chains = DOWN_PAYMENTS_ROUTES[1];
    expect(chains.data?.['breadcrumb']).toBe('NAV.DOWN_PAYMENTS_CHAINS');
    expect(chains.data?.['title']).toBe('PAGE_TITLE.DOWN_PAYMENTS_CHAINS');
  });

  it('serves the list and the detail of a chain, both lazy-loaded', () => {
    const children = DOWN_PAYMENTS_ROUTES[1].children ?? [];

    expect(children.map((route) => route.path)).toEqual(['', ':id']);
    for (const child of children) {
      expect(child.loadComponent, child.path).toBeTypeOf('function');
    }
    expect(children[1].data?.['breadcrumb']).toBe('NAV.DOWN_PAYMENTS_CHAIN_DETAIL');
    expect(children[1].data?.['title']).toBe('PAGE_TITLE.DOWN_PAYMENTS_CHAIN_DETAIL');
  });
});
