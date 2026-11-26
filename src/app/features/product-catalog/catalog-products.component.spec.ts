import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CatalogProductsComponent } from './catalog-products.component';
import { baseProviders, lookups, page, product, wrap } from './product-catalog.testing';

describe('CatalogProductsComponent', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let canWrite: boolean;

  beforeEach(() => {
    canWrite = true;
    api = {
      getLookups: vi.fn(() => of(wrap(lookups))),
      listProducts: vi.fn(() =>
        of(
          page([
            product('1', { sku: 'TSH', name: 'T-shirt', variants_count: 15 }),
            product('2', {
              sku: 'KIT-1',
              name: 'Welcome bundle',
              kit_type: 'phantom',
              track_inventory: false,
            }),
            product('3', {
              sku: 'LIC',
              name: 'Licence',
              product_type: 'digital',
              is_active: false,
            }),
          ]),
        ),
      ),
      deleteProduct: vi.fn(() => of(wrap(null))),
      listAttributes: vi.fn(() => of(wrap([]))),
      getProduct: vi.fn(),
    };
    TestBed.configureTestingModule({ providers: baseProviders(api, () => canWrite) });
  });

  async function render() {
    const fixture = TestBed.createComponent(CatalogProductsComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  function rowOf(root: HTMLElement, sku: string): Element | undefined {
    return Array.from(root.querySelectorAll('tbody tr.product-row')).find((row) =>
      (row.textContent ?? '').includes(sku),
    );
  }

  it('lists the catalog with type, kit type, variants, price and status', async () => {
    const root = await render();

    expect(api['listProducts']).toHaveBeenCalledWith({ kind: 'catalog', per_page: 25, page: 1 });
    expect(root.querySelectorAll('tbody tr.product-row')).toHaveLength(3);

    const shirt = rowOf(root, 'TSH')?.textContent ?? '';
    expect(shirt).toContain('T-shirt');
    expect(shirt).toContain('productCatalog.productType.storable');
    expect(shirt).toContain('15');
    expect(shirt).toContain('25.0000');
    expect(shirt).toContain('productCatalog.status.active');

    const kit = rowOf(root, 'KIT-1')?.textContent ?? '';
    expect(kit).toContain('productCatalog.kitType.phantom');

    const licence = rowOf(root, 'LIC')?.textContent ?? '';
    expect(licence).toContain('productCatalog.productType.digital');
    expect(licence).toContain('productCatalog.status.inactive');
  });

  it('links to the attributes and to the import / export', async () => {
    const root = await render();
    const links = Array.from(root.querySelectorAll('a')).map((link) => link.getAttribute('href'));

    expect(links.some((href) => (href ?? '').endsWith('attributes'))).toBe(true);
    expect(links.some((href) => (href ?? '').endsWith('import-export'))).toBe(true);
  });

  it('offers creation and deletion to a member who can write', async () => {
    const root = await render();

    expect(root.textContent).toContain('productCatalog.action.newProduct');
    expect(rowOf(root, 'TSH')?.textContent).toContain('productCatalog.action.delete');
    expect(rowOf(root, 'TSH')?.textContent).toContain('productCatalog.action.edit');
  });

  it('hides creation and deletion from a member who cannot write, but keeps the edit view', async () => {
    canWrite = false;
    const root = await render();

    expect(root.textContent).not.toContain('productCatalog.action.newProduct');
    expect(rowOf(root, 'TSH')?.textContent).not.toContain('productCatalog.action.delete');
    expect(rowOf(root, 'TSH')?.textContent).toContain('productCatalog.action.edit');
  });

  it('shows the empty state when the catalog has no product', async () => {
    api['listProducts'].mockReturnValue(of(page([])));

    const root = await render();

    expect(root.textContent).toContain('productCatalog.empty.products');
    expect(root.querySelectorAll('tbody tr.product-row')).toHaveLength(0);
  });

  it('opens the editor of a product in the drawer', async () => {
    const root = await render();
    api['getProduct'].mockReturnValue(
      of(wrap({ ...product('1'), axes: [], variants: [], packagings: [], kit_components: [] })),
    );
    const edit = Array.from(rowOf(root, 'TSH')?.querySelectorAll('button') ?? []).find((button) =>
      (button.textContent ?? '').includes('productCatalog.action.edit'),
    );

    (edit as HTMLButtonElement).click();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    expect(api['getProduct']).toHaveBeenCalledWith('1');
  });
});
