import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PcImportReport, ProductCatalogApiService } from '@core';
import { CatalogTransferStore } from './catalog-transfer.store';
import { wrap } from './product-catalog.testing';

describe('CatalogTransferStore', () => {
  const api = {
    getImportSchema: vi.fn(),
    exportCatalog: vi.fn(),
    downloadTemplate: vi.fn(),
    importFile: vi.fn(),
  };
  let store: InstanceType<typeof CatalogTransferStore>;
  const report: PcImportReport = {
    mode: 'dry_run',
    committed: false,
    total: 3,
    created: 1,
    updated: 1,
    failed: 1,
    errors: [{ line: 4, sku: 'BAD', field: 'tares_code', message: 'bad format' }],
  };

  beforeEach(() => {
    Object.values(api).forEach((mock) => mock.mockReset());
    api.getImportSchema.mockReturnValue(
      of(
        wrap({
          columns: ['sku', 'name'],
          required: ['sku', 'name'],
          modes: ['dry_run', 'atomic', 'partial'],
          max_rows: 5000,
        }),
      ),
    );
    URL.createObjectURL = vi.fn(() => 'blob:test');
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    TestBed.configureTestingModule({
      providers: [CatalogTransferStore, { provide: ProductCatalogApiService, useValue: api }],
    });
    store = TestBed.inject(CatalogTransferStore);
  });

  afterEach(() => vi.restoreAllMocks());

  it('loads the schema of the exchange file', async () => {
    await store.init();

    expect(store.schema()?.columns).toEqual(['sku', 'name']);
    expect(store.schema()?.max_rows).toBe(5000);
  });

  it('downloads the export and the template as files', async () => {
    api.exportCatalog.mockReturnValue(of(new Blob(['sku'])));
    api.downloadTemplate.mockReturnValue(of(new Blob(['sku'])));

    expect((await store.export('xlsx')).ok).toBe(true);
    expect((await store.template('csv')).ok).toBe(true);

    expect(api.exportCatalog).toHaveBeenCalledWith('xlsx');
    expect(api.downloadTemplate).toHaveBeenCalledWith('csv');
    expect(URL.createObjectURL).toHaveBeenCalledTimes(2);
    expect(store.busy()).toBe(false);
  });

  it('keeps the report of an import with the errors of every row', async () => {
    api.importFile.mockReturnValue(of(wrap(report)));
    const file = new File(['sku,name'], 'catalog.csv', { type: 'text/csv' });

    const outcome = await store.import(file, 'dry_run');

    expect(outcome.ok).toBe(true);
    expect(api.importFile).toHaveBeenCalledWith(file, 'dry_run');
    expect(store.report()?.errors[0].field).toBe('tares_code');
    expect(store.report()?.committed).toBe(false);

    store.clearReport();
    expect(store.report()).toBeNull();
  });

  it('returns the refusal of a file that is not valid, without a report', async () => {
    api.importFile.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 422,
            error: { code: 'import_missing_columns', params: { columns: 'name' } },
          }),
      ),
    );

    const outcome = await store.import(new File([''], 'a.csv'), 'atomic');

    expect(outcome.ok).toBe(false);
    expect(outcome.errorKey).toBe('productCatalog.error.import_missing_columns');
    expect(outcome.params).toEqual({ columns: 'name' });
    expect(store.report()).toBeNull();
    expect(store.busy()).toBe(false);
  });
});
