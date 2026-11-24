import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { AgcEnasarcoRow, AgentCommissionsApiService } from '@core';
import { failureOf } from './agent-commissions.util';

export interface EnasarcoState {
  year: number;
  rows: AgcEnasarcoRow[];
  loading: boolean;
  error: string | null;
}

const initialState: EnasarcoState = {
  year: new Date().getFullYear(),
  rows: [],
  loading: false,
  error: null,
};

/** Yearly Enasarco (massimale, minimale) and FIRR position of every agent under an Italian regime. */
export const EnasarcoStore = signalStore(
  withState(initialState),
  withComputed(({ rows }) => ({
    reachedCount: computed(() => rows().filter((row) => row.massimale_reached).length),
    shortfallCount: computed(
      () => rows().filter((row) => row.minimale !== null && !row.minimale_reached).length,
    ),
  })),
  withMethods((store, api = inject(AgentCommissionsApiService)) => {
    let sequence = 0;

    const load = async (year: number): Promise<void> => {
      const ticket = ++sequence;
      patchState(store, { year, loading: true, error: null });
      try {
        const response = await firstValueFrom(api.getEnasarcoOverview(year));
        if (ticket === sequence) {
          patchState(store, { rows: response.data, loading: false });
        }
      } catch (error) {
        if (ticket === sequence) {
          patchState(store, { loading: false, error: (await failureOf(error)).errorKey });
        }
      }
    };

    return {
      init: (): Promise<void> => load(store.year()),
      setYear: (year: number): Promise<void> => load(year),
    };
  }),
);
