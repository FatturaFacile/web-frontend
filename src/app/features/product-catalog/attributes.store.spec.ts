import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProductCatalogApiService } from '@core';
import { AttributesStore } from './attributes.store';
import { colorAttribute, sizeAttribute, wrap } from './product-catalog.testing';

describe('AttributesStore', () => {
  const api = {
    listAttributes: vi.fn(),
    createAttribute: vi.fn(),
    updateAttribute: vi.fn(),
    deleteAttribute: vi.fn(),
  };
  let store: InstanceType<typeof AttributesStore>;

  beforeEach(() => {
    Object.values(api).forEach((mock) => mock.mockReset());
    api.listAttributes.mockReturnValue(of(wrap([sizeAttribute, colorAttribute])));
    TestBed.configureTestingModule({
      providers: [AttributesStore, { provide: ProductCatalogApiService, useValue: api }],
    });
    store = TestBed.inject(AttributesStore);
  });

  const payload = {
    code: 'fit',
    name: { en: 'Fit' },
    values: [
      {
        code: 'slim',
        label: { en: 'Slim' },
        sku_token: 'SLM',
        price_delta: null,
        price_delta_type: null,
        cost_delta: null,
        cost_delta_type: null,
      },
    ],
  };

  it('loads the attributes with their values', async () => {
    await store.init();

    expect(store.attributes().map((attribute) => attribute.code)).toEqual(['size', 'color']);
    expect(store.loading()).toBe(false);
  });

  it('creates an attribute and reloads the list', async () => {
    api.createAttribute.mockReturnValue(of(wrap(sizeAttribute)));

    const outcome = await store.save(payload, null);

    expect(outcome.ok).toBe(true);
    expect(api.createAttribute).toHaveBeenCalledWith(payload);
    expect(api.listAttributes).toHaveBeenCalledTimes(1);
  });

  it('updates an attribute without sending its code, which cannot change', async () => {
    api.updateAttribute.mockReturnValue(of(wrap(sizeAttribute)));

    await store.save(payload, 'a-size');

    const [id, sent] = api.updateAttribute.mock.calls[0];
    expect(id).toBe('a-size');
    expect(sent.code).toBeUndefined();
    expect(sent.values).toHaveLength(1);
  });

  it('returns the refusal when a value is still carried by variants', async () => {
    api.updateAttribute.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 409,
            error: { code: 'attribute_value_in_use', params: { code: 's' } },
          }),
      ),
    );

    const outcome = await store.save(payload, 'a-size');

    expect(outcome.ok).toBe(false);
    expect(outcome.errorKey).toBe('productCatalog.error.attribute_value_in_use');
    expect(store.saving()).toBe(false);
  });

  it('deletes an attribute and reloads, or returns the refusal', async () => {
    api.deleteAttribute.mockReturnValueOnce(of(wrap(null)));

    expect((await store.remove('a-size')).ok).toBe(true);
    expect(api.listAttributes).toHaveBeenCalledTimes(1);

    api.deleteAttribute.mockReturnValueOnce(
      throwError(() => new HttpErrorResponse({ status: 409, error: { code: 'attribute_in_use' } })),
    );

    expect((await store.remove('a-color')).errorKey).toBe('productCatalog.error.attribute_in_use');
  });

  it('shows the translation key of a failed load', async () => {
    api.listAttributes.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));

    await store.init();

    expect(store.error()).toBe('productCatalog.error.generic');
  });
});
