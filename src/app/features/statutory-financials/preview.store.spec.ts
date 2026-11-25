import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StatutoryFinancialsApiService } from '@core';
import { PreviewStore } from './preview.store';
import { preview, wrap } from './statutory-financials.testing';

describe('PreviewStore', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let store: InstanceType<typeof PreviewStore>;

  beforeEach(() => {
    api = { getPreview: vi.fn(() => of(wrap(preview()))) };
    TestBed.configureTestingModule({
      providers: [PreviewStore, { provide: StatutoryFinancialsApiService, useValue: api }],
    });
    store = TestBed.inject(PreviewStore);
  });

  it('loads the preview with the taxonomy and the XBRL excerpt', async () => {
    await store.load('d-1');

    expect(api['getPreview']).toHaveBeenCalledWith('d-1');
    expect(store.preview()?.taxonomy.entry_point).toBe('itcc-ci-2024-11-04.xsd');
    expect(store.preview()?.xbrl_truncated).toBe(true);
    expect(store.loading()).toBe(false);
  });

  it('clears the preview and keeps the error key when it cannot be built', async () => {
    await store.load('d-1');
    api['getPreview']?.mockReturnValue(
      throwError(
        () => new HttpErrorResponse({ status: 409, error: { code: 'statements_not_generated' } }),
      ),
    );

    await store.load('d-1');

    expect(store.preview()).toBeNull();
    expect(store.error()).toBe('statutoryFinancials.error.statements_not_generated');
  });
});
