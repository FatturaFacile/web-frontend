import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { GdoTradeTermsApiService, GdtSimulation, GdtSimulationPayload } from '@core';
import { failureOf, GDT_OK, GdtOutcome } from './gdo-trade-terms.util';

export interface SimulatorState {
  result: GdtSimulation | null;
  loading: boolean;
}

/** The what-if of a bracket scale: retroactive against progressive rebate for a list of volumes. */
export const SimulatorStore = signalStore(
  withState<SimulatorState>({ result: null, loading: false }),
  withMethods((store, api = inject(GdoTradeTermsApiService)) => ({
    async simulate(payload: GdtSimulationPayload): Promise<GdtOutcome> {
      patchState(store, { loading: true });
      try {
        const response = await firstValueFrom(api.simulate(payload));
        patchState(store, { result: response.data, loading: false });
        return GDT_OK;
      } catch (error) {
        patchState(store, { loading: false });
        return failureOf(error);
      }
    },
    clear(): void {
      patchState(store, { result: null });
    },
  })),
);
