import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProductCatalogApiService } from '@core';
import { ProductEditorStore } from './product-editor.store';
import { VariantMatrixComponent } from './variant-matrix.component';
import {
  baseProviders,
  colorAttribute,
  detail,
  lookups,
  product,
  sizeAttribute,
  wrap,
} from './product-catalog.testing';

describe('VariantMatrixComponent', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    api = {
      getLookups: vi.fn(() => of(wrap(lookups))),
      listAttributes: vi.fn(() => of(wrap([sizeAttribute, colorAttribute]))),
      getProduct: vi.fn(() =>
        of(
          wrap(
            detail('1', {
              variants: [
                {
                  ...product('v1', {
                    sku: 'TSH-S-BLK',
                    sale_price: '20.0000',
                    cost_price: '8.0000',
                    is_variant: true,
                    parent_id: '1',
                  }),
                  value_ids: ['v-s', 'v-blk'],
                },
                {
                  ...product('v2', {
                    sku: 'TSH-XL-BLK',
                    sale_price: '22.0000',
                    cost_price: '8.0000',
                    is_variant: true,
                    parent_id: '1',
                    price_overridden: true,
                  }),
                  value_ids: ['v-xl', 'v-blk'],
                },
              ],
            }),
          ),
        ),
      ),
      previewMatrix: vi.fn(() =>
        of(
          wrap({
            total: 2,
            new: 1,
            combinations: [
              {
                key: 'v-s|v-blk',
                values: ['v-s', 'v-blk'],
                labels: { Size: 'S', Colour: 'Black' },
                sku: 'TSH-S-BLK',
                sale_price: '20.0000',
                cost_price: '8.0000',
                exists: true,
              },
              {
                key: 'v-xl|v-blk',
                values: ['v-xl', 'v-blk'],
                labels: { Size: 'XL', Colour: 'Black' },
                sku: 'TSH-XL-BLK',
                sale_price: '22.0000',
                cost_price: '8.0000',
                exists: false,
              },
            ],
          }),
        ),
      ),
      generateMatrix: vi.fn(() => of(wrap({ created: [product('v3')], skipped: 1 }))),
      repriceVariants: vi.fn(() => of(wrap({ repriced: 2 }))),
    };
    TestBed.configureTestingModule({
      providers: [
        ...baseProviders(api),
        ProductEditorStore,
        { provide: ProductCatalogApiService, useValue: api },
      ],
    });
  });

  async function render(canWrite = true) {
    const store = TestBed.inject(ProductEditorStore);
    await store.open('1');
    const fixture = TestBed.createComponent(VariantMatrixComponent);
    fixture.componentRef.setInput('canWrite', canWrite);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, root: fixture.nativeElement as HTMLElement, store };
  }

  function tick(root: HTMLElement, label: string): void {
    const box = Array.from(root.querySelectorAll('label[nz-checkbox]')).find((candidate) =>
      (candidate.textContent ?? '').trim().startsWith(label),
    );
    (box?.querySelector('input') as HTMLInputElement).click();
  }

  function button(root: HTMLElement, text: string): HTMLButtonElement {
    return Array.from(root.querySelectorAll('button')).find((candidate) =>
      (candidate.textContent ?? '').includes(text),
    ) as HTMLButtonElement;
  }

  it('lists the values of every attribute and the variants that already exist', async () => {
    const { root } = await render();

    expect(root.querySelectorAll('fieldset.axis')).toHaveLength(2);
    expect(root.textContent).toContain('Size');
    expect(root.textContent).toContain('Black');
    expect(root.querySelectorAll('tr.variant-row')).toHaveLength(2);
    expect(root.querySelector('tr.variant-row')?.textContent).toContain('TSH-S-BLK');
  });

  it('counts the combinations of the chosen values and cannot run an empty matrix', async () => {
    const { fixture, root } = await render();

    expect(button(root, 'productCatalog.action.preview').disabled).toBe(true);
    expect(root.textContent).toContain('productCatalog.section.combinations: 0');

    tick(root, 'S');
    tick(root, 'XL');
    tick(root, 'Black');
    fixture.detectChanges();

    expect(root.textContent).toContain('productCatalog.section.combinations: 2');
    expect(button(root, 'productCatalog.action.preview').disabled).toBe(false);
  });

  it('previews the combinations with their SKU and says which already exist', async () => {
    const { fixture, root } = await render();
    tick(root, 'S');
    tick(root, 'XL');
    tick(root, 'Black');
    fixture.detectChanges();

    button(root, 'productCatalog.action.preview').click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(api['previewMatrix']).toHaveBeenCalledWith('1', {
      axes: [
        { attribute_id: 'a-size', value_ids: ['v-s', 'v-xl'] },
        { attribute_id: 'a-color', value_ids: ['v-blk'] },
      ],
      generate_barcodes: false,
    });
    const rows = root.querySelectorAll('tr.preview-row');
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain('productCatalog.status.exists');
    expect(rows[1].textContent).toContain('productCatalog.status.new');
    expect(rows[1].textContent).toContain('22.0000');
  });

  it('generates the variants and reprices on demand', async () => {
    const { fixture, root } = await render();
    tick(root, 'S');
    tick(root, 'Black');
    fixture.detectChanges();

    button(root, 'productCatalog.action.generate').click();
    await fixture.whenStable();
    expect(api['generateMatrix']).toHaveBeenCalledWith('1', {
      axes: [
        { attribute_id: 'a-size', value_ids: ['v-s'] },
        { attribute_id: 'a-color', value_ids: ['v-blk'] },
      ],
      generate_barcodes: false,
    });

    button(root, 'productCatalog.action.reprice').click();
    await fixture.whenStable();
    expect(api['repriceVariants']).toHaveBeenCalledWith('1');
  });

  it('marks the variants that keep their own price', async () => {
    const { root } = await render();
    const rows = root.querySelectorAll('tr.variant-row');

    expect(rows[0].textContent).toContain('productCatalog.status.followsParent');
    expect(rows[1].textContent).toContain('productCatalog.status.overridden');
  });

  it('hides the actions from a member who cannot write', async () => {
    const { root } = await render(false);

    expect(root.textContent).not.toContain('productCatalog.action.generate');
    expect(root.textContent).not.toContain('productCatalog.action.reprice');
  });

  it('explains that a variant or a kit has no matrix', async () => {
    api['getProduct'].mockReturnValue(of(wrap(detail('2', { kit_type: 'phantom' }))));
    const store = TestBed.inject(ProductEditorStore);
    await store.open('2');
    const fixture = TestBed.createComponent(VariantMatrixComponent);
    fixture.componentRef.setInput('canWrite', true);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'productCatalog.hint.noVariants',
    );
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('fieldset.axis')).toHaveLength(
      0,
    );
  });
});
