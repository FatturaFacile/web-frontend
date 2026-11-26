import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProductCatalogApiService } from '@core';
import { CatalogProductsStore } from './catalog-products.store';
import { lookups, page, product, wrap } from './product-catalog.testing';

describe('CatalogProductsStore', () => {
  const api = { getLookups: vi.fn(), listProducts: vi.fn(), deleteProduct: vi.fn() };
  let store: InstanceType<typeof CatalogProductsStore>;

  beforeEach(() => {
    Object.values(api).forEach((mock) => mock.mockReset());
    api.getLookups.mockReturnValue(of(wrap(lookups)));
    api.listProducts.mockReturnValue(of(page([product('1'), product('2')], 40)));
    TestBed.configureTestingModule({
      providers: [CatalogProductsStore, { provide: ProductCatalogApiService, useValue: api }],
    });
    store = TestBed.inject(CatalogProductsStore);
  });

  it('loads the lookups and the first page of parents and simple products', async () => {
    await store.init();

    expect(store.productTypes()).toEqual(['storable', 'consumable', 'service', 'digital']);
    expect(store.kitTypes()).toEqual(['phantom', 'physical']);
    expect(store.products()).toHaveLength(2);
    expect(store.total()).toBe(40);
    expect(api.listProducts).toHaveBeenCalledWith({ kind: 'catalog', per_page: 25, page: 1 });
  });

  it('restarts from the first page when a filter changes and keeps the others', async () => {
    await store.init();
    await store.setPage(3);
    await store.setFilters({ product_type: 'service' });
    await store.setFilters({ kit_type: 'phantom' });

    expect(api.listProducts).toHaveBeenLastCalledWith({
      kind: 'catalog',
      per_page: 25,
      page: 1,
      product_type: 'service',
      kit_type: 'phantom',
    });
  });

  it('asks for the page it is given', async () => {
    await store.init();
    await store.setPage(2);

    expect(api.listProducts).toHaveBeenLastCalledWith({ kind: 'catalog', per_page: 25, page: 2 });
  });

  it('keeps only the answer of the latest request', async () => {
    let releaseFirst: (value: unknown) => void = () => undefined;
    api.listProducts.mockReturnValueOnce({
      subscribe: (observer: { next: (value: unknown) => void; complete: () => void }) => {
        releaseFirst = (value) => {
          observer.next(value);
          observer.complete();
        };
      },
    });
    api.listProducts.mockReturnValueOnce(of(page([product('new')], 1)));

    const first = store.setFilters({ q: 'old' });
    await store.setFilters({ q: 'new' });
    releaseFirst(page([product('old')], 1));
    await first;

    expect(store.products().map((p) => p.id)).toEqual(['new']);
  });

  it('shows the translation key of a failed load', async () => {
    api.listProducts.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 500, error: { code: 'boom' } })),
    );

    await store.init();

    expect(store.error()).toBe('productCatalog.error.boom');
    expect(store.loading()).toBe(false);
  });

  it('deletes a product and reloads, or returns the refusal', async () => {
    await store.init();
    api.deleteProduct.mockReturnValueOnce(of(wrap(null)));

    const done = await store.remove('1');

    expect(done.ok).toBe(true);
    expect(api.deleteProduct).toHaveBeenCalledWith('1');
    expect(api.listProducts).toHaveBeenCalledTimes(2);

    api.deleteProduct.mockReturnValueOnce(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 409,
            error: { code: 'product_in_use_by_kit', params: { sku: 'A' } },
          }),
      ),
    );
    const refused = await store.remove('2');

    expect(refused.ok).toBe(false);
    expect(refused.errorKey).toBe('productCatalog.error.product_in_use_by_kit');
    expect(refused.params).toEqual({ sku: 'A' });
  });
});
