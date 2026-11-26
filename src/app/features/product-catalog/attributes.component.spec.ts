import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AttributesComponent } from './attributes.component';
import { baseProviders, colorAttribute, sizeAttribute, wrap } from './product-catalog.testing';

describe('AttributesComponent', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let canWrite: boolean;

  beforeEach(() => {
    canWrite = true;
    api = {
      listAttributes: vi.fn(() => of(wrap([sizeAttribute, colorAttribute]))),
      createAttribute: vi.fn(() => of(wrap(sizeAttribute))),
      updateAttribute: vi.fn(() => of(wrap(sizeAttribute))),
      deleteAttribute: vi.fn(() => of(wrap(null))),
    };
    TestBed.configureTestingModule({ providers: baseProviders(api, () => canWrite) });
  });

  async function render() {
    const fixture = TestBed.createComponent(AttributesComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  function rowOf(root: HTMLElement, code: string): Element | undefined {
    return Array.from(root.querySelectorAll('tbody tr.attribute-row')).find((row) =>
      (row.textContent ?? '').includes(code),
    );
  }

  it('lists the attributes with their values', async () => {
    const root = (await render()).nativeElement as HTMLElement;

    expect(root.querySelectorAll('tbody tr.attribute-row')).toHaveLength(2);
    const size = rowOf(root, 'size')?.textContent ?? '';
    expect(size).toContain('Size');
    expect(size).toContain('S, XL');
    expect(rowOf(root, 'color')?.textContent).toContain('Black, White');
  });

  it('offers creation, edit and deletion to a member who can write', async () => {
    const root = (await render()).nativeElement as HTMLElement;

    expect(root.textContent).toContain('productCatalog.action.newAttribute');
    expect(rowOf(root, 'size')?.textContent).toContain('productCatalog.action.edit');
    expect(rowOf(root, 'size')?.textContent).toContain('productCatalog.action.delete');
  });

  it('hides creation, edit and deletion from a member who cannot write', async () => {
    canWrite = false;
    const root = (await render()).nativeElement as HTMLElement;

    expect(root.textContent).not.toContain('productCatalog.action.newAttribute');
    expect(rowOf(root, 'size')?.textContent).not.toContain('productCatalog.action.edit');
    expect(rowOf(root, 'size')?.textContent).not.toContain('productCatalog.action.delete');
  });

  it('validates the draft: lower-case code, English name, a code, label and token on every value, no repeated token', async () => {
    const fixture = await render();
    const component = fixture.componentInstance as unknown as {
      openCreate: () => void;
      patch: (change: Record<string, unknown>) => void;
      patchName: (locale: string, text: string) => void;
      patchValue: (index: number, change: Record<string, unknown>) => void;
      patchLabel: (index: number, locale: string, text: string) => void;
      addValue: () => void;
      valid: () => boolean;
    };

    component.openCreate();
    expect(component.valid()).toBe(false);

    component.patch({ code: 'fit' });
    component.patchName('en', 'Fit');
    component.patchValue(0, { code: 'slim', sku_token: 'SLM' });
    component.patchLabel(0, 'en', 'Slim');
    expect(component.valid()).toBe(true);

    component.addValue();
    component.patchValue(1, { code: 'regular', sku_token: 'SLM' });
    component.patchLabel(1, 'en', 'Regular');
    expect(component.valid()).toBe(false);

    component.patchValue(1, { sku_token: 'REG' });
    expect(component.valid()).toBe(true);

    component.patch({ code: 'Fit Type' });
    expect(component.valid()).toBe(false);
  });

  it('saves a new attribute and reloads the list', async () => {
    const fixture = await render();
    const component = fixture.componentInstance as unknown as {
      openCreate: () => void;
      patch: (change: Record<string, unknown>) => void;
      patchName: (locale: string, text: string) => void;
      patchValue: (index: number, change: Record<string, unknown>) => void;
      patchLabel: (index: number, locale: string, text: string) => void;
      save: () => Promise<void>;
    };
    component.openCreate();
    component.patch({ code: 'fit' });
    component.patchName('en', 'Fit');
    component.patchName('it', 'Taglio');
    component.patchValue(0, {
      code: 'slim',
      sku_token: 'SLM',
      price_delta: '3',
      price_delta_type: 'fixed',
    });
    component.patchLabel(0, 'en', 'Slim');

    await component.save();

    expect(api['createAttribute']).toHaveBeenCalledTimes(1);
    const payload = api['createAttribute'].mock.calls[0][0];
    expect(payload.code).toBe('fit');
    expect(payload.name).toEqual({ en: 'Fit', it: 'Taglio' });
    expect(payload.values[0]).toMatchObject({ code: 'slim', sku_token: 'SLM', price_delta: '3' });
    expect(api['listAttributes']).toHaveBeenCalledTimes(2);
  });

  it('deletes an attribute from its row', async () => {
    const fixture = await render();
    const component = fixture.componentInstance as unknown as {
      remove: (a: typeof sizeAttribute) => Promise<void>;
    };

    await component.remove(sizeAttribute);

    expect(api['deleteAttribute']).toHaveBeenCalledWith('a-size');
  });
});
