import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { PassengerTransportApiService, PtrVehicle, PtrVehiclePayload } from '@core';
import { failureOf, PTR_OK, PtrOutcome } from './passenger-transport.util';

export interface FleetState {
  vehicles: PtrVehicle[];
  loading: boolean;
  saving: boolean;
  error: string | null;
}

/** The vehicles of the passenger fleet: NCC cars and vans, minibuses, GT coaches, school buses and taxis. */
export const FleetStore = signalStore(
  withState<FleetState>({ vehicles: [], loading: false, saving: false, error: null }),
  withMethods((store, api = inject(PassengerTransportApiService)) => {
    const load = async (q?: string): Promise<void> => {
      patchState(store, { loading: true, error: null });
      try {
        const response = await firstValueFrom(api.listVehicles(q));
        patchState(store, { vehicles: response.data, loading: false });
      } catch (error) {
        patchState(store, { loading: false, error: failureOf(error).errorKey });
      }
    };

    const write = async (call: () => Promise<unknown>): Promise<PtrOutcome> => {
      patchState(store, { saving: true });
      try {
        await call();
        patchState(store, { saving: false });
        await load();
        return PTR_OK;
      } catch (error) {
        patchState(store, { saving: false });
        return failureOf(error);
      }
    };

    return {
      load,
      save: (payload: PtrVehiclePayload, id?: string): Promise<PtrOutcome> =>
        write(() =>
          firstValueFrom(id ? api.updateVehicle(id, payload) : api.createVehicle(payload)),
        ),
      remove: (id: string): Promise<PtrOutcome> =>
        write(() => firstValueFrom(api.deleteVehicle(id))),
    };
  }),
);
