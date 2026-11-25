import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { FranchiseNetworkApiService, FrnStore, FrnStorePayload } from '@core';
import { failureOf, FRN_OK, FrnOutcome } from './franchise-network.util';

export interface StoresState {
  stores: FrnStore[];
  loading: boolean;
  saving: boolean;
  error: string | null;
}

/** The stores of the network: franchisee stores (linked to the franchisee company by a code) and directly operated stores. */
export const StoresStore = signalStore(
  withState<StoresState>({ stores: [], loading: false, saving: false, error: null }),
  withMethods((store, api = inject(FranchiseNetworkApiService)) => {
    const load = async (q?: string): Promise<void> => {
      patchState(store, { loading: true, error: null });
      try {
        const response = await firstValueFrom(api.listStores(q));
        patchState(store, { stores: response.data, loading: false });
      } catch (error) {
        patchState(store, { loading: false, error: failureOf(error).errorKey });
      }
    };

    const write = async (call: () => Promise<unknown>): Promise<FrnOutcome> => {
      patchState(store, { saving: true });
      try {
        await call();
        patchState(store, { saving: false });
        await load();
        return FRN_OK;
      } catch (error) {
        patchState(store, { saving: false });
        return failureOf(error);
      }
    };

    return {
      load,
      save: (payload: FrnStorePayload, id?: string): Promise<FrnOutcome> =>
        write(() => firstValueFrom(id ? api.updateStore(id, payload) : api.createStore(payload))),
      remove: (id: string): Promise<FrnOutcome> => write(() => firstValueFrom(api.deleteStore(id))),
      async issueLinkCode(id: string): Promise<{ outcome: FrnOutcome; code: string | null }> {
        try {
          const response = await firstValueFrom(api.issueLinkCode(id));
          return { outcome: FRN_OK, code: response.data.code };
        } catch (error) {
          return { outcome: failureOf(error), code: null };
        }
      },
    };
  }),
);
