import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PayablesApiService } from '@core';
import { PayablesAgingStore } from './payables-aging.store';
import { aging } from './payables.fixtures';

describe('PayablesAgingStore', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let store: InstanceType<typeof PayablesAgingStore>;

  beforeEach(() => {
    api = {
      getAging: vi.fn(() => of({ data: aging })),
      exportAging: vi.fn(() => of(new Blob(['x']))),
    };
    TestBed.configureTestingModule({
      providers: [PayablesAgingStore, { provide: PayablesApiService, useValue: api }],
    });
    store = TestBed.inject(PayablesAgingStore);
  });

  it('loads the aging with its suppliers and buckets', async () => {
    await store.init();

    expect(store.suppliers()).toHaveLength(2);
    expect(store.buckets().map((bucket) => bucket.key)).toEqual([
      'current',
      '1_30',
      '31_60',
      '61_90',
      '91_plus',
    ]);
    expect(store.isEmpty()).toBe(false);
  });

  it('is empty without suppliers', async () => {
    api['getAging'].mockReturnValueOnce(of({ data: { ...aging, suppliers: [] } }));
    await store.init();

    expect(store.isEmpty()).toBe(true);
  });

  it('reloads with the date and the currency, keeping the other filters', async () => {
    await store.init({ as_of: '2026-03-31' });
    await store.setFilters({ currency: 'CHF' });

    expect(api['getAging']).toHaveBeenLastCalledWith({ as_of: '2026-03-31', currency: 'CHF' });
  });

  it('reports a load error', async () => {
    api['getAging'].mockReturnValueOnce(
      throwError(() => new HttpErrorResponse({ status: 500, error: { message: 'boom' } })),
    );
    await store.init();

    expect(store.error()).toBe('boom');
    expect(store.loading()).toBe(false);
  });

  it('downloads the Excel and PDF exports of the loaded date with the filters', async () => {
    await store.init({ currency: 'EUR' });

    const xlsx = await store.download('xlsx');
    expect(api['exportAging']).toHaveBeenCalledWith('xlsx', { currency: 'EUR' });
    expect(xlsx.ok).toBe(true);
    expect(xlsx.blob).toBeInstanceOf(Blob);
    expect(xlsx.filename).toBe('payables-aging-2026-04-01.xlsx');

    const pdf = await store.download('pdf');
    expect(pdf.filename).toBe('payables-aging-2026-04-01.pdf');
    expect(store.exporting()).toBeNull();
  });

  it('shows the export in progress and clears it on failure', async () => {
    let seen: string | null = null;
    api['exportAging'].mockImplementationOnce(() => {
      seen = store.exporting();
      return throwError(
        () => new HttpErrorResponse({ status: 500, error: { message: 'no file' } }),
      );
    });
    await store.init();
    const result = await store.download('pdf');

    expect(seen).toBe('pdf');
    expect(result.ok).toBe(false);
    expect(result.blob).toBeNull();
    expect(result.message).toBe('no file');
    expect(store.exporting()).toBeNull();
  });
});
