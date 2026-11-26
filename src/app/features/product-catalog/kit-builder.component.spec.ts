import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProductCatalogApiService } from '@core';
import { KitBuilderComponent } from './kit-builder.component';
import { ProductEditorStore } from './product-editor.store';
import { baseProviders, detail, lookups, page, product, wrap } from './product-catalog.testing';

describe('KitBuilderComponent', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;

  const phantom = detail('kit', {
    kit_type: 'phantom',
    track_inventory: false,
    kit_components: [
      {
        id: 'l1',
        component_id: 'bolt',
        sku: 'BOLT',
        name: 'Bolt',
        quantity: '4.000000',
        is_optional: false,
      },
      {
        id: 'l2',
        component_id: 'gift',
        sku: 'GIFT',
        name: 'Gift card',
        quantity: '1.000000',
        is_optional: true,
      },
    ],
  });

  beforeEach(() => {
    api = {
      getLookups: vi.fn(() => of(wrap(lookups))),
      listAttributes: vi.fn(() => of(wrap([]))),
      getProduct: vi.fn(() => of(wrap(phantom))),
      listProducts: vi.fn(() => of(page([product('nut', { sku: 'NUT', name: 'Nut' })]))),
      saveKitComponents: vi.fn(() => of(wrap(phantom))),
      explodeProduct: vi.fn(() =>
        of(
          wrap([
            {
              product_id: 'bolt',
              sku: 'BOLT',
              name: 'Bolt',
              quantity: '12',
              via_kits: ['SKU-kit'],
            },
          ]),
        ),
      ),
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
    await TestBed.inject(ProductEditorStore).open('kit');
    const fixture = TestBed.createComponent(KitBuilderComponent);
    fixture.componentRef.setInput('canWrite', canWrite);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, root: fixture.nativeElement as HTMLElement };
  }

  function button(root: HTMLElement, text: string): HTMLButtonElement {
    return Array.from(root.querySelectorAll('button')).find((candidate) =>
      (candidate.textContent ?? '').includes(text),
    ) as HTMLButtonElement;
  }

  it('shows the bill of materials of the kit with the explanation of its type', async () => {
    const { root } = await render();

    expect(root.querySelectorAll('.kit-line')).toHaveLength(2);
    expect(root.textContent).toContain('productCatalog.hint.phantom');
    const quantities = Array.from(root.querySelectorAll('.kit-quantity')).map(
      (input) => (input as HTMLInputElement).value,
    );
    expect(quantities).toEqual(['4.000000', '1.000000']);
  });

  it('adds an empty line and refuses to save until it has a component', async () => {
    const { fixture, root } = await render();

    button(root, 'productCatalog.action.addLine').click();
    fixture.detectChanges();

    expect(root.querySelectorAll('.kit-line')).toHaveLength(3);
    expect(root.textContent).toContain('productCatalog.error.component_not_found');
    expect(button(root, 'productCatalog.action.saveKit').disabled).toBe(true);
  });

  it('removes a line and saves the rest', async () => {
    const { fixture, root } = await render();

    button(root, 'productCatalog.action.remove').click();
    fixture.detectChanges();
    expect(root.querySelectorAll('.kit-line')).toHaveLength(1);

    button(root, 'productCatalog.action.saveKit').click();
    await fixture.whenStable();

    expect(api['saveKitComponents']).toHaveBeenCalledWith('kit', [
      { component_id: 'gift', quantity: '1.000000', is_optional: true },
    ]);
  });

  it('explodes the kit for a quantity and shows the lines for picking and the delivery note', async () => {
    const { fixture, root } = await render();
    const quantity = root.querySelector('#pc-kit-qty') as HTMLInputElement;
    quantity.value = '3';
    quantity.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    button(root, 'productCatalog.action.explode').click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(api['explodeProduct']).toHaveBeenCalledWith('kit', '3', false);
    const rows = root.querySelectorAll('tr.explosion-row');
    expect(rows).toHaveLength(1);
    expect(rows[0].textContent).toContain('BOLT');
    expect(rows[0].textContent).toContain('12');
    expect(rows[0].textContent).toContain('SKU-kit');
  });

  it('hides the editing buttons from a member who cannot write, keeping the explosion', async () => {
    const { root } = await render(false);

    expect(root.textContent).not.toContain('productCatalog.action.saveKit');
    expect(root.textContent).not.toContain('productCatalog.action.addLine');
    expect(root.textContent).toContain('productCatalog.action.explode');
  });

  it('explains that a product that is not a kit has no bill of materials', async () => {
    api['getProduct'].mockReturnValue(of(wrap(detail('plain'))));
    await TestBed.inject(ProductEditorStore).open('plain');
    const fixture = TestBed.createComponent(KitBuilderComponent);
    fixture.componentRef.setInput('canWrite', true);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'productCatalog.hint.notAKit',
    );
  });
});
