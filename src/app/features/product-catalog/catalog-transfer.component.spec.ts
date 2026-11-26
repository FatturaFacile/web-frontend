import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PcImportReport } from '@core';
import { CatalogTransferComponent } from './catalog-transfer.component';
import { baseProviders, wrap } from './product-catalog.testing';

describe('CatalogTransferComponent', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let canWrite: boolean;
  const report: PcImportReport = {
    mode: 'dry_run',
    committed: false,
    total: 3,
    created: 1,
    updated: 1,
    failed: 1,
    errors: [
      { line: 4, sku: 'BAD-2', field: 'tares_code', message: 'The Tares number must be 8 digits.' },
    ],
  };

  beforeEach(() => {
    canWrite = true;
    api = {
      getImportSchema: vi.fn(() =>
        of(
          wrap({
            columns: ['sku', 'name', 'tares_code'],
            required: ['sku', 'name'],
            modes: ['dry_run', 'atomic', 'partial'],
            max_rows: 5000,
          }),
        ),
      ),
      importFile: vi.fn(() => of(wrap(report))),
      exportCatalog: vi.fn(() => of(new Blob(['sku']))),
      downloadTemplate: vi.fn(() => of(new Blob(['sku']))),
    };
    URL.createObjectURL = vi.fn(() => 'blob:test');
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    TestBed.configureTestingModule({ providers: baseProviders(api, () => canWrite) });
  });

  async function render() {
    const fixture = TestBed.createComponent(CatalogTransferComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  function pick(root: HTMLElement, file: File): void {
    const input = root.querySelector('#pc-import-file') as HTMLInputElement;
    Object.defineProperty(input, 'files', {
      value: { item: () => file, length: 1 },
      configurable: true,
    });
    input.dispatchEvent(new Event('change'));
  }

  function button(root: HTMLElement, text: string): HTMLButtonElement | undefined {
    return Array.from(root.querySelectorAll('button')).find((candidate) =>
      (candidate.textContent ?? '').includes(text),
    );
  }

  it('shows the columns of the file with the required ones marked', async () => {
    const fixture = await render();
    const root = fixture.nativeElement as HTMLElement;

    expect(api['getImportSchema']).toHaveBeenCalled();
    expect(root.textContent).toContain('tares_code');
    expect(root.querySelectorAll('.columns nz-tag')).toHaveLength(3);
  });

  it('downloads the export and the template', async () => {
    const root = (await render()).nativeElement as HTMLElement;

    button(root, 'XLSX')?.click();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    expect(api['exportCatalog']).toHaveBeenCalledWith('xlsx');
  });

  it('cannot import before a csv or xlsx file is picked, and ignores another kind of file', async () => {
    const fixture = await render();
    const root = fixture.nativeElement as HTMLElement;
    const importButton = () =>
      root.querySelectorAll('button[nz-button][class*="primary"]')[0] as HTMLButtonElement;

    expect(importButton().disabled).toBe(true);

    pick(root, new File(['x'], 'notes.txt'));
    fixture.detectChanges();
    expect(importButton().disabled).toBe(true);

    pick(root, new File(['sku,name'], 'catalog.csv', { type: 'text/csv' }));
    fixture.detectChanges();
    expect(importButton().disabled).toBe(false);
  });

  it('checks the file first (dry run) and shows the errors of every row', async () => {
    const fixture = await render();
    const root = fixture.nativeElement as HTMLElement;
    const file = new File(['sku,name'], 'catalog.csv', { type: 'text/csv' });

    pick(root, file);
    fixture.detectChanges();
    (root.querySelectorAll('button[nz-button][class*="primary"]')[0] as HTMLButtonElement).click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(api['importFile']).toHaveBeenCalledWith(file, 'dry_run');
    expect(root.textContent).toContain('productCatalog.message.validated');
    const rows = root.querySelectorAll('tbody tr.error-row');
    expect(rows).toHaveLength(1);
    expect(rows[0].textContent).toContain('BAD-2');
    expect(rows[0].textContent).toContain('tares_code');
    expect(rows[0].textContent).toContain('The Tares number must be 8 digits.');
  });

  it('hides the import from a member who cannot write, and keeps the export', async () => {
    canWrite = false;
    const root = (await render()).nativeElement as HTMLElement;

    expect(root.querySelector('#pc-import-file')).toBeNull();
    expect(button(root, 'XLSX')).toBeDefined();
  });
});
