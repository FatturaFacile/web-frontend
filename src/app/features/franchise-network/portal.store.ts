import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import {
  FranchiseNetworkApiService,
  FrnBenchmark,
  FrnPortalContract,
  FrnPortalStatements,
  FrnPortalSync,
  FrnStore,
} from '@core';
import { failureOf, FRN_OK, FrnOutcome } from './franchise-network.util';

export interface PortalState {
  stores: FrnStore[];
  storeId: string | null;
  contract: FrnPortalContract | null;
  syncs: FrnPortalSync[];
  statements: FrnPortalStatements | null;
  benchmark: FrnBenchmark | null;
  loaded: boolean;
  loading: boolean;
  saving: boolean;
  error: string | null;
}

/**
 * Franchisee portal: the contract and its obligations, the pushes received (acknowledged by the franchisee), the monthly
 * statements and the anonymous benchmark of the store. Everything is limited by the API to the store the company is linked to.
 */
export const PortalStore = signalStore(
  withState<PortalState>({
    stores: [],
    storeId: null,
    contract: null,
    syncs: [],
    statements: null,
    benchmark: null,
    loaded: false,
    loading: false,
    saving: false,
    error: null,
  }),
  withMethods((store, api = inject(FranchiseNetworkApiService)) => {
    const loadStore = async (storeId: string): Promise<void> => {
      const [contract, syncs, statements, benchmark] = await Promise.all([
        firstValueFrom(api.getPortalContract(storeId)),
        firstValueFrom(api.getPortalSyncs(storeId)),
        firstValueFrom(api.getPortalStatements(storeId)),
        firstValueFrom(api.getPortalBenchmark(storeId)),
      ]);
      patchState(store, {
        storeId,
        contract: contract.data,
        syncs: syncs.data,
        statements: statements.data,
        benchmark: benchmark.data,
      });
    };

    const load = async (storeId?: string): Promise<void> => {
      patchState(store, { loading: true, error: null });
      try {
        const me = await firstValueFrom(api.getPortalStores());
        patchState(store, { stores: me.data.stores, loaded: true });
        const selected = storeId ?? store.storeId() ?? me.data.stores[0]?.id ?? null;
        if (selected !== null) {
          await loadStore(selected);
        }
        patchState(store, { loading: false });
      } catch (error) {
        patchState(store, { loading: false, loaded: true, error: failureOf(error).errorKey });
      }
    };

    return {
      load,
      selectStore: (storeId: string): Promise<void> => load(storeId),
      async link(code: string): Promise<FrnOutcome> {
        patchState(store, { saving: true });
        try {
          await firstValueFrom(api.linkPortal(code));
          patchState(store, { saving: false });
          await load();
          return FRN_OK;
        } catch (error) {
          patchState(store, { saving: false });
          return failureOf(error);
        }
      },
      async acknowledge(id: string): Promise<FrnOutcome> {
        const storeId = store.storeId();
        if (storeId === null) {
          return FRN_OK;
        }
        patchState(store, { saving: true });
        try {
          await firstValueFrom(api.acknowledgePortalSync(id, storeId));
          const syncs = await firstValueFrom(api.getPortalSyncs(storeId));
          patchState(store, { saving: false, syncs: syncs.data });
          return FRN_OK;
        } catch (error) {
          patchState(store, { saving: false });
          return failureOf(error);
        }
      },
      async loadBenchmark(period: string): Promise<void> {
        try {
          const response = await firstValueFrom(api.getPortalBenchmark(store.storeId() ?? undefined, period));
          patchState(store, { benchmark: response.data });
        } catch (error) {
          patchState(store, { error: failureOf(error).errorKey });
        }
      },
    };
  }),
);
