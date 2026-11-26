import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProductCatalogApiService } from '@core';
import { ProductEditorStore } from './product-editor.store';
import { ProductGeneralFormComponent } from './product-general-form.component';
import { baseProviders, detail, lookups, product, wrap } from './product-catalog.testing';

describe('ProductGeneralFormComponent', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    api = {
      getLookups: vi.fn(() => of(wrap(lookups))),
      listAttributes: vi.fn(() => of(wrap([]))),
      getProduct: vi.fn(() => of(wrap(detail('9', { sku: 'NEW', name: 'New one' })))),
      createProduct: vi.fn(() => of(wrap(product('9')))),
      updateProduct: vi.fn(() => of(wrap(product('1')))),
    };
    TestBed.configureTestingModule({
      providers: [
        ...baseProviders(api),
        ProductEditorStore,
        { provide: ProductCatalogApiService, useValue: api },
      ],
    });
  });

  async function render(id: string | null = null, canWrite = true) {
    if (id !== null) {
      api['getProduct'].mockReturnValue(
        of(wrap(detail(id, { sku: 'TSH', name: 'T-shirt', barcode: '4006381333931' }))),
      );
    }
    await TestBed.inject(ProductEditorStore).open(id);
    const fixture = TestBed.createComponent(ProductGeneralFormComponent);
    fixture.componentRef.setInput('canWrite', canWrite);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, root: fixture.nativeElement as HTMLElement };
  }

  function type(root: HTMLElement, selector: string, value: string): void {
    const input = root.querySelector(selector) as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }

  function save(root: HTMLElement): HTMLButtonElement {
    return Array.from(root.querySelectorAll('button')).find((candidate) =>
      (candidate.textContent ?? '').includes('productCatalog.action.save'),
    ) as HTMLButtonElement;
  }

  it('starts an empty form that cannot be saved without a SKU and a name', async () => {
    const { fixture, root } = await render();

    expect(save(root).disabled).toBe(true);

    type(root, '#pc-sku', 'NEW');
    fixture.detectChanges();
    expect(save(root).disabled).toBe(true);

    type(root, '#pc-name', 'New one');
    fixture.detectChanges();
    expect(save(root).disabled).toBe(false);
  });

  it('creates the product with what was typed and tells the editor it is saved', async () => {
    const { fixture, root } = await render();
    const saved = vi.fn();
    fixture.componentInstance.saved.subscribe(saved);
    type(root, '#pc-sku', 'NEW');
    type(root, '#pc-name', 'New one');
    type(root, '#pc-price', '19.9');
    fixture.detectChanges();

    save(root).click();
    await fixture.whenStable();

    const payload = api['createProduct'].mock.calls[0][0];
    expect(payload.sku).toBe('NEW');
    expect(payload.name).toBe('New one');
    expect(payload.sale_price).toBe('19.9');
    expect(payload.product_type).toBe('storable');
    expect(payload.generate_barcode).toBeUndefined();
    expect(saved).toHaveBeenCalled();
  });

  it('asks for an in-house EAN-13 when the box is ticked and no barcode is typed', async () => {
    const { fixture, root } = await render();
    type(root, '#pc-sku', 'NEW');
    type(root, '#pc-name', 'New one');
    (root.querySelector('#pc-gen-barcode input') as HTMLInputElement).click();
    fixture.detectChanges();

    save(root).click();
    await fixture.whenStable();

    expect(api['createProduct'].mock.calls[0][0].generate_barcode).toBe(true);
  });

  it('refuses a barcode with a wrong check digit before it reaches the API', async () => {
    const { fixture, root } = await render();
    type(root, '#pc-sku', 'NEW');
    type(root, '#pc-name', 'New one');
    type(root, '#pc-barcode', '4006381333932');
    fixture.detectChanges();

    expect(root.textContent).toContain('productCatalog.error.gtin_invalid');
    expect(save(root).disabled).toBe(true);

    type(root, '#pc-barcode', '4006381333931');
    fixture.detectChanges();
    expect(save(root).disabled).toBe(false);
  });

  it('checks the Swiss Tares and the TARIC formats while typing', async () => {
    const { fixture, root } = await render();
    type(root, '#pc-sku', 'NEW');
    type(root, '#pc-name', 'New one');
    type(root, '#pc-tares', '1234');
    fixture.detectChanges();

    expect(root.textContent).toContain('productCatalog.hint.taresFormat');
    expect(save(root).disabled).toBe(true);

    type(root, '#pc-tares', '85176200');
    type(root, '#pc-taric', '85176');
    fixture.detectChanges();
    expect(root.textContent).toContain('productCatalog.hint.taricFormat');

    type(root, '#pc-taric', '8517620000');
    fixture.detectChanges();
    expect(save(root).disabled).toBe(false);
  });

  it('upper-cases the country of origin', async () => {
    const { fixture, root } = await render();
    type(root, '#pc-sku', 'NEW');
    type(root, '#pc-name', 'New one');
    type(root, '#pc-country', 'ch');
    fixture.detectChanges();

    save(root).click();
    await fixture.whenStable();

    expect(api['createProduct'].mock.calls[0][0].country_of_origin).toBe('CH');
  });

  it('fills the form with the open product and saves the changes as an update', async () => {
    const { fixture, root } = await render('1');

    expect((root.querySelector('#pc-sku') as HTMLInputElement).value).toBe('TSH');
    expect((root.querySelector('#pc-name') as HTMLInputElement).value).toBe('T-shirt');
    expect(root.querySelector('#pc-gen-barcode')).toBeNull();

    type(root, '#pc-name', 'T-shirt Pro');
    fixture.detectChanges();
    save(root).click();
    await fixture.whenStable();

    expect(api['updateProduct']).toHaveBeenCalledTimes(1);
    expect(api['updateProduct'].mock.calls[0][0]).toBe('1');
    expect(api['updateProduct'].mock.calls[0][1].name).toBe('T-shirt Pro');
  });

  it('shows the refusal of the API with its field errors and does not report a save', async () => {
    api['createProduct'].mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 422,
            error: {
              code: 'sku_taken',
              params: { sku: 'NEW' },
              errors: { sku: ['The sku has already been taken.'] },
            },
          }),
      ),
    );
    const { fixture, root } = await render();
    const saved = vi.fn();
    fixture.componentInstance.saved.subscribe(saved);
    type(root, '#pc-sku', 'NEW');
    type(root, '#pc-name', 'New one');
    fixture.detectChanges();

    save(root).click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(root.textContent).toContain('productCatalog.error.sku_taken');
    expect(root.textContent).toContain('The sku has already been taken.');
    expect(saved).not.toHaveBeenCalled();
  });

  it('hides the save button from a member who cannot write', async () => {
    const { root } = await render('1', false);

    expect(save(root)).toBeUndefined();
  });
});
