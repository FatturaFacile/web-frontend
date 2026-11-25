import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import {
  GdoTradeTermsApiService,
  GdtContract,
  GdtContractFilters,
  GdtContractPayload,
  GdtLookups,
  GdtPageMeta,
} from '@core';
import { failureOf, GDT_OK, GdtOutcome } from './gdo-trade-terms.util';

export interface ContractsState {
  filters: GdtContractFilters;
  contracts: GdtContract[];
  meta: GdtPageMeta | null;
  lookups: GdtLookups | null;
  /** The contract just created, so the screen can open it. */
  created: GdtContract | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
}

const PAGE_SIZE = 25;

/** The GDO framework contracts: filters, paging and creation. */
export const ContractsStore = signalStore(
  withState<ContractsState>({
    filters: { per_page: PAGE_SIZE, page: 1 },
    contracts: [],
    meta: null,
    lookups: null,
    created: null,
    loading: false,
    saving: false,
    error: null,
  }),
  withComputed(({ meta, lookups }) => ({
    total: computed(() => meta()?.total ?? 0),
    page: computed(() => meta()?.current_page ?? 1),
    pageSize: computed(() => meta()?.per_page ?? PAGE_SIZE),
    customers: computed(() => lookups()?.customers ?? []),
    taxRates: computed(() => lookups()?.tax_rates ?? { IT: '22', CH: '8.1' }),
  })),
  withMethods((store, api = inject(GdoTradeTermsApiService)) => {
    let sequence = 0;

    const load = async (filters: GdtContractFilters): Promise<void> => {
      const ticket = ++sequence;
      patchState(store, { filters, loading: true, error: null });
      try {
        const response = await firstValueFrom(api.listContracts(filters));
        if (ticket === sequence) {
          patchState(store, { contracts: response.data, meta: response.meta, loading: false });
        }
      } catch (error) {
        if (ticket === sequence) {
          patchState(store, { loading: false, error: failureOf(error).errorKey });
        }
      }
    };

    return {
      async init(): Promise<void> {
        const lookups = await firstValueFrom(api.getLookups()).catch(() => null);
        patchState(store, { lookups: lookups?.data ?? null });
        await load(store.filters());
      },
      load: (filters: GdtContractFilters = store.filters()): Promise<void> => load(filters),
      /** Applies filters from the first page. */
      setFilters(patch: Partial<GdtContractFilters>): Promise<void> {
        return load({ ...store.filters(), ...patch, page: 1 });
      },
      setPage(page: number): Promise<void> {
        return load({ ...store.filters(), page });
      },
      async create(payload: GdtContractPayload): Promise<GdtOutcome> {
        patchState(store, { saving: true, created: null });
        try {
          const response = await firstValueFrom(api.createContract(payload));
          patchState(store, { saving: false, created: response.data });
          await load(store.filters());
          return GDT_OK;
        } catch (error) {
          patchState(store, { saving: false });
          return failureOf(error);
        }
      },
      async remove(id: string): Promise<GdtOutcome> {
        try {
          await firstValueFrom(api.deleteContract(id));
          await load(store.filters());
          return GDT_OK;
        } catch (error) {
          return failureOf(error);
        }
      },
    };
  }),
);
