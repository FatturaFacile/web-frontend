import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import {
  GdoTradeTermsApiService,
  GdtContract,
  GdtPageMeta,
  GdtProposePayload,
  GdtSettlement,
  GdtSettlementFilters,
} from '@core';
import { failureOf, GdtOutcome, GDT_OK } from './gdo-trade-terms.util';

export interface SettlementsState {
  filters: GdtSettlementFilters;
  settlements: GdtSettlement[];
  meta: GdtPageMeta | null;
  contracts: GdtContract[];
  proposed: GdtSettlement | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
}

const PAGE_SIZE = 25;

/** The settlement runs of the contracts: list, filters and the proposal of a new one. */
export const SettlementsStore = signalStore(
  withState<SettlementsState>({
    filters: { per_page: PAGE_SIZE, page: 1 },
    settlements: [],
    meta: null,
    contracts: [],
    proposed: null,
    loading: false,
    saving: false,
    error: null,
  }),
  withComputed(({ meta, contracts }) => ({
    total: computed(() => meta()?.total ?? 0),
    page: computed(() => meta()?.current_page ?? 1),
    pageSize: computed(() => meta()?.per_page ?? PAGE_SIZE),
    settleableContracts: computed(() => contracts().filter((c) => c.status === 'active' || c.status === 'closed')),
  })),
  withMethods((store, api = inject(GdoTradeTermsApiService)) => {
    let sequence = 0;

    const load = async (filters: GdtSettlementFilters): Promise<void> => {
      const ticket = ++sequence;
      patchState(store, { filters, loading: true, error: null });
      try {
        const response = await firstValueFrom(api.listSettlements(filters));
        if (ticket === sequence) {
          patchState(store, { settlements: response.data, meta: response.meta, loading: false });
        }
      } catch (error) {
        if (ticket === sequence) {
          patchState(store, { loading: false, error: failureOf(error).errorKey });
        }
      }
    };

    return {
      async init(): Promise<void> {
        const contracts = await firstValueFrom(api.listContracts({ per_page: 100 })).catch(() => null);
        patchState(store, { contracts: contracts?.data ?? [] });
        await load(store.filters());
      },
      setFilters(patch: Partial<GdtSettlementFilters>): Promise<void> {
        return load({ ...store.filters(), ...patch, page: 1 });
      },
      setPage(page: number): Promise<void> {
        return load({ ...store.filters(), page });
      },
      async propose(payload: GdtProposePayload): Promise<GdtOutcome> {
        patchState(store, { saving: true, proposed: null });
        try {
          const response = await firstValueFrom(api.proposeSettlement(payload));
          patchState(store, { saving: false, proposed: response.data });
          await load(store.filters());
          return GDT_OK;
        } catch (error) {
          patchState(store, { saving: false });
          return failureOf(error);
        }
      },
    };
  }),
);
