import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import {
  FranchiseNetworkApiService,
  FrnFormula,
  FrnFormulaPayload,
  FrnSimulation,
} from '@core';
import { failureOf, FRN_OK, FrnOutcome } from './franchise-network.util';

export interface FormulasState {
  formulas: FrnFormula[];
  simulation: FrnSimulation | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
}

/** Royalty and marketing fund formulas: progressive brackets, minimum guarantee, start-up exemption and the simulator. */
export const FormulasStore = signalStore(
  withState<FormulasState>({ formulas: [], simulation: null, loading: false, saving: false, error: null }),
  withMethods((store, api = inject(FranchiseNetworkApiService)) => {
    const load = async (): Promise<void> => {
      patchState(store, { loading: true, error: null });
      try {
        const response = await firstValueFrom(api.listFormulas());
        patchState(store, { formulas: response.data, loading: false });
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
      save: (payload: FrnFormulaPayload, id?: string): Promise<FrnOutcome> =>
        write(() => firstValueFrom(id ? api.updateFormula(id, payload) : api.createFormula(payload))),
      clone: (id: string, code: string): Promise<FrnOutcome> =>
        write(() => firstValueFrom(api.cloneFormula(id, code))),
      remove: (id: string): Promise<FrnOutcome> => write(() => firstValueFrom(api.deleteFormula(id))),
      async simulate(
        id: string,
        payload: { net_sales: number; opened_on?: string | null; period: string },
      ): Promise<FrnOutcome> {
        try {
          const response = await firstValueFrom(api.simulateFormula(id, payload));
          patchState(store, { simulation: response.data });
          return FRN_OK;
        } catch (error) {
          patchState(store, { simulation: null });
          return failureOf(error);
        }
      },
      clearSimulation(): void {
        patchState(store, { simulation: null });
      },
    };
  }),
);
