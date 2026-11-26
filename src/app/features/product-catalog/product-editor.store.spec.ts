import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProductCatalogApiService } from '@core';
import { ProductEditorStore } from './product-editor.store';
import {
  colorAttribute,
  detail,
  lookups,
  page,
  product,
  sizeAttribute,
  wrap,
} from './product-catalog.testing';

describe('ProductEditorStore', () => {
  const api = {
    getLookups: vi.fn(),
    listAttributes: vi.fn(),
    getProduct: vi.fn(),
    createProduct: vi.fn(),
    updateProduct: vi.fn(),
    listProducts: vi.fn(),
    previewMatrix: vi.fn(),
    generateMatrix: vi.fn(),
    repriceVariants: vi.fn(),
    saveKitComponents: vi.fn(),
    explodeProduct: vi.fn(),
    savePackagings: vi.fn(),
    convert: vi.fn(),
  };
  let store: InstanceType<typeof ProductEditorStore>;

  beforeEach(() => {
    Object.values(api).forEach((mock) => mock.mockReset());
    api.getLookups.mockReturnValue(of(wrap(lookups)));
    api.listAttributes.mockReturnValue(of(wrap([sizeAttribute, colorAttribute])));
    api.getProduct.mockReturnValue(of(wrap(detail('1'))));
    TestBed.configureTestingModule({
      providers: [ProductEditorStore, { provide: ProductCatalogApiService, useValue: api }],
    });
    store = TestBed.inject(ProductEditorStore);
  });

  it('opens an empty form with the lookups and the attributes', async () => {
    await store.open(null);

    expect(store.product()).toBeNull();
    expect(store.attributes()).toHaveLength(2);
    expect(store.units()).toHaveLength(2);
    expect(store.vatCodesIt().map((code) => code.code)).toEqual(['IVA22']);
    expect(store.vatCodesCh().map((code) => code.code)).toEqual(['CH_MWST_81']);
    expect(api.getProduct).not.toHaveBeenCalled();
  });

  it('opens a product and tells what it can have: variants for a parent, a bill of materials for a kit', async () => {
    await store.open('1');

    expect(store.product()?.id).toBe('1');
    expect(store.canHaveVariants()).toBe(true);
    expect(store.isKit()).toBe(false);

    api.getProduct.mockReturnValue(of(wrap(detail('2', { kit_type: 'phantom' }))));
    await store.open('2');

    expect(store.isKit()).toBe(true);
    expect(store.canHaveVariants()).toBe(false);

    api.getProduct.mockReturnValue(of(wrap(detail('3', { is_variant: true, parent_id: '1' }))));
    await store.open('3');

    expect(store.isVariant()).toBe(true);
    expect(store.canHaveVariants()).toBe(false);
  });

  it('shows the translation key when the product cannot be loaded', async () => {
    api.getProduct.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 404, error: { code: 'not_found' } })),
    );

    await store.open('1');

    expect(store.error()).toBe('productCatalog.error.not_found');
    expect(store.loading()).toBe(false);
  });

  it('creates a product from the form and opens it, with empty strings sent as null', async () => {
    await store.open(null);
    api.createProduct.mockReturnValue(of(wrap(product('9'))));
    api.getProduct.mockReturnValue(of(wrap(detail('9'))));

    const outcome = await store.save({ sku: 'NEW', name: 'New', description: '' });

    expect(outcome.ok).toBe(true);
    expect(api.createProduct).toHaveBeenCalledWith({ sku: 'NEW', name: 'New', description: null });
    expect(store.product()?.id).toBe('9');
  });

  it('saves the changes of the open product and reloads its detail', async () => {
    await store.open('1');
    api.updateProduct.mockReturnValue(of(wrap(product('1'))));

    const outcome = await store.save({ sku: 'A', name: 'B' });

    expect(outcome.ok).toBe(true);
    expect(api.updateProduct).toHaveBeenCalledWith('1', { sku: 'A', name: 'B' });
    expect(api.getProduct).toHaveBeenCalledTimes(2);
  });

  it('returns the refusal of the API with its field errors and leaves the form open', async () => {
    await store.open(null);
    api.createProduct.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 422,
            error: { code: 'gtin_invalid', params: { gtin: '1' }, errors: { barcode: ['bad'] } },
          }),
      ),
    );

    const outcome = await store.save({ sku: 'A', name: 'B', barcode: '1' });

    expect(outcome.ok).toBe(false);
    expect(outcome.errorKey).toBe('productCatalog.error.gtin_invalid');
    expect(outcome.errors['barcode']).toEqual(['bad']);
    expect(store.product()).toBeNull();
    expect(store.saving()).toBe(false);
  });

  it('previews the matrix, then generates it and reloads the variants', async () => {
    await store.open('1');
    const request = { axes: [{ attribute_id: 'a-size', value_ids: ['v-s'] }] };
    api.previewMatrix.mockReturnValue(of(wrap({ total: 1, new: 1, combinations: [] })));
    api.generateMatrix.mockReturnValue(of(wrap({ created: [product('v1')], skipped: 0 })));

    await store.previewMatrix(request);
    expect(api.previewMatrix).toHaveBeenCalledWith('1', request);
    expect(store.preview()?.total).toBe(1);

    await store.generateMatrix(request);
    expect(api.generateMatrix).toHaveBeenCalledWith('1', request);
    expect(store.generated()?.created).toHaveLength(1);
    expect(store.preview()).toBeNull();
    expect(api.getProduct).toHaveBeenCalledTimes(2);
  });

  it('clears the preview when the chosen values change', async () => {
    await store.open('1');
    api.previewMatrix.mockReturnValue(of(wrap({ total: 1, new: 1, combinations: [] })));
    await store.previewMatrix({ axes: [] });

    store.clearPreview();

    expect(store.preview()).toBeNull();
    expect(store.generated()).toBeNull();
  });

  it('reprices the variants and reloads them', async () => {
    await store.open('1');
    api.repriceVariants.mockReturnValue(of(wrap({ repriced: 3 })));

    const outcome = await store.repriceVariants();

    expect(outcome.ok).toBe(true);
    expect(api.repriceVariants).toHaveBeenCalledWith('1');
    expect(api.getProduct).toHaveBeenCalledTimes(2);
  });

  it('saves the bill of materials and previews the explosion', async () => {
    api.getProduct.mockReturnValue(of(wrap(detail('1', { kit_type: 'phantom' }))));
    await store.open('1');
    const lines = [{ component_id: 'c-1', quantity: '2', is_optional: false }];
    api.saveKitComponents.mockReturnValue(
      of(
        wrap(
          detail('1', {
            kit_type: 'phantom',
            kit_components: [
              {
                component_id: 'c-1',
                sku: 'C',
                name: 'C',
                quantity: '2.000000',
                is_optional: false,
              },
            ],
          }),
        ),
      ),
    );
    api.explodeProduct.mockReturnValue(
      of(wrap([{ product_id: 'c-1', sku: 'C', name: 'C', quantity: '6', via_kits: ['SKU-1'] }])),
    );

    await store.saveKit(lines);
    await store.explode('3', false);

    expect(api.saveKitComponents).toHaveBeenCalledWith('1', lines);
    expect(store.product()?.kit_components).toHaveLength(1);
    expect(api.explodeProduct).toHaveBeenCalledWith('1', '3', false);
    expect(store.explosion()?.[0].quantity).toBe('6');
  });

  it('saves the packaging hierarchy and converts a quantity', async () => {
    await store.open('1');
    const payload = {
      uom_rounding: 'half_up' as const,
      uom_precision: 4,
      levels: [
        {
          code: 'PACK6',
          uom_id: 'u-pz',
          units_per_parent: '6',
          parent_code: null,
          role: 'sales' as const,
          gtin: null,
        },
      ],
    };
    api.savePackagings.mockReturnValue(of(wrap(detail('1'))));
    api.convert.mockReturnValue(
      of(
        wrap({
          base: '48',
          units: { BASE: '48', PACK6: '8' },
          split: { parts: [{ unit: 'PACK6', quantity: '8' }], remainder: '0' },
        }),
      ),
    );

    await store.savePackagings(payload);
    await store.convert('48', 'BASE');

    expect(api.savePackagings).toHaveBeenCalledWith('1', payload);
    expect(api.convert).toHaveBeenCalledWith('1', '48', 'BASE');
    expect(store.conversion()?.units['PACK6']).toBe('8');
  });

  it('searches the products to pick as components without the product itself', async () => {
    await store.open('1');
    api.listProducts.mockReturnValue(of(page([product('1'), product('2')])));

    const found = await store.searchProducts('bolt');

    expect(api.listProducts).toHaveBeenCalledWith({
      q: 'bolt',
      kind: 'all',
      per_page: 20,
      page: 1,
    });
    expect(found.map((p) => p.id)).toEqual(['2']);
  });

  it('refuses matrix, kit and unit writes before a product exists', async () => {
    await store.open(null);

    expect((await store.previewMatrix({ axes: [] })).ok).toBe(false);
    expect((await store.saveKit([])).ok).toBe(false);
    expect((await store.convert('1', 'BASE')).ok).toBe(false);
    expect(api.previewMatrix).not.toHaveBeenCalled();
  });
});
