import { describe, expect, it } from 'vitest';
import { PRODUCT_CATALOG_ROUTES } from './product-catalog.routes';

describe('product catalog routes', () => {
  it('declares the list, the attributes and the import / export with a breadcrumb, a title key and a lazy component', () => {
    expect(PRODUCT_CATALOG_ROUTES.map((route) => route.path)).toEqual([
      '',
      'attributes',
      'import-export',
    ]);

    for (const route of PRODUCT_CATALOG_ROUTES) {
      expect(route.data?.['breadcrumb'], route.path).toMatch(/^NAV\.PRODUCT_CATALOG/);
      expect(route.data?.['title'], route.path).toMatch(/^PAGE_TITLE\.PRODUCT_CATALOG/);
      expect(route.loadComponent, route.path).toBeTypeOf('function');
    }
  });
});
