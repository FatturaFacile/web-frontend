import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StatutoryFinancialsApiService } from '@core';
import { DossiersStore } from './dossiers.store';
import { lookups, summary, wrap } from './statutory-financials.testing';

describe('DossiersStore', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let store: InstanceType<typeof DossiersStore>;

  const page = (total = 1) => ({
    ...wrap([summary('d-1'), summary('d-2')]),
    meta: { current_page: 1, per_page: 20, last_page: 1, total },
  });

  beforeEach(() => {
    api = {
      getLookups: vi.fn(() => of(wrap(lookups))),
      listDossiers: vi.fn(() => of(page(2))),
      deleteDossier: vi.fn(() => of(wrap(null))),
    };
    TestBed.configureTestingModule({
      providers: [DossiersStore, { provide: StatutoryFinancialsApiService, useValue: api }],
    });
    store = TestBed.inject(DossiersStore);
  });

  it('loads the lookups and the first page', async () => {
    await store.init('it');

    expect(api['getLookups']).toHaveBeenCalledWith('it');
    expect(api['listDossiers']).toHaveBeenCalledWith({ per_page: 20, page: 1 });
    expect(store.dossiers()).toHaveLength(2);
    expect(store.total()).toBe(2);
    expect(store.fiscalYears()).toHaveLength(2);
    expect(store.standards()).toHaveLength(2);
    expect(store.loading()).toBe(false);
  });

  it('applies filters from the first page and pages with the filters kept', async () => {
    await store.init();
    await store.setPage(3);
    expect(api['listDossiers']).toHaveBeenLastCalledWith({ per_page: 20, page: 3 });

    await store.setFilters({ status: 'validated', standard: 'CH_CO_Art959' });
    expect(api['listDossiers']).toHaveBeenLastCalledWith({
      per_page: 20,
      page: 1,
      status: 'validated',
      standard: 'CH_CO_Art959',
    });
    expect(store.filters().status).toBe('validated');
  });

  it('keeps the error key when the list cannot be read', async () => {
    api['listDossiers']?.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 403, error: { code: 'forbidden' } })),
    );

    await store.init();

    expect(store.error()).toBe('statutoryFinancials.error.forbidden');
    expect(store.loading()).toBe(false);
  });

  it('deletes a dossier and reloads the list', async () => {
    await store.init();
    const outcome = await store.remove('d-1');

    expect(api['deleteDossier']).toHaveBeenCalledWith('d-1');
    expect(outcome.ok).toBe(true);
    expect(api['listDossiers']).toHaveBeenCalledTimes(2);
  });

  it('answers the refusal of a delete without reloading', async () => {
    api['deleteDossier']?.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 409, error: { code: 'dossier_locked' } })),
    );
    await store.init();

    const outcome = await store.remove('d-1');

    expect(outcome).toMatchObject({
      ok: false,
      errorKey: 'statutoryFinancials.error.dossier_locked',
    });
    expect(api['listDossiers']).toHaveBeenCalledTimes(1);
  });
});
