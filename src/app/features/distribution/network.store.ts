import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import {
  DistributionApiService,
  DstLane,
  DstLanePayload,
  DstLookups,
  DstNetworkWarehouse,
  DstProfilePayload,
} from '@core';
import { attempt, DstOutcome, failureOf } from './distribution.util';

export interface NetworkState {
  warehouses: DstNetworkWarehouse[];
  lanes: DstLane[];
  lookups: DstLookups | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
}

/** The topology of the network: the role and terms of every warehouse and the distribution lanes between them. */
export const NetworkStore = signalStore(
  withState<NetworkState>({
    warehouses: [],
    lanes: [],
    lookups: null,
    loading: false,
    saving: false,
    error: null,
  }),
  withMethods((store, api = inject(DistributionApiService)) => {
    const load = async (): Promise<void> => {
      patchState(store, { loading: true, error: null });
      try {
        const [lookups, warehouses, lanes] = await Promise.all([
          firstValueFrom(api.getLookups()),
          firstValueFrom(api.listNetworkWarehouses()),
          firstValueFrom(api.listLanes()),
        ]);
        patchState(store, {
          lookups: lookups.data,
          warehouses: warehouses.data,
          lanes: lanes.data,
          loading: false,
        });
      } catch (error) {
        patchState(store, { loading: false, error: failureOf(error).errorKey });
      }
    };

    const write = async (call: () => Promise<unknown>): Promise<DstOutcome> => {
      patchState(store, { saving: true });
      const outcome = await attempt(call);
      patchState(store, { saving: false });
      if (outcome.ok) {
        await load();
      }
      return outcome;
    };

    return {
      load,
      saveProfile: (warehouseId: string, payload: DstProfilePayload): Promise<DstOutcome> =>
        write(() => firstValueFrom(api.saveProfile(warehouseId, payload))),
      saveLane: (payload: DstLanePayload, id?: string): Promise<DstOutcome> =>
        write(() => firstValueFrom(id ? api.updateLane(id, payload) : api.createLane(payload))),
      removeLane: (id: string): Promise<DstOutcome> =>
        write(() => firstValueFrom(api.deleteLane(id))),
    };
  }),
);
