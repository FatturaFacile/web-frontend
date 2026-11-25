import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import {
  FranchiseNetworkApiService,
  FrnPush,
  FrnPushCreatePayload,
  FrnStore,
} from '@core';
import { failureOf, FRN_OK, FrnOutcome } from './franchise-network.util';

export interface PushesState {
  pushes: FrnPush[];
  stores: FrnStore[];
  detail: FrnPush | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
}

/** Central distribution of catalogue, price lists, promotions and loyalty campaigns, with the delivery monitor of every store. */
export const PushesStore = signalStore(
  withState<PushesState>({ pushes: [], stores: [], detail: null, loading: false, saving: false, error: null }),
  withMethods((store, api = inject(FranchiseNetworkApiService)) => {
    const load = async (): Promise<void> => {
      patchState(store, { loading: true, error: null });
      try {
        const [pushes, lookups] = await Promise.all([
          firstValueFrom(api.listPushes()),
          firstValueFrom(api.getLookups()),
        ]);
        patchState(store, { pushes: pushes.data, stores: lookups.data.stores, loading: false });
      } catch (error) {
        patchState(store, { loading: false, error: failureOf(error).errorKey });
      }
    };

    const act = async (call: () => Promise<{ data: FrnPush }>, keepDetail: boolean): Promise<FrnOutcome> => {
      patchState(store, { saving: true });
      try {
        const response = await call();
        patchState(store, { saving: false, detail: keepDetail ? response.data : store.detail() });
        await load();
        return FRN_OK;
      } catch (error) {
        patchState(store, { saving: false });
        return failureOf(error);
      }
    };

    return {
      load,
      create: (payload: FrnPushCreatePayload): Promise<FrnOutcome> =>
        act(() => firstValueFrom(api.createPush(payload)), false),
      dispatch: (id: string): Promise<FrnOutcome> => act(() => firstValueFrom(api.dispatchPush(id)), true),
      retry: (id: string): Promise<FrnOutcome> => act(() => firstValueFrom(api.retryPush(id)), true),
      async openDetail(id: string): Promise<void> {
        try {
          const response = await firstValueFrom(api.getPush(id));
          patchState(store, { detail: response.data });
        } catch (error) {
          patchState(store, { error: failureOf(error).errorKey });
        }
      },
      closeDetail(): void {
        patchState(store, { detail: null });
      },
    };
  }),
);
