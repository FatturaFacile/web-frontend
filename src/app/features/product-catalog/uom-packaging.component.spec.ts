import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProductCatalogApiService } from '@core';
import { ProductEditorStore } from './product-editor.store';
import { UomPackagingComponent } from './uom-packaging.component';
import { baseProviders, detail, lookups, wrap } from './product-catalog.testing';

describe('UomPackagingComponent', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;

  const packed = detail('tape', {
    uom_rounding: 'half_up',
    uom_precision: 3,
    packagings: [
      {
        id: 'p1',
        code: 'PACK6',
        role: 'sales',
        uom_id: 'u-pz',
        parent_packaging_id: null,
        units_per_parent: '6.000000',
        quantity_base: '6.000000',
        level: 1,
        gtin: null,
      },
      {
        id: 'p2',
        code: 'CARTON24',
        role: 'purchase',
        uom_id: 'u-ct',
        parent_packaging_id: 'p1',
        units_per_parent: '4.000000',
        quantity_base: '24.000000',
        level: 2,
        gtin: null,
      },
    ],
  });

  beforeEach(() => {
    api = {
      getLookups: vi.fn(() => of(wrap(lookups))),
      listAttributes: vi.fn(() => of(wrap([]))),
      getProduct: vi.fn(() => of(wrap(packed))),
      savePackagings: vi.fn(() => of(wrap(packed))),
      convert: vi.fn(() =>
        of(
          wrap({
            base: '48',
            units: { BASE: '48', PACK6: '8', CARTON24: '2' },
            split: { parts: [{ unit: 'CARTON24', quantity: '2' }], remainder: '0' },
          }),
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
    await TestBed.inject(ProductEditorStore).open('tape');
    const fixture = TestBed.createComponent(UomPackagingComponent);
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

  it('shows the saved levels with the factor chained to the base unit', async () => {
    const { root } = await render();
    const rows = root.querySelectorAll('.level-row');

    expect(rows).toHaveLength(2);
    expect(rows[0].querySelector('.factor')?.textContent?.trim()).toBe('6');
    expect(rows[1].querySelector('.factor')?.textContent?.trim()).toBe('24');
    expect((root.querySelector('#pc-precision') as HTMLInputElement).value).toBe('3');
  });

  it('adds a level and cannot save it before it has a code and a unit', async () => {
    const { fixture, root } = await render();

    button(root, 'productCatalog.action.addLine').click();
    fixture.detectChanges();

    expect(root.querySelectorAll('.level-row')).toHaveLength(3);
    expect(button(root, 'productCatalog.action.saveUnits').disabled).toBe(true);
  });

  it('saves the hierarchy with the parent of every level and the rounding policy', async () => {
    const { fixture, root } = await render();

    button(root, 'productCatalog.action.saveUnits').click();
    await fixture.whenStable();

    expect(api['savePackagings']).toHaveBeenCalledWith('tape', {
      uom_rounding: 'half_up',
      uom_precision: 3,
      levels: [
        {
          code: 'PACK6',
          uom_id: 'u-pz',
          units_per_parent: '6.000000',
          parent_code: null,
          role: 'sales',
          gtin: null,
        },
        {
          code: 'CARTON24',
          uom_id: 'u-ct',
          units_per_parent: '4.000000',
          parent_code: 'PACK6',
          role: 'purchase',
          gtin: null,
        },
      ],
    });
  });

  it('converts a quantity and shows it in every unit with the split into whole packages', async () => {
    const { fixture, root } = await render();
    const quantity = root.querySelector('#pc-conv-qty') as HTMLInputElement;
    quantity.value = '48';
    quantity.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    button(root, 'productCatalog.action.convert').click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(api['convert']).toHaveBeenCalledWith('tape', '48', 'BASE');
    const rows = Array.from(root.querySelectorAll('tr.conversion-row')).map((row) =>
      row.textContent?.replace(/\s+/g, ' ').trim(),
    );
    expect(rows).toEqual(['BASE 48', 'PACK6 8', 'CARTON24 2']);
    expect(root.querySelector('.split')?.textContent).toContain('2 × CARTON24');
  });

  it('hides the editing buttons from a member who cannot write, keeping the converter', async () => {
    const { root } = await render(false);

    expect(root.textContent).not.toContain('productCatalog.action.saveUnits');
    expect(root.textContent).toContain('productCatalog.action.convert');
  });
});
