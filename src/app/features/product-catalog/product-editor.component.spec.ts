import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProductEditorComponent } from './product-editor.component';
import { baseProviders, detail, lookups, wrap } from './product-catalog.testing';

describe('ProductEditorComponent', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    api = {
      getLookups: vi.fn(() => of(wrap(lookups))),
      listAttributes: vi.fn(() => of(wrap([]))),
      getProduct: vi.fn(),
    };
    TestBed.configureTestingModule({ providers: baseProviders(api) });
  });

  async function render(id: string | null) {
    const fixture = TestBed.createComponent(ProductEditorComponent);
    fixture.componentRef.setInput('productId', id);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return (fixture.nativeElement as HTMLElement).querySelector('.ant-tabs-nav')?.textContent ?? '';
  }

  it('offers only the general data of a product that does not exist yet', async () => {
    const tabs = await render(null);

    expect(api['getProduct']).not.toHaveBeenCalled();
    expect(tabs).toContain('productCatalog.tab.general');
    expect(tabs).not.toContain('productCatalog.tab.variants');
    expect(tabs).not.toContain('productCatalog.tab.kit');
    expect(tabs).not.toContain('productCatalog.tab.units');
  });

  it('adds the variant matrix and the units to a parent product', async () => {
    api['getProduct'].mockReturnValue(of(wrap(detail('1'))));

    const tabs = await render('1');

    expect(api['getProduct']).toHaveBeenCalledWith('1');
    expect(tabs).toContain('productCatalog.tab.variants');
    expect(tabs).toContain('productCatalog.tab.units');
    expect(tabs).not.toContain('productCatalog.tab.kit');
  });

  it('adds the bill of materials, and no matrix, to a kit', async () => {
    api['getProduct'].mockReturnValue(of(wrap(detail('2', { kit_type: 'phantom' }))));

    const tabs = await render('2');

    expect(tabs).toContain('productCatalog.tab.kit');
    expect(tabs).toContain('productCatalog.tab.units');
    expect(tabs).not.toContain('productCatalog.tab.variants');
  });

  it('gives a variant its general data and units only', async () => {
    api['getProduct'].mockReturnValue(of(wrap(detail('3', { is_variant: true, parent_id: '1' }))));

    const tabs = await render('3');

    expect(tabs).toContain('productCatalog.tab.units');
    expect(tabs).not.toContain('productCatalog.tab.variants');
    expect(tabs).not.toContain('productCatalog.tab.kit');
  });
});
