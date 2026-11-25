import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import {
  SfDossierSummary,
  SfFilters,
  SfLocale,
  SfLookups,
  SfPageMeta,
  StatutoryFinancialsApiService,
} from '@core';
import { failureOf, SF_OK, SfOutcome } from './statutory-financials.util';

export interface DossiersState {
  filters: SfFilters;
  dossiers: SfDossierSummary[];
  meta: SfPageMeta | null;
  lookups: SfLookups | null;
  loading: boolean;
  error: string | null;
}

export const SF_PAGE_SIZE = 20;

/** The dossiers of the tenant: filters, paging and deletion. */
export const DossiersStore = signalStore(
  withState<DossiersState>({
    filters: { per_page: SF_PAGE_SIZE, page: 1 },
    dossiers: [],
    meta: null,
    lookups: null,
    loading: false,
    error: null,
  }),
  withComputed(({ meta, lookups }) => ({
    total: computed(() => meta()?.total ?? 0),
    page: computed(() => meta()?.current_page ?? 1),
    pageSize: computed(() => meta()?.per_page ?? SF_PAGE_SIZE),
    fiscalYears: computed(() => lookups()?.fiscal_years ?? []),
    standards: computed(() => lookups()?.standards ?? []),
    statuses: computed(() => lookups()?.statuses ?? []),
  })),
  withMethods((store, api = inject(StatutoryFinancialsApiService)) => {
    let sequence = 0;

    const load = async (filters: SfFilters): Promise<void> => {
      const ticket = ++sequence;
      patchState(store, { filters, loading: true, error: null });
      try {
        const response = await firstValueFrom(api.listDossiers(filters));
        if (ticket === sequence) {
          patchState(store, { dossiers: response.data, meta: response.meta, loading: false });
        }
      } catch (error) {
        if (ticket === sequence) {
          patchState(store, { loading: false, error: failureOf(error).errorKey });
        }
      }
    };

    return {
      async init(locale?: SfLocale): Promise<void> {
        const lookups = await firstValueFrom(api.getLookups(locale)).catch(() => null);
        patchState(store, { lookups: lookups?.data ?? null });
        await load(store.filters());
      },
      load: (filters: SfFilters = store.filters()): Promise<void> => load(filters),
      /** Applies filters from the first page. */
      setFilters(patch: Partial<SfFilters>): Promise<void> {
        return load({ ...store.filters(), ...patch, page: 1 });
      },
      setPage(page: number): Promise<void> {
        return load({ ...store.filters(), page });
      },
      async remove(id: string): Promise<SfOutcome> {
        try {
          await firstValueFrom(api.deleteDossier(id));
          await load(store.filters());
          return SF_OK;
        } catch (error) {
          return failureOf(error);
        }
      },
    };
  }),
);
